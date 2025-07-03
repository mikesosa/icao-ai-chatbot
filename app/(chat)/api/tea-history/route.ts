import { auth } from '@/app/(auth)/auth';
import type { NextRequest } from 'next/server';
import { getChatsByUserId } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Number.parseInt(searchParams.get('limit') || '10');
  const startingAfter = searchParams.get('starting_after');
  const endingBefore = searchParams.get('ending_before');

  if (startingAfter && endingBefore) {
    return new ChatSDKError(
      'bad_request:api',
      'Only one of starting_after or ending_before can be provided.',
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chats = await getChatsByUserId({
    id: session.user.id,
    limit,
    startingAfter,
    endingBefore,
  });

  // Filter to only include TEA exams (chats with TEA-related titles)
  const teaChats = chats.chats.filter(chat => 
    chat.title?.toLowerCase().includes('tea') ||
    chat.title?.toLowerCase().includes('examen') ||
    chat.title?.toLowerCase().includes('test') ||
    chat.title?.toLowerCase().includes('evaluación')
  );

  return Response.json({
    chats: teaChats,
    hasMore: chats.hasMore
  });
} 