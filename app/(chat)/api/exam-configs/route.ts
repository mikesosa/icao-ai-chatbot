import { NextResponse } from 'next/server';
import examConfigsData from './exam-configs.json';
import { SerializedCompleteExamConfig } from '@/components/exam-interface/exam';

// Load exam configurations from JSON file
const examConfigs: Record<string, SerializedCompleteExamConfig> = examConfigsData;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const examId = searchParams.get('id');

  try {
    if (examId) {
      // Return specific exam configuration
      const config = examConfigs[examId];
      if (!config) {
        return NextResponse.json(
          { error: 'Exam configuration not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(config);
    } else {
      // Return all available exam configurations
      return NextResponse.json({
        available: Object.keys(examConfigs),
        configs: examConfigs,
      });
    }
  } catch (error) {
    console.error('Error fetching exam config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 