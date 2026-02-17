import { type Page, expect, test } from '@playwright/test';
import postgres from 'postgres';

const TEST_PASSWORD = 'Playwright!12345';
const EXPECTED_FIRST_EXAMINER_PROMPT =
  "Welcome to the TEA Demo. Let's begin with Section 1. Tell me briefly about your current role in aviation.";
const CANDIDATE_FIRST_ANSWER =
  'I work as a first officer on regional flights and handle short-haul operations.';
const EXPECTED_SECOND_EXAMINER_PROMPT =
  "Thank you for sharing that. Your answer was clear and relevant. Let's move on to Section 2, where you will listen to a short recording and answer a question.";

function createTestEmail(): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `tea-demo-e2e-${unique}@playwright.local`;
}

function extractStreamedText(streamPayload: string): string {
  return streamPayload
    .split('\n')
    .filter((line) => line.startsWith('0:'))
    .map((line) => {
      const parsed = JSON.parse(line.slice(2));
      return typeof parsed === 'string' ? parsed : '';
    })
    .join('');
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

async function installMockAudioSettingsCheck(page: Page) {
  await page.addInitScript(() => {
    const mockTrack = {
      kind: 'audio',
      enabled: true,
      muted: false,
      readyState: 'live',
      label: 'Playwright Microphone',
      stop: () => {},
    };

    const mockStream = {
      id: 'playwright-audio-stream',
      active: true,
      getTracks: () => [mockTrack],
      getAudioTracks: () => [mockTrack],
      getVideoTracks: () => [],
    };

    const mediaDevices = navigator.mediaDevices || ({} as MediaDevices);
    mediaDevices.getUserMedia = async () =>
      mockStream as unknown as MediaStream;
    mediaDevices.enumerateDevices = async () =>
      [
        {
          deviceId: 'playwright-mic',
          kind: 'audioinput',
          label: 'Playwright Mic',
          groupId: 'playwright',
          toJSON: () => ({}),
        },
      ] as MediaDeviceInfo[];

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: mediaDevices,
    });

    class MockMediaStreamSource {
      connect() {}
      disconnect() {}
    }

    class MockAnalyser {
      fftSize = 2048;
      smoothingTimeConstant = 0.85;
      connect() {}
      disconnect() {}
      getByteTimeDomainData(array: Uint8Array) {
        for (let i = 0; i < array.length; i++) {
          array[i] = i % 2 === 0 ? 144 : 112;
        }
      }
    }

    class MockGain {
      gain = {
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      };
      connect() {}
    }

    class MockOscillator {
      type: OscillatorType = 'sine';
      frequency = {
        setValueAtTime() {},
      };
      onended: (() => void) | null = null;
      connect() {}
      start() {}
      stop() {
        setTimeout(() => {
          this.onended?.();
        }, 0);
      }
    }

    class MockAudioContext {
      state: AudioContextState = 'running';
      currentTime = 0;
      destination = {};
      createMediaStreamSource() {
        return new MockMediaStreamSource() as unknown as MediaStreamAudioSourceNode;
      }
      createAnalyser() {
        return new MockAnalyser() as unknown as AnalyserNode;
      }
      createGain() {
        return new MockGain() as unknown as GainNode;
      }
      createOscillator() {
        return new MockOscillator() as unknown as OscillatorNode;
      }
      async resume() {}
      async close() {}
    }

    (window as Window & { AudioContext: typeof AudioContext }).AudioContext =
      MockAudioContext as unknown as typeof AudioContext;
    (
      window as Window & { webkitAudioContext?: typeof AudioContext }
    ).webkitAudioContext = MockAudioContext as unknown as typeof AudioContext;
  });
}

async function completeAudioSettingsCheck(page: Page) {
  await expect(page.getByTestId('audio-settings-check-dialog')).toBeVisible();
  const startExamButton = page.getByTestId('audio-settings-check-start');
  await expect(startExamButton).toBeDisabled();
  await page.getByTestId('audio-settings-check-mic').click();
  await expect(page.getByTestId('audio-settings-check-mic')).toContainText(
    'Re-check',
  );
  await page.getByTestId('audio-settings-check-speaker').click();
  await page.getByTestId('audio-settings-check-heard').click();
  await expect(startExamButton).toBeEnabled();
  await startExamButton.click();
}

async function installMockSpeechRecognition(page: Page) {
  await page.addInitScript(() => {
    class PlaywrightSpeechRecognition {
      lang = 'en-US';
      continuous = true;
      interimResults = true;
      maxAlternatives = 1;
      onresult: ((event: any) => void) | null = null;
      onerror: ((event: any) => void) | null = null;
      onend: (() => void) | null = null;

      start() {
        const transcript = (window as any).__pwSpeechTranscript || '';
        setTimeout(() => {
          if (!this.onresult) return;
          this.onresult({
            resultIndex: 0,
            results: [
              {
                0: { transcript },
                isFinal: true,
                length: 1,
              },
            ],
          });
        }, 30);
      }

      stop() {
        setTimeout(() => {
          this.onend?.();
        }, 0);
      }
    }

    (window as any).__pwSpeechTranscript = '';
    (window as any).SpeechRecognition = PlaywrightSpeechRecognition;
    (window as any).webkitSpeechRecognition = PlaywrightSpeechRecognition;
  });
}

async function setMockSpeechTranscript(page: Page, transcript: string) {
  await page.evaluate((value) => {
    (window as any).__pwSpeechTranscript = value;
  }, transcript);
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
    await installMockAudioSettingsCheck(page);

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
    await completeAudioSettingsCheck(page);

    const firstChatResponse = await firstChatResponsePromise;
    const firstChatPayload = await firstChatResponse.text();
    const firstExaminerText = normalizeText(
      extractStreamedText(firstChatPayload),
    );

    expect(firstExaminerText).toBe(EXPECTED_FIRST_EXAMINER_PROMPT);

    await page.getByTestId('exam-transcript-toggle').click();
    await expect(page.getByTestId('exam-transcript-panel')).toBeVisible();
    await expect(page.getByTestId('exam-transcript-speaker-0')).toHaveText(
      'Examiner',
    );
    await expect
      .poll(async () =>
        normalizeText(
          await page.getByTestId('exam-transcript-text-0').innerText(),
        ),
      )
      .toBe(EXPECTED_FIRST_EXAMINER_PROMPT);

    await expect(
      page.getByRole('button', { name: /Push to Talk/i }),
    ).toBeVisible();
  });

  test('captures candidate response and validates examiner follow-up', async ({
    page,
  }) => {
    await installMockAudioSettingsCheck(page);
    await installMockSpeechRecognition(page);

    const email = createTestEmail();

    await registerUser(page, email);
    await activateExamSubscription(email);

    await page.goto('/');

    await page.getByTestId('model-selector').click();
    await page.getByTestId('model-selector-item-tea-demo').click();
    await page.getByRole('button', { name: 'Start Demo' }).click();
    await page.getByRole('button', { name: 'Start Exam' }).click();
    await completeAudioSettingsCheck(page);

    await page.waitForResponse((response) => {
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

    await page.getByTestId('exam-transcript-toggle').click();
    await expect(page.getByTestId('exam-transcript-panel')).toBeVisible();

    const pttButton = page.getByRole('button', { name: /Push to Talk/i });
    await expect(pttButton).toBeEnabled();
    await setMockSpeechTranscript(page, CANDIDATE_FIRST_ANSWER);

    const followUpResponsePromise = page.waitForResponse((response) => {
      if (
        !response.url().includes('/api/chat') ||
        response.request().method() !== 'POST' ||
        response.status() !== 200
      ) {
        return false;
      }
      const payload = response.request().postData() || '';
      return payload.includes(CANDIDATE_FIRST_ANSWER);
    });

    await pttButton.dispatchEvent('mousedown');
    await page.waitForTimeout(150);
    await pttButton.dispatchEvent('mouseup');

    const followUpResponse = await followUpResponsePromise;
    const followUpPayload = await followUpResponse.text();
    const followUpText = normalizeText(extractStreamedText(followUpPayload));

    expect(followUpText).toBe(EXPECTED_SECOND_EXAMINER_PROMPT);

    await expect(page.getByTestId('exam-transcript-speaker-1')).toHaveText(
      'You',
    );
    await expect
      .poll(async () =>
        normalizeText(
          await page.getByTestId('exam-transcript-text-1').innerText(),
        ),
      )
      .toBe(CANDIDATE_FIRST_ANSWER);

    await expect(page.getByTestId('exam-transcript-speaker-2')).toHaveText(
      'Examiner',
    );
    await expect
      .poll(async () =>
        normalizeText(
          await page.getByTestId('exam-transcript-text-2').innerText(),
        ),
      )
      .toBe(EXPECTED_SECOND_EXAMINER_PROMPT);
  });
});
