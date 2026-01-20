import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { type NextRequest, NextResponse } from 'next/server';

// Authentication is now handled by middleware
// import { auth } from '@/app/(auth)/auth';

// Supported exam types and their sections
const SUPPORTED_EXAMS = {
  tea: {
    sections: ['2a', '2b', '2c'] as const,
    maxRecordings: {
      '2a': 6,
      '2b': 4,
      '2c': 3,
    },
  },
  elpac: {
    sections: ['1', '2'] as const,
    maxRecordings: {
      '1': 6, // Listening section (ATC Paper 1 has multiple parts; using 6 placeholder recordings for now)
      '2': 3, // Oral interaction prompts (audio prompts)
    },
  },
} as const;

type ExamType = keyof typeof SUPPORTED_EXAMS;

export async function GET(request: NextRequest) {
  // Authentication is handled by middleware
  // const session = await auth();
  // if (!session) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  const { searchParams } = new URL(request.url);

  // Support both old format (file parameter) and new format (exam parameters)
  const filename = searchParams.get('file');
  const exam = searchParams.get('exam') as ExamType;
  const section = searchParams.get('section');
  const recording = searchParams.get('recording');
  const prompt = searchParams.get('prompt'); // For ELPAC speaking prompts

  let audioPath: string;

  // Handle new exam-specific format
  if (exam && section) {
    // Validate exam type
    if (!SUPPORTED_EXAMS[exam]) {
      return NextResponse.json(
        { error: `Unsupported exam type: ${exam}` },
        { status: 400 },
      );
    }

    // Validate section for the exam
    const validSections = SUPPORTED_EXAMS[exam].sections;
    const isValidSection = (validSections as readonly string[]).includes(
      section,
    );
    if (!isValidSection) {
      return NextResponse.json(
        { error: `Invalid section ${section} for exam ${exam}` },
        { status: 400 },
      );
    }

    // Determine recording number
    let recordingNumber: string;
    if (prompt && exam === 'elpac' && section === '2') {
      // ELPAC speaking prompts
      const promptNum = Number.parseInt(prompt);
      const maxPrompts = SUPPORTED_EXAMS.elpac.maxRecordings['2'];
      if (Number.isNaN(promptNum) || promptNum < 1 || promptNum > maxPrompts) {
        return NextResponse.json(
          { error: `Invalid prompt number: ${prompt}` },
          { status: 400 },
        );
      }
      recordingNumber = promptNum.toString().padStart(2, '0');
      audioPath = join(
        process.cwd(),
        'app',
        '(chat)',
        'api',
        'audio',
        exam,
        `section-${section}`,
        `${exam}-${section}-speaking-prompt-${recordingNumber}.mp3`,
      );
    } else {
      // Regular recordings
      const recordingNum = recording ? Number.parseInt(recording) : 1;
      let maxRecordings: number;

      if (exam === 'tea') {
        const teaSection = section as '2a' | '2b' | '2c';
        maxRecordings = SUPPORTED_EXAMS.tea.maxRecordings[teaSection];
      } else {
        const elpacSection = section as '1' | '2';
        maxRecordings = SUPPORTED_EXAMS.elpac.maxRecordings[elpacSection];
      }

      if (
        Number.isNaN(recordingNum) ||
        recordingNum < 1 ||
        recordingNum > maxRecordings
      ) {
        return NextResponse.json(
          { error: `Invalid recording number: ${recording}` },
          { status: 400 },
        );
      }
      recordingNumber = recordingNum.toString().padStart(2, '0');

      if (exam === 'elpac' && section === '1') {
        // ELPAC listening recordings (Paper 1)
        audioPath = join(
          process.cwd(),
          'app',
          '(chat)',
          'api',
          'audio',
          exam,
          `section-${section}`,
          `${exam}-${section}-listening-${recordingNumber}.mp3`,
        );
      } else if (exam === 'elpac' && section === '2') {
        // ELPAC oral interaction prompts (Paper 2)
        // Note: these use the speaking-prompt naming format.
        audioPath = join(
          process.cwd(),
          'app',
          '(chat)',
          'api',
          'audio',
          exam,
          `section-${section}`,
          `${exam}-${section}-speaking-prompt-${recordingNumber}.mp3`,
        );
      } else {
        // TEA recordings
        audioPath = join(
          process.cwd(),
          'app',
          '(chat)',
          'api',
          'audio',
          exam,
          `section-${section}`,
          `${exam}-${section}-recording-${recordingNumber}.mp3`,
        );
      }
    }
  } else if (filename) {
    // Handle legacy format for backward compatibility
    // Validate filename to prevent directory traversal
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    // Only allow .mp3 files
    if (!filename.endsWith('.mp3')) {
      return NextResponse.json(
        { error: 'Only MP3 files are allowed' },
        { status: 400 },
      );
    }

    audioPath = join(process.cwd(), 'app', '(chat)', 'api', 'audio', filename);
  } else {
    return NextResponse.json(
      {
        error: 'Either filename or exam parameters are required',
        usage: {
          legacy: '/api/audio?file=audio1.mp3',
          tea: '/api/audio?exam=tea&section=2a&recording=1',
          elpac_listening: '/api/audio?exam=elpac&section=1&recording=2',
          elpac_oral_interaction: '/api/audio?exam=elpac&section=2&prompt=1',
        },
      },
      { status: 400 },
    );
  }

  try {
    const audioBuffer = await readFile(audioPath);

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error serving audio file:', error);
    return NextResponse.json(
      {
        error: 'Audio file not found',
        path: audioPath,
        params: { exam, section, recording, prompt, filename },
      },
      { status: 404 },
    );
  }
}
