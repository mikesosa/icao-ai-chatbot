import { type Page, expect, test } from '@playwright/test';
import postgres from 'postgres';

import {
  assertHumanLikeExamResponse,
  extractStreamedText,
  normalizeText,
} from './helpers/exam-chat-quality';

const TEST_PASSWORD = 'Playwright!12345';
const EXAM_START_TRIGGER_MESSAGE =
  'Start the evaluation. Begin with the first section.';
const ELPAC_MODEL_ID = 'elpac-demo';
const EXAM_EVALUATOR_MODEL_TYPE = 'exam-evaluator';
const MAX_EMPTY_RESPONSE_RECOVERY_ATTEMPTS = 2;
const RUN_NON_DETERMINISTIC_E2E = process.env.RUN_NON_DETERMINISTIC_E2E === '1';
const USES_DETERMINISTIC_TEST_MODEL =
  process.env.PLAYWRIGHT === 'True' ||
  process.env.PLAYWRIGHT === 'true' ||
  process.env.CI_PLAYWRIGHT === '1';

type ExamRoute = {
  section: string;
  subsection?: string;
};

type TranscriptTurn = {
  speaker: 'SYSTEM' | 'CANDIDATE' | 'EXAMINER';
  text: string;
  section?: string;
  subsection?: string;
};

function createTestEmail(): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `elpac-nondeterministic-e2e-${unique}@playwright.local`;
}

async function registerUser(page: Page, email: string) {
  await page.goto('/register');
  await page.getByPlaceholder('user@acme.com').fill(email);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign Up' }).click();

  await expect(page.getByTestId('toast')).toContainText(
    'Account created successfully!',
  );
}

async function activateExamSubscription(email: string) {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL is not configured');
  }

  const sql = postgres(connectionString, { max: 1 });

  const users = await sql<{ id: string }[]>`
    SELECT id
    FROM "User"
    WHERE email = ${email}
    LIMIT 1
  `;
  const [user] = users;

  if (!user?.id) {
    await sql.end();
    throw new Error(`Could not find user for ${email}`);
  }

  const now = new Date();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const existing = await sql<{ id: string }[]>`
    SELECT id
    FROM "Subscription"
    WHERE "userId" = ${user.id}
    LIMIT 1
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE "Subscription"
      SET
        status = 'active',
        "planId" = 'playwright-e2e',
        "providerCustomerId" = ${`pw-customer-${user.id}`},
        "providerSubscriptionId" = ${`pw-subscription-${user.id}`},
        "currentPeriodEnd" = ${periodEnd},
        "updatedAt" = ${now}
      WHERE "userId" = ${user.id}
    `;
  } else {
    await sql`
      INSERT INTO "Subscription" (
        "userId",
        status,
        "planId",
        "providerCustomerId",
        "providerSubscriptionId",
        "currentPeriodEnd",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${user.id},
        'active',
        'playwright-e2e',
        ${`pw-customer-${user.id}`},
        ${`pw-subscription-${user.id}`},
        ${periodEnd},
        ${now},
        ${now}
      )
    `;
  }

  await sql.end();
}

type SendExamTurnOptions = {
  page: Page;
  chatId: string;
  text: string;
  currentSection?: string;
  currentSubsection?: string;
};

async function sendExamTurn({
  page,
  chatId,
  text,
  currentSection,
  currentSubsection,
}: SendExamTurnOptions): Promise<string> {
  const response = await page.request.post('/api/chat', {
    data: {
      id: chatId,
      message: {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        role: 'user',
        content: text,
        parts: [{ type: 'text', text }],
      },
      selectedChatModel: ELPAC_MODEL_ID,
      selectedVisibilityType: 'private',
      modelType: EXAM_EVALUATOR_MODEL_TYPE,
      currentSection: currentSection ?? null,
      currentSubsection: currentSubsection ?? null,
    },
  });

  expect(response.ok(), `chat request should succeed for turn: "${text}"`).toBe(
    true,
  );

  const streamPayload = await response.text();
  return normalizeText(extractStreamedText(streamPayload));
}

async function sendExamTurnWithRecovery({
  page,
  chatId,
  text,
  currentSection,
  currentSubsection,
  label,
  allowEmptyAfterRecovery = false,
}: SendExamTurnOptions & {
  label: string;
  allowEmptyAfterRecovery?: boolean;
}): Promise<string> {
  let examinerResponse = await sendExamTurn({
    page,
    chatId,
    text,
    currentSection,
    currentSubsection,
  });

  if (examinerResponse) {
    return examinerResponse;
  }

  for (
    let attempt = 1;
    attempt <= MAX_EMPTY_RESPONSE_RECOVERY_ATTEMPTS;
    attempt++
  ) {
    examinerResponse = await sendExamTurn({
      page,
      chatId,
      text: `[System] Continue the exam in Section ${currentSection ?? 'unknown'}${currentSubsection ? ` Subsection ${currentSubsection}` : ''}. Provide one brief spoken examiner prompt before proceeding.`,
      currentSection,
      currentSubsection,
    });

    if (examinerResponse) {
      return examinerResponse;
    }
  }

  expect(
    allowEmptyAfterRecovery,
    `${label} should not be empty even after recovery attempts`,
  ).toBe(true);

  return examinerResponse;
}

function buildExamRoutes(config: any): ExamRoute[] {
  const sections = (config?.examConfig?.sections ?? {}) as Record<
    string,
    { subsections?: Record<string, unknown> }
  >;

  const sectionKeys = Object.keys(sections).sort(
    (a, b) => Number(a) - Number(b),
  );
  const routes: ExamRoute[] = [];

  for (const sectionKey of sectionKeys) {
    const subsectionKeys = Object.keys(sections[sectionKey]?.subsections ?? {})
      .filter(Boolean)
      .sort();

    if (subsectionKeys.length === 0) {
      routes.push({ section: sectionKey });
      continue;
    }

    for (const subsectionKey of subsectionKeys) {
      routes.push({ section: sectionKey, subsection: subsectionKey });
    }
  }

  return routes;
}

function buildCandidateTurns(route: ExamRoute): string[] {
  if (!route.subsection) {
    return [
      'I will provide concise and operationally clear answers focused on communication and phraseology.',
    ];
  }

  switch (route.subsection) {
    case '1P1':
      return ['The assigned transponder code is six one four two.'];
    case '1P3':
      return [
        'The main problem is smoke in the cabin after departure.',
        'The crew requested immediate return and priority landing.',
        'ATC gave heading 270, climb to 5000 feet, vectors for ILS runway 24, and emergency services on standby.',
      ];
    case '2I':
      return [
        'Falcon nine zero six, startup approved, expect taxi in two minutes, stand by for sequencing.',
        'Copy potential technical issue, hold position, report intentions, and advise fuel and souls on board.',
      ];
    case '2II':
      return [
        'The image shows an operational airport communication environment with multiple actors and coordination pressure.',
        'Main communication risks are ambiguity, blocked transmissions, and delayed clarification of critical information.',
      ];
    default:
      return [
        'My response for this part is concise, relevant, and focused on safe and clear aviation communication.',
      ];
  }
}

function formatTranscriptLine(turn: TranscriptTurn): string {
  const location = turn.subsection ?? turn.section ?? '-';
  return `[${turn.speaker}] (${location}) ${turn.text}`;
}

function isFinalElpacCompletionResponse(text: string): boolean {
  const normalized = text.toLowerCase();
  return /now complete|demo is now complete|assessment is complete/.test(
    normalized,
  );
}

test.describe('ELPAC Demo Non-Deterministic E2E', () => {
  test.skip(
    !RUN_NON_DETERMINISTIC_E2E,
    'Set RUN_NON_DETERMINISTIC_E2E=1 to run real-model non-deterministic checks.',
  );
  test.skip(
    USES_DETERMINISTIC_TEST_MODEL,
    'Unset PLAYWRIGHT/CI_PLAYWRIGHT to run against non-deterministic provider output.',
  );
  test.skip(
    !process.env.OPENAI_API_KEY,
    'OPENAI_API_KEY is required for real-model non-deterministic test.',
  );

  test('real model flow remains coherent and finishes the ELPAC demo cleanly', async ({
    page,
  }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);
    const transcript: TranscriptTurn[] = [];

    try {
      const email = createTestEmail();
      await registerUser(page, email);
      await activateExamSubscription(email);
      await page.goto('/');

      const configResponse = await page.request.get(
        '/api/exam-configs?id=elpac-demo',
      );
      expect(configResponse.ok()).toBe(true);
      const elpacConfig = await configResponse.json();

      const routes = buildExamRoutes(elpacConfig);
      expect(routes.length).toBeGreaterThan(0);
      expect(routes.map((route) => route.subsection ?? route.section)).toEqual(
        expect.arrayContaining(['1P1', '1P3', '2I', '2II']),
      );

      const firstRoute = routes[0];
      const lastRoute = routes.at(-1);
      expect(firstRoute).toBeDefined();
      expect(lastRoute).toBeDefined();

      const chatId = crypto.randomUUID();
      const examinerResponses: string[] = [];

      transcript.push({
        speaker: 'SYSTEM',
        text: EXAM_START_TRIGGER_MESSAGE,
        section: firstRoute?.section,
        subsection: firstRoute?.subsection,
      });
      const firstExaminerResponse = await sendExamTurnWithRecovery({
        page,
        chatId,
        text: EXAM_START_TRIGGER_MESSAGE,
        currentSection: firstRoute?.section,
        currentSubsection: firstRoute?.subsection,
        label: 'first examiner response',
      });
      assertHumanLikeExamResponse(
        firstExaminerResponse,
        'first examiner response',
      );
      transcript.push({
        speaker: 'EXAMINER',
        text: firstExaminerResponse,
        section: firstRoute?.section,
        subsection: firstRoute?.subsection,
      });
      examinerResponses.push(firstExaminerResponse);

      for (const route of routes) {
        const candidateTurns = buildCandidateTurns(route);
        const isFinalRoute =
          route.section === lastRoute?.section &&
          route.subsection === lastRoute?.subsection;

        for (const [turnIndex, candidateText] of candidateTurns.entries()) {
          const isFinalScriptedTurn =
            isFinalRoute && turnIndex === candidateTurns.length - 1;
          transcript.push({
            speaker: 'CANDIDATE',
            text: candidateText,
            section: route.section,
            subsection: route.subsection,
          });
          const routeExaminerResponse = await sendExamTurnWithRecovery({
            page,
            chatId,
            text: candidateText,
            currentSection: route.section,
            currentSubsection: route.subsection,
            label: `examiner response after ${route.subsection ?? `section-${route.section}`} candidate turn ${turnIndex + 1}`,
            allowEmptyAfterRecovery: isFinalScriptedTurn,
          });

          if (routeExaminerResponse) {
            assertHumanLikeExamResponse(
              routeExaminerResponse,
              `examiner response after ${route.subsection ?? `section-${route.section}`} candidate turn ${turnIndex + 1}`,
            );
            transcript.push({
              speaker: 'EXAMINER',
              text: routeExaminerResponse,
              section: route.section,
              subsection: route.subsection,
            });
            examinerResponses.push(routeExaminerResponse);
          } else {
            transcript.push({
              speaker: 'EXAMINER',
              text: '(no textual response; proceeding to completion prompt)',
              section: route.section,
              subsection: route.subsection,
            });
          }
        }
      }

      const combinedExaminerGuidance = examinerResponses.join('\n');
      expect(
        /[?]|\b(tell|describe|explain|share|continue|next|respond|answer|please|section|part|task|paper)\b/i.test(
          combinedExaminerGuidance,
        ),
        'examiner should provide at least one clear candidate instruction or prompt during the flow',
      ).toBe(true);

      let completionPrompt =
        'I have completed all parts of this ELPAC demo. Please provide the final evaluation and conclude the exam now.';
      let completionResponse = '';
      let completionEmptyRetryCount = 0;

      for (let attempt = 0; attempt < 4; attempt++) {
        transcript.push({
          speaker: 'CANDIDATE',
          text: completionPrompt,
          section: lastRoute?.section,
          subsection: lastRoute?.subsection,
        });
        completionResponse = await sendExamTurnWithRecovery({
          page,
          chatId,
          text: completionPrompt,
          currentSection: lastRoute?.section,
          currentSubsection: lastRoute?.subsection,
          label: `completion response attempt ${attempt + 1}`,
          allowEmptyAfterRecovery: true,
        });

        if (!completionResponse) {
          completionEmptyRetryCount += 1;
          transcript.push({
            speaker: 'EXAMINER',
            text: '(no textual completion response; retrying finalization)',
            section: lastRoute?.section,
            subsection: lastRoute?.subsection,
          });
          completionPrompt =
            '[System] Finalize the ELPAC ATC Demo now. Provide the final evaluation and clearly state that the demo is complete.';
          continue;
        }

        assertHumanLikeExamResponse(
          completionResponse,
          `completion response attempt ${attempt + 1}`,
        );
        transcript.push({
          speaker: 'EXAMINER',
          text: completionResponse,
          section: lastRoute?.section,
          subsection: lastRoute?.subsection,
        });

        if (isFinalElpacCompletionResponse(completionResponse)) {
          break;
        }

        // If the model is still asking follow-up questions, answer once and ask to finalize again.
        const followUpAnswer =
          'I would prioritize immediate safety-critical instruction first, then sequencing and readback confirmation.';
        transcript.push({
          speaker: 'CANDIDATE',
          text: followUpAnswer,
          section: lastRoute?.section,
          subsection: lastRoute?.subsection,
        });
        const followUpExaminerResponse = await sendExamTurnWithRecovery({
          page,
          chatId,
          text: followUpAnswer,
          currentSection: lastRoute?.section,
          currentSubsection: lastRoute?.subsection,
          label: `completion follow-up examiner response attempt ${attempt + 1}`,
          allowEmptyAfterRecovery: true,
        });
        if (followUpExaminerResponse) {
          transcript.push({
            speaker: 'EXAMINER',
            text: followUpExaminerResponse,
            section: lastRoute?.section,
            subsection: lastRoute?.subsection,
          });
          if (isFinalElpacCompletionResponse(followUpExaminerResponse)) {
            completionResponse = followUpExaminerResponse;
            break;
          }
        }

        completionPrompt =
          '[System] Finalize the ELPAC ATC Demo now. Provide the final evaluation and clearly state that the demo is complete.';
      }

      expect(
        isFinalElpacCompletionResponse(completionResponse),
        `completion response should explicitly state the demo is complete; got: "${completionResponse}"`,
      ).toBe(true);
      expect(
        completionEmptyRetryCount,
        `completion should not need more than one empty retry; got ${completionEmptyRetryCount}`,
      ).toBeLessThanOrEqual(1);
      expect(completionResponse.toLowerCase()).toContain('elpac');
    } finally {
      const transcriptText = transcript.map(formatTranscriptLine).join('\n');
      console.log('\n=== Non-Deterministic ELPAC API Transcript ===');
      console.log(transcriptText || '(no transcript turns captured)');
      console.log('=== End Transcript ===\n');

      await testInfo.attach('elpac-api-transcript.txt', {
        body: Buffer.from(transcriptText, 'utf8'),
        contentType: 'text/plain',
      });
      await testInfo.attach('elpac-api-transcript.json', {
        body: Buffer.from(JSON.stringify(transcript, null, 2), 'utf8'),
        contentType: 'application/json',
      });
    }
  });
});
