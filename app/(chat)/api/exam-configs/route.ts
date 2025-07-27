import { NextResponse } from 'next/server';

import type { SerializedCompleteExamConfig } from '@/components/exam-interface/exam';

import examConfigsData from './exam-configs.json';

// TODO: Replace this with actual CMS integration
// For now, we load from JSON file but structure it like a CMS response
const loadExamConfigurationsFromCMS = async (): Promise<
  Record<string, SerializedCompleteExamConfig>
> => {
  try {
    // In a real implementation, this would call your CMS API
    // Example: const response = await fetch(`${process.env.CMS_API_URL}/exam-configs`);
    // For now, we simulate it with the JSON file
    return examConfigsData as Record<string, SerializedCompleteExamConfig>;
  } catch (error) {
    console.error('Error loading exam configurations from CMS:', error);
    throw new Error('Failed to load exam configurations');
  }
};

// Cache configurations in memory for performance
let cachedConfigs: Record<string, SerializedCompleteExamConfig> | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getExamConfigurations = async (): Promise<
  Record<string, SerializedCompleteExamConfig>
> => {
  // Check if cache is still valid
  if (cachedConfigs && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedConfigs;
  }

  // Load fresh configurations from CMS
  cachedConfigs = await loadExamConfigurationsFromCMS();
  cacheTimestamp = Date.now();
  return cachedConfigs;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const examId = searchParams.get('id');
  const refresh = searchParams.get('refresh') === 'true';

  try {
    // Clear cache if refresh is requested
    if (refresh) {
      cachedConfigs = null;
      cacheTimestamp = 0;
    }

    const examConfigs = await getExamConfigurations();

    if (examId) {
      // Return specific exam configuration
      const config = examConfigs[examId];
      if (!config) {
        return NextResponse.json(
          { error: 'Exam configuration not found', examId },
          { status: 404 },
        );
      }
      return NextResponse.json(config);
    } else {
      // Return all available exam configurations
      return NextResponse.json({
        available: Object.keys(examConfigs),
        configs: examConfigs,
        lastUpdated: new Date(cacheTimestamp).toISOString(),
        totalConfigs: Object.keys(examConfigs).length,
      });
    }
  } catch (error) {
    console.error('Error fetching exam config:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

// POST endpoint for future CMS updates (when implementing write operations)
export async function POST(_request: Request) {
  try {
    // TODO: Implement exam configuration creation/updates
    // This would integrate with your CMS to create new exam configurations

    return NextResponse.json(
      {
        error: 'Not implemented',
        message:
          'POST operations will be implemented when CMS integration is complete',
      },
      { status: 501 },
    );
  } catch (error) {
    console.error('Error creating exam config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// Clear cache endpoint for manual cache invalidation
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'clear-cache') {
    cachedConfigs = null;
    cacheTimestamp = 0;

    return NextResponse.json({
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
