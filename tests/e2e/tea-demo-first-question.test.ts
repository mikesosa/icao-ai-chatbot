import { type Page, expect, test } from '@playwright/test';
import postgres from 'postgres';

const TEST_PASSWORD = 'Playwright!12345';

function createTestEmail(): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `tea-demo-e2e-${unique}@playwright.local`;
}

function extractStreamedText(streamPayload: string): string {
  return streamPayload
    .split('\n')
    .filter((line) => line.startsWith('0:"') && line.endsWith('"'))
    .map((line) => line.slice(3, -1))
    .join('');
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

test.describe('TEA Demo E2E', () => {
  test('starts the exam and delivers the first examiner question', async ({
    page,
  }) => {
    const email = createTestEmail();

    await registerUser(page, email);
    await activateExamSubscription(email);

    await page.goto('/');

    await page.getByTestId('model-selector').click();
    await page.getByTestId('model-selector-item-tea-demo').click();

    await expect(page.getByTestId('model-selector')).toContainText('TEA Demo');
    await expect(
      page.getByText('Welcome to TEA Demo Exam Simulator'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Start Demo' }).click();
    await expect(
      page.getByRole('button', { name: 'Start Exam' }),
    ).toBeVisible();

    const firstChatResponsePromise = page.waitForResponse((response) => {
      if (
        !response.url().includes('/api/chat') ||
        response.request().method() !== 'POST' ||
        response.status() !== 200
      ) {
        return false;
      }

      const payload = response.request().postData() || '';
      return payload.includes(
        'Start the evaluation. Begin with the first section.',
      );
    });

    await page.getByRole('button', { name: 'Start Exam' }).click();

    const firstChatResponse = await firstChatResponsePromise;
    const firstChatPayload = await firstChatResponse.text();
    const firstExaminerText = extractStreamedText(firstChatPayload);

    expect(firstExaminerText).toContain(
      'Tell me briefly about your current role in aviation.',
    );

    await expect(
      page.getByText('Section 1 — Interview (Demo)', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Push to Talk/i }),
    ).toBeVisible();
  });
});
