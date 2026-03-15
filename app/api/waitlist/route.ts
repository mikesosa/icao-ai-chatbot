import { NextResponse } from 'next/server';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { waitlist } from '@/lib/db/schema';
import { sendFounderWaitlistAlert } from '@/lib/notifications/founder-waitlist-alert';

export async function POST(request: Request) {
  try {
    const { email, source } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();
    const normalizedSource =
      typeof source === 'string' && source.trim().length > 0
        ? source.trim().slice(0, 50)
        : 'landing';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 },
      );
    }

    const client = postgres(process.env.POSTGRES_URL ?? '');
    const db = drizzle(client);
    let insertedWaitlistEntry:
      | {
          id: string;
          email: string;
          createdAt: Date;
          source: string | null;
        }
      | undefined;

    try {
      [insertedWaitlistEntry] = await db
        .insert(waitlist)
        .values({ email: normalized, source: normalizedSource })
        .onConflictDoNothing()
        .returning({
          id: waitlist.id,
          email: waitlist.email,
          createdAt: waitlist.createdAt,
          source: waitlist.source,
        });
    } finally {
      await client.end();
    }

    if (insertedWaitlistEntry) {
      try {
        await sendFounderWaitlistAlert(insertedWaitlistEntry);
      } catch (error) {
        console.error('Failed to send founder waitlist alert email:', error);
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 },
    );
  }
}
