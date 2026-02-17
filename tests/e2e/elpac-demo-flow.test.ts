import { expect, test } from '@playwright/test';

test.describe('ELPAC Demo Config E2E', () => {
  test('uses realistic listening sequence and Task I subsection mapping', async ({
    request,
  }) => {
    const response = await request.get('/api/exam-configs?id=elpac-demo');
    expect(response.ok()).toBeTruthy();

    const config = await response.json();
    const paperOnePrompt = config.aiConfig.sections['1'].prompt as string;
    const paperTwoPrompt = config.aiConfig.sections['2'].prompt as string;

    expect(paperOnePrompt).toContain(
      'playAudio(recordingNumber=1, subsection="1P1")',
    );
    expect(paperOnePrompt).toContain(
      'playAudio(recordingNumber=2, subsection="1P3")',
    );
    expect(paperOnePrompt).toContain('Allow one replay request per listening');

    expect(paperTwoPrompt).toContain(
      'playAudio(subsection="2I", recordingNumber=1)',
    );
  });

  test('candidate-facing demo text does not expose placeholder labels', async ({
    request,
  }) => {
    const response = await request.get('/api/exam-configs?id=elpac-demo');
    expect(response.ok()).toBeTruthy();

    const config = await response.json();
    const quickInstructions = config.messagesConfig
      .quickInstructions as string[];
    const subsectionDescriptions = [
      config.examConfig.sections['1'].subsections['1P1'].description as string,
      config.examConfig.sections['1'].subsections['1P3'].description as string,
      config.examConfig.sections['2'].subsections['2I'].description as string,
      config.examConfig.sections['2'].subsections['2II'].description as string,
    ];

    for (const value of [...quickInstructions, ...subsectionDescriptions]) {
      expect(value.toLowerCase()).not.toContain('placeholder');
    }
  });
});
