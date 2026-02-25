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
const TEA_MODEL_ID = 'tea-demo';
const EXAM_EVALUATOR_MODEL_TYPE = 'exam-evaluator';
const MAX_EMPTY_RESPONSE_RECOVERY_ATTEMPTS = 2;
const RUN_NON_DETERMINISTIC_E2E = process.env.RUN_NON_DETERMINISTIC_E2E === '1';
const USES_DETERMINISTIC_TEST_MODEL =
  process.env.PLAYWRIGHT === 'True' ||
  process.env.PLAYWRIGHT === 'true' ||
  process.env.CI_PLAYWRIGHT === '1';

function createTestEmail(): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `tea-nondeterministic-e2e-${unique}@playwright.local`;
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

type TeaRoute = {
  section: string;
  subsection?: string;
};

type TranscriptTurn = {
  speaker: 'SYSTEM' | 'CANDIDATE' | 'EXAMINER';
  text: string;
  section?: string;
  subsection?: string;
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
      selectedChatModel: TEA_MODEL_ID,
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
}: SendExamTurnOptions & { label: string }): Promise<string> {
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
    examinerResponse,
    `${label} should not be empty even after recovery attempts`,
  ).not.toBe('');

  return examinerResponse;
}

function assertExaminerPromptShape(text: string, label: string) {
  assertHumanLikeExamResponse(text, label);
}

function buildTeaDemoRoutes(config: any): TeaRoute[] {
  const sections = (config?.examConfig?.sections ?? {}) as Record<
    string,
    { subsections?: Record<string, unknown> }
  >;

  const sectionKeys = Object.keys(sections).sort((a, b) => {
    return Number(a) - Number(b);
  });

  const routes: TeaRoute[] = [];

  for (const sectionKey of sectionKeys) {
    const subsectionKeys = Object.keys(sections[sectionKey]?.subsections ?? {})
      .filter(Boolean)
      .sort();

    if (subsectionKeys.length === 0) {
      routes.push({ section: sectionKey });
      continue;
    }

    for (const subsectionKey of subsectionKeys) {
      routes.push({
        section: sectionKey,
        subsection: subsectionKey,
      });
    }
  }

  return routes;
}

function buildCandidateAnswer(route: TeaRoute): string {
  if (!route.subsection) {
    return 'I am currently a first officer on regional IFR flights and I coordinate regularly with ATC during departures, arrivals, and weather deviations.';
  }

  switch (route.subsection) {
    case '2A':
      return 'The pilot declared an emergency because of smoke in the cockpit and requested immediate priority landing with emergency support.';
    case '2B':
      return 'The main problem was engine oil temperature and pressure instability, the crew shut down engine two, and they requested priority handling.';
    case '2C':
      return 'I would delay or reroute the flight, check updated weather and alternates, and avoid convective areas because the pilot is not instrument rated.';
    case '3A':
      return 'I can see two airport operation scenes, one around terminal activity and one around runway movement, and both require clear communication and coordination.';
    case '3B':
      return 'The most important aspect of aviation safety is timely and unambiguous communication between pilots, controllers, and operators.';
    default:
      return 'My response for this part is concise, operationally relevant, and focused on clear aviation communication.';
  }
}

function formatTranscriptLine(turn: TranscriptTurn): string {
  const location = turn.subsection ?? turn.section ?? '-';
  return `[${turn.speaker}] (${location}) ${turn.text}`;
}

test.describe('TEA Demo Non-Deterministic E2E', () => {
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

  test('real model flow remains coherent and finishes the exam cleanly', async ({
    page,
  }, testInfo) => {
    test.setTimeout(5 * 60 * 1000);
    const transcript: TranscriptTurn[] = [];

    try {
      const email = createTestEmail();
      await registerUser(page, email);
      await activateExamSubscription(email);
      await page.goto('/');

      const configResponse = await page.request.get(
        '/api/exam-configs?id=tea-demo',
      );
      expect(configResponse.ok()).toBe(true);
      const teaConfig = await configResponse.json();

      const routes = buildTeaDemoRoutes(teaConfig);
      expect(routes.length).toBeGreaterThan(0);
      expect(routes.map((route) => route.subsection ?? route.section)).toEqual(
        expect.arrayContaining(['1', '2A', '2B', '2C', '3A', '3B']),
      );

      const chatId = crypto.randomUUID();
      const examinerResponses: string[] = [];

      const firstRoute = routes[0];
      const lastRoute = routes.at(-1);
      expect(firstRoute).toBeDefined();
      expect(lastRoute).toBeDefined();

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
      assertExaminerPromptShape(
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

      for (const [index, route] of routes.entries()) {
        const candidateAnswer = buildCandidateAnswer(route);
        transcript.push({
          speaker: 'CANDIDATE',
          text: candidateAnswer,
          section: route.section,
          subsection: route.subsection,
        });
        const routeExaminerResponse = await sendExamTurnWithRecovery({
          page,
          chatId,
          text: candidateAnswer,
          currentSection: route.section,
          currentSubsection: route.subsection,
          label: `examiner response after ${route.subsection ?? `section-${route.section}`} candidate answer`,
        });

        assertExaminerPromptShape(
          routeExaminerResponse,
          `examiner response after ${route.subsection ?? `section-${route.section}`} candidate answer`,
        );
        transcript.push({
          speaker: 'EXAMINER',
          text: routeExaminerResponse,
          section: route.section,
          subsection: route.subsection,
        });
        examinerResponses.push(routeExaminerResponse);

        if (index === 0) {
          expect(routeExaminerResponse).not.toBe(firstExaminerResponse);
        }
      }

      const combinedExaminerGuidance = examinerResponses.join('\n');
      expect(
        /[?]|\b(tell|describe|explain|share|continue|next|respond|answer|please|section|part)\b/i.test(
          combinedExaminerGuidance,
        ),
        'examiner should provide at least one clear candidate instruction or prompt during the flow',
      ).toBe(true);

      expect(examinerResponses.length).toBe(routes.length + 1);

      const completionPrompt =
        'I have completed all parts of this demo. Please provide the final evaluation and conclude the exam now.';
      transcript.push({
        speaker: 'CANDIDATE',
        text: completionPrompt,
        section: lastRoute?.section,
        subsection: lastRoute?.subsection,
      });
      const completionResponse = await sendExamTurnWithRecovery({
        page,
        chatId,
        text: completionPrompt,
        currentSection: lastRoute?.section,
        currentSubsection: lastRoute?.subsection,
        label: 'completion response',
      });
      assertHumanLikeExamResponse(completionResponse, 'completion response');
      transcript.push({
        speaker: 'EXAMINER',
        text: completionResponse,
        section: lastRoute?.section,
        subsection: lastRoute?.subsection,
      });
      expect(completionResponse.toLowerCase()).toMatch(
        /complete|completed|evaluation|result/,
      );
    } finally {
      const transcriptText = transcript.map(formatTranscriptLine).join('\n');
      console.log('\n=== Non-Deterministic API Transcript ===');
      console.log(transcriptText || '(no transcript turns captured)');
      console.log('=== End Transcript ===\n');

      await testInfo.attach('api-transcript.txt', {
        body: Buffer.from(transcriptText, 'utf8'),
        contentType: 'text/plain',
      });
      await testInfo.attach('api-transcript.json', {
        body: Buffer.from(JSON.stringify(transcript, null, 2), 'utf8'),
        contentType: 'application/json',
      });
    }
  });
});
