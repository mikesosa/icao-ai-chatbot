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

function createTestEmail(): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `tea-text-e2e-${unique}@playwright.local`;
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

test.describe('TEA Demo Text-Only Flow E2E', () => {
  test('runs exam turns with plain text input and catches non-human responses', async ({
    page,
  }) => {
    const email = createTestEmail();

    await registerUser(page, email);
    await activateExamSubscription(email);
    await page.goto('/');

    const chatId = crypto.randomUUID();

    const firstExaminerResponse = await sendExamTurn({
      page,
      chatId,
      text: EXAM_START_TRIGGER_MESSAGE,
      currentSection: '1',
    });
    assertHumanLikeExamResponse(
      firstExaminerResponse,
      'first examiner response',
    );
    expect(firstExaminerResponse).toContain('Welcome to the TEA Demo');

    const secondExaminerResponse = await sendExamTurn({
      page,
      chatId,
      text: 'I am currently a first officer on regional short-haul routes.',
      currentSection: '1',
      currentSubsection: '1A',
    });
    assertHumanLikeExamResponse(
      secondExaminerResponse,
      'second examiner response',
    );

    const thirdExaminerResponse = await sendExamTurn({
      page,
      chatId,
      text: 'I am ready for the listening section prompt.',
      currentSection: '2',
      currentSubsection: '2A',
    });
    assertHumanLikeExamResponse(
      thirdExaminerResponse,
      'third examiner response',
    );

    const completionResponse = await sendExamTurn({
      page,
      chatId,
      text: 'I want to finish the exam now.',
      currentSection: '2',
      currentSubsection: '2A',
    });
    assertHumanLikeExamResponse(completionResponse, 'completion response');
    expect(completionResponse.toLowerCase()).toContain('complete');
  });
});
