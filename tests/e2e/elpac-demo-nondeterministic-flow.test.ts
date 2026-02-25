import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { type Page, expect, test } from '@playwright/test';
import postgres from 'postgres';

import {
  type ParsedStreamAppendMessage,
  type ParsedStreamDataEvent,
  assertHumanLikeExamResponse,
  normalizeText,
  parseStreamPayload,
} from './helpers/exam-chat-quality';

const TEST_PASSWORD = 'Playwright!12345';
const EXAM_START_TRIGGER_MESSAGE =
  'Start the evaluation. Begin with the first section.';
const ELPAC_MODEL_ID = 'elpac-demo';
const EXAM_EVALUATOR_MODEL_TYPE = 'exam-evaluator';
const MAX_EMPTY_RESPONSE_RECOVERY_ATTEMPTS = 2;
const MAX_CHAT_HTTP_ATTEMPTS = 3;
const OFF_TOPIC_PROBE_TEXT = 'Can you tell me a joke about cats?';
const OFF_TOPIC_REDIRECT_SNIPPET =
  'keep your response focused on the exam task';
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

type SendExamTurnOptions = {
  page: Page;
  chatId: string;
  text: string;
  currentSection?: string;
  currentSubsection?: string;
};

type SendExamTurnResult = {
  text: string;
  streamPayload: string;
  parsedLineCount: number;
  appendMessages: ParsedStreamAppendMessage[];
  dataEvents: ParsedStreamDataEvent[];
  statusCode: number;
  httpAttempts: number;
};

type RecoveryAttempt = {
  requestText: string;
  response: SendExamTurnResult;
  isRecoveryPrompt: boolean;
};

type SendExamTurnWithRecoveryResult = {
  attempts: RecoveryAttempt[];
  final: RecoveryAttempt;
};

type ApiTurnTrace = {
  label: string;
  section?: string;
  subsection?: string;
  candidateText: string;
  finalResponseText: string;
  attempts: Array<{
    requestText: string;
    responseText: string;
    streamPayload: string;
    parsedLineCount: number;
    appendMessages: ParsedStreamAppendMessage[];
    dataEvents: ParsedStreamDataEvent[];
    statusCode: number;
    httpAttempts: number;
    isRecoveryPrompt: boolean;
  }>;
};

type StreamEventTrace = {
  turnIndex: number;
  turnLabel: string;
  section?: string;
  subsection?: string;
  requestText: string;
  responseText: string;
  isRecoveryPrompt: boolean;
  type: string;
  content?: unknown;
  channel: string;
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

async function sendExamTurn({
  page,
  chatId,
  text,
  currentSection,
  currentSubsection,
}: SendExamTurnOptions): Promise<SendExamTurnResult> {
  const truncate = (value: string, max = 500) => {
    if (value.length <= max) {
      return value;
    }
    return `${value.slice(0, max)}…`;
  };

  const isRetryableChatFailure = (statusCode: number, responseBody: string) => {
    if (statusCode >= 500) {
      return true;
    }

    if (statusCode === 408 || statusCode === 409 || statusCode === 429) {
      return true;
    }

    if (
      statusCode === 400 &&
      /bad_request:database|database|Failed to get subscription/i.test(
        responseBody,
      )
    ) {
      return true;
    }

    if (
      statusCode === 402 &&
      /payment_required|subscription|billing/i.test(responseBody)
    ) {
      return true;
    }

    return false;
  };

  let latestStatusCode = 0;
  let latestResponseBody = '';

  for (
    let httpAttempt = 1;
    httpAttempt <= MAX_CHAT_HTTP_ATTEMPTS;
    httpAttempt++
  ) {
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

    latestStatusCode = response.status();
    latestResponseBody = await response.text();

    if (response.ok()) {
      const parsedPayload = parseStreamPayload(latestResponseBody);
      return {
        text: normalizeText(parsedPayload.text),
        streamPayload: latestResponseBody,
        parsedLineCount: parsedPayload.parsedLineCount,
        appendMessages: parsedPayload.appendMessages,
        dataEvents: parsedPayload.dataEvents,
        statusCode: latestStatusCode,
        httpAttempts: httpAttempt,
      };
    }

    const shouldRetry =
      httpAttempt < MAX_CHAT_HTTP_ATTEMPTS &&
      isRetryableChatFailure(latestStatusCode, latestResponseBody);

    if (!shouldRetry) {
      break;
    }

    console.log(
      `[WARN] /api/chat attempt ${httpAttempt}/${MAX_CHAT_HTTP_ATTEMPTS} failed with status ${latestStatusCode}; retrying. body="${truncate(
        latestResponseBody,
      )}"`,
    );
    await page.waitForTimeout(350 * httpAttempt);
  }

  expect(
    false,
    `chat request should succeed for turn: "${text}". status=${latestStatusCode}, body="${truncate(
      latestResponseBody,
    )}"`,
  ).toBe(true);

  return {
    text: '',
    streamPayload: latestResponseBody,
    parsedLineCount: 0,
    appendMessages: [],
    dataEvents: [],
    statusCode: latestStatusCode,
    httpAttempts: MAX_CHAT_HTTP_ATTEMPTS,
  };
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
}): Promise<SendExamTurnWithRecoveryResult> {
  const attempts: RecoveryAttempt[] = [];

  const primaryResponse = await sendExamTurn({
    page,
    chatId,
    text,
    currentSection,
    currentSubsection,
  });
  attempts.push({
    requestText: text,
    response: primaryResponse,
    isRecoveryPrompt: false,
  });

  if (primaryResponse.text) {
    return {
      attempts,
      final: attempts[0],
    };
  }

  for (
    let attempt = 1;
    attempt <= MAX_EMPTY_RESPONSE_RECOVERY_ATTEMPTS;
    attempt++
  ) {
    const recoveryPrompt = `[System] Continue the exam in Section ${currentSection ?? 'unknown'}${currentSubsection ? ` Subsection ${currentSubsection}` : ''}. Provide one brief spoken examiner prompt before proceeding.`;
    const recoveryResponse = await sendExamTurn({
      page,
      chatId,
      text: recoveryPrompt,
      currentSection,
      currentSubsection,
    });
    const tracedAttempt: RecoveryAttempt = {
      requestText: recoveryPrompt,
      response: recoveryResponse,
      isRecoveryPrompt: true,
    };
    attempts.push(tracedAttempt);

    if (recoveryResponse.text) {
      return {
        attempts,
        final: tracedAttempt,
      };
    }
  }

  expect(
    allowEmptyAfterRecovery,
    `${label} should not be empty even after recovery attempts`,
  ).toBe(true);

  return {
    attempts,
    final: attempts[attempts.length - 1],
  };
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

function hasDuplicatedTaskTwoPrompt(text: string): boolean {
  return /Please describe what you see\.\s*Describe the operational situation you see\./i.test(
    text,
  );
}

function hasCompletionIntent(text: string): boolean {
  return /\b(final evaluation|conclude|complete|completed|finalize|end the exam)\b/i.test(
    text,
  );
}

function buildApiTurnTrace({
  label,
  section,
  subsection,
  candidateText,
  turnResult,
}: {
  label: string;
  section?: string;
  subsection?: string;
  candidateText: string;
  turnResult: SendExamTurnWithRecoveryResult;
}): ApiTurnTrace {
  return {
    label,
    section,
    subsection,
    candidateText,
    finalResponseText: turnResult.final.response.text,
    attempts: turnResult.attempts.map((attempt) => ({
      requestText: attempt.requestText,
      responseText: attempt.response.text,
      streamPayload: attempt.response.streamPayload,
      parsedLineCount: attempt.response.parsedLineCount,
      appendMessages: attempt.response.appendMessages,
      dataEvents: attempt.response.dataEvents,
      statusCode: attempt.response.statusCode,
      httpAttempts: attempt.response.httpAttempts,
      isRecoveryPrompt: attempt.isRecoveryPrompt,
    })),
  };
}

function flattenStreamEvents(turnTraces: ApiTurnTrace[]): StreamEventTrace[] {
  const streamEvents: StreamEventTrace[] = [];

  turnTraces.forEach((turnTrace, turnIndex) => {
    turnTrace.attempts.forEach((attempt) => {
      attempt.dataEvents.forEach((event) => {
        streamEvents.push({
          turnIndex,
          turnLabel: turnTrace.label,
          section: turnTrace.section,
          subsection: turnTrace.subsection,
          requestText: attempt.requestText,
          responseText: attempt.responseText,
          isRecoveryPrompt: attempt.isRecoveryPrompt,
          type: event.type,
          content: event.content,
          channel: event.channel,
        });
      });
    });
  });

  return streamEvents;
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
    const apiTurnTraces: ApiTurnTrace[] = [];
    const chatId = crypto.randomUUID();
    let examName = 'ELPAC ATC Demo';
    let completionResponse = '';
    let completionEmptyRetryCount = 0;

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
      examName =
        typeof elpacConfig?.name === 'string' ? elpacConfig.name : examName;

      const routes = buildExamRoutes(elpacConfig);
      expect(routes.length).toBeGreaterThan(0);
      expect(routes.map((route) => route.subsection ?? route.section)).toEqual(
        expect.arrayContaining(['1P1', '1P3', '2I', '2II']),
      );

      const firstRoute = routes[0];
      const lastRoute = routes.at(-1);
      expect(firstRoute).toBeDefined();
      expect(lastRoute).toBeDefined();

      const examinerResponses: string[] = [];

      transcript.push({
        speaker: 'SYSTEM',
        text: EXAM_START_TRIGGER_MESSAGE,
        section: firstRoute?.section,
        subsection: firstRoute?.subsection,
      });
      const firstExaminerTurn = await sendExamTurnWithRecovery({
        page,
        chatId,
        text: EXAM_START_TRIGGER_MESSAGE,
        currentSection: firstRoute?.section,
        currentSubsection: firstRoute?.subsection,
        label: 'first examiner response',
      });
      apiTurnTraces.push(
        buildApiTurnTrace({
          label: 'first examiner response',
          section: firstRoute?.section,
          subsection: firstRoute?.subsection,
          candidateText: EXAM_START_TRIGGER_MESSAGE,
          turnResult: firstExaminerTurn,
        }),
      );
      const firstExaminerResponse = firstExaminerTurn.final.response.text;
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

      transcript.push({
        speaker: 'CANDIDATE',
        text: OFF_TOPIC_PROBE_TEXT,
        section: firstRoute?.section,
        subsection: firstRoute?.subsection,
      });
      const offTopicTurn = await sendExamTurnWithRecovery({
        page,
        chatId,
        text: OFF_TOPIC_PROBE_TEXT,
        currentSection: firstRoute?.section,
        currentSubsection: firstRoute?.subsection,
        label: 'off-topic guard response',
      });
      const offTopicTrace = buildApiTurnTrace({
        label: 'off-topic guard response',
        section: firstRoute?.section,
        subsection: firstRoute?.subsection,
        candidateText: OFF_TOPIC_PROBE_TEXT,
        turnResult: offTopicTurn,
      });
      apiTurnTraces.push(offTopicTrace);
      const offTopicResponse = offTopicTurn.final.response.text;
      assertHumanLikeExamResponse(offTopicResponse, 'off-topic guard response');
      expect(offTopicResponse.toLowerCase()).toContain(
        OFF_TOPIC_REDIRECT_SNIPPET,
      );
      transcript.push({
        speaker: 'EXAMINER',
        text: offTopicResponse,
        section: firstRoute?.section,
        subsection: firstRoute?.subsection,
      });

      const offTopicExamControlEvents = offTopicTrace.attempts
        .flatMap((attempt) => attempt.dataEvents)
        .filter((event) => event.type === 'exam-section-control');
      expect(
        offTopicExamControlEvents.length,
        'off-topic guard response should not emit exam-section-control actions',
      ).toBe(0);

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
          const routeExaminerTurn = await sendExamTurnWithRecovery({
            page,
            chatId,
            text: candidateText,
            currentSection: route.section,
            currentSubsection: route.subsection,
            label: `examiner response after ${route.subsection ?? `section-${route.section}`} candidate turn ${turnIndex + 1}`,
            allowEmptyAfterRecovery: isFinalScriptedTurn,
          });

          apiTurnTraces.push(
            buildApiTurnTrace({
              label: `examiner response after ${route.subsection ?? `section-${route.section}`} candidate turn ${turnIndex + 1}`,
              section: route.section,
              subsection: route.subsection,
              candidateText,
              turnResult: routeExaminerTurn,
            }),
          );

          const routeExaminerResponse = routeExaminerTurn.final.response.text;

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

      const rolePlayKickoffTurn = transcript.find(
        (turn) =>
          turn.speaker === 'EXAMINER' &&
          /role-?play/i.test(turn.text) &&
          /controller/i.test(turn.text),
      );
      expect(
        rolePlayKickoffTurn,
        'examiner should include the Section 2 role-play kickoff turn',
      ).toBeDefined();

      const rolePlayKickoffText = rolePlayKickoffTurn?.text ?? '';
      expect(rolePlayKickoffText).toMatch(/next section/i);
      expect(rolePlayKickoffText).toMatch(
        /you(?:'ll| will) act as the controller/i,
      );
      expect(rolePlayKickoffText).toMatch(/pilot'?s lines/i);
      expect(rolePlayKickoffText).toMatch(/start-?up and taxi/i);
      expect(rolePlayKickoffText).toMatch(/technical issue/i);
      expect(rolePlayKickoffText).toMatch(/abc123/i);
      expect(rolePlayKickoffText).toMatch(/requesting start-?up and taxi/i);

      const duplicatedTaskTwoPromptTurn = transcript.find(
        (turn) =>
          turn.speaker === 'EXAMINER' &&
          turn.subsection === '2II' &&
          hasDuplicatedTaskTwoPrompt(turn.text),
      );
      expect(
        duplicatedTaskTwoPromptTurn,
        `2II examiner turn should not concatenate setup and first question. Found: ${duplicatedTaskTwoPromptTurn?.text ?? '(none)'}`,
      ).toBeUndefined();

      let completionPrompt =
        'I have completed all parts of this ELPAC demo. Please provide the final evaluation and conclude the exam now.';

      for (let attempt = 0; attempt < 4; attempt++) {
        transcript.push({
          speaker: 'CANDIDATE',
          text: completionPrompt,
          section: lastRoute?.section,
          subsection: lastRoute?.subsection,
        });
        const completionTurn = await sendExamTurnWithRecovery({
          page,
          chatId,
          text: completionPrompt,
          currentSection: lastRoute?.section,
          currentSubsection: lastRoute?.subsection,
          label: `completion response attempt ${attempt + 1}`,
          allowEmptyAfterRecovery: true,
        });
        apiTurnTraces.push(
          buildApiTurnTrace({
            label: `completion response attempt ${attempt + 1}`,
            section: lastRoute?.section,
            subsection: lastRoute?.subsection,
            candidateText: completionPrompt,
            turnResult: completionTurn,
          }),
        );
        completionResponse = completionTurn.final.response.text;

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

        const followUpAnswer =
          'I would prioritize immediate safety-critical instruction first, then sequencing and readback confirmation.';
        transcript.push({
          speaker: 'CANDIDATE',
          text: followUpAnswer,
          section: lastRoute?.section,
          subsection: lastRoute?.subsection,
        });
        const followUpTurn = await sendExamTurnWithRecovery({
          page,
          chatId,
          text: followUpAnswer,
          currentSection: lastRoute?.section,
          currentSubsection: lastRoute?.subsection,
          label: `completion follow-up examiner response attempt ${attempt + 1}`,
          allowEmptyAfterRecovery: true,
        });
        apiTurnTraces.push(
          buildApiTurnTrace({
            label: `completion follow-up examiner response attempt ${attempt + 1}`,
            section: lastRoute?.section,
            subsection: lastRoute?.subsection,
            candidateText: followUpAnswer,
            turnResult: followUpTurn,
          }),
        );
        const followUpExaminerResponse = followUpTurn.final.response.text;
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

      const streamEvents = flattenStreamEvents(apiTurnTraces);
      const examControlEvents = streamEvents.filter(
        (event) => event.type === 'exam-section-control',
      );

      const firstCompletionPromptTurnIndex = apiTurnTraces.findIndex((trace) =>
        hasCompletionIntent(trace.candidateText),
      );
      expect(
        firstCompletionPromptTurnIndex,
        'test should include at least one explicit completion request turn',
      ).toBeGreaterThanOrEqual(0);

      const prematureCompletionEvent = examControlEvents.find((event) => {
        const action = (event.content as any)?.action;
        return (
          action === 'complete_exam' &&
          event.turnIndex < firstCompletionPromptTurnIndex
        );
      });

      expect(
        prematureCompletionEvent,
        `exam should not emit complete_exam before explicit completion request. Event: ${JSON.stringify(
          prematureCompletionEvent ?? null,
        )}`,
      ).toBeUndefined();

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
      const streamEvents = flattenStreamEvents(apiTurnTraces);
      const examControlEvents = streamEvents
        .filter((event) => event.type === 'exam-section-control')
        .map((event) => ({
          turnIndex: event.turnIndex,
          turnLabel: event.turnLabel,
          action: (event.content as any)?.action ?? null,
          reason: (event.content as any)?.reason ?? null,
          section: event.section,
          subsection: event.subsection,
          requestText: event.requestText,
          isRecoveryPrompt: event.isRecoveryPrompt,
        }));

      const simplifiedMessages = transcript.map((turn, index) => ({
        id: `turn-${index}`,
        role:
          turn.speaker === 'EXAMINER'
            ? 'assistant'
            : turn.speaker === 'CANDIDATE'
              ? 'user'
              : 'system',
        text: turn.text,
      }));

      const lastTurnWithRoute = [...transcript]
        .reverse()
        .find((turn) => turn.section || turn.subsection);

      const conversationExport = {
        exportedAt: new Date().toISOString(),
        chatId,
        examModel: ELPAC_MODEL_ID,
        examName,
        currentSection: lastTurnWithRoute?.section ?? null,
        currentSubsection: lastTurnWithRoute?.subsection ?? null,
        status: isFinalElpacCompletionResponse(completionResponse)
          ? 'complete'
          : 'incomplete',
        transcriptTurns: transcript,
        messages: simplifiedMessages,
        turnTraces: apiTurnTraces,
        streamEvents,
        examControlEvents,
        metrics: {
          transcriptTurnCount: transcript.length,
          apiTurnCount: apiTurnTraces.length,
          apiAttemptCount: apiTurnTraces.reduce(
            (sum, turn) => sum + turn.attempts.length,
            0,
          ),
          streamEventCount: streamEvents.length,
        },
      };

      console.log('\n=== Non-Deterministic ELPAC API Transcript ===');
      console.log(transcriptText || '(no transcript turns captured)');
      console.log('=== End Transcript ===\n');

      const transcriptTxtArtifactPath = testInfo.outputPath(
        'elpac-api-transcript.txt',
      );
      const transcriptJsonArtifactPath = testInfo.outputPath(
        'elpac-api-transcript.json',
      );
      const conversationExportArtifactPath = testInfo.outputPath(
        'elpac-api-conversation-export.json',
      );

      await writeFile(transcriptTxtArtifactPath, transcriptText, 'utf8');
      await writeFile(
        transcriptJsonArtifactPath,
        JSON.stringify(transcript, null, 2),
        'utf8',
      );
      await writeFile(
        conversationExportArtifactPath,
        JSON.stringify(conversationExport, null, 2),
        'utf8',
      );

      const latestArtifactsDir = path.join(
        process.cwd(),
        'test-results',
        'non-deterministic-latest',
      );
      await mkdir(latestArtifactsDir, { recursive: true });
      await writeFile(
        path.join(latestArtifactsDir, 'elpac-api-transcript.txt'),
        transcriptText,
        'utf8',
      );
      await writeFile(
        path.join(latestArtifactsDir, 'elpac-api-transcript.json'),
        JSON.stringify(transcript, null, 2),
        'utf8',
      );
      await writeFile(
        path.join(latestArtifactsDir, 'elpac-api-conversation-export.json'),
        JSON.stringify(conversationExport, null, 2),
        'utf8',
      );

      console.log(
        '[ARTIFACT] ELPAC transcript txt:',
        transcriptTxtArtifactPath,
      );
      console.log(
        '[ARTIFACT] ELPAC transcript json:',
        transcriptJsonArtifactPath,
      );
      console.log(
        '[ARTIFACT] ELPAC conversation export:',
        conversationExportArtifactPath,
      );
      console.log('[ARTIFACT] ELPAC latest folder:', latestArtifactsDir);

      await testInfo.attach('elpac-api-transcript.txt', {
        path: transcriptTxtArtifactPath,
        contentType: 'text/plain',
      });
      await testInfo.attach('elpac-api-transcript.json', {
        path: transcriptJsonArtifactPath,
        contentType: 'application/json',
      });
      await testInfo.attach('elpac-api-conversation-export.json', {
        path: conversationExportArtifactPath,
        contentType: 'application/json',
      });
    }
  });
});
