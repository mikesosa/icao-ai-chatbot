import { NextResponse } from 'next/server';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { waitlist } from '@/lib/db/schema';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 },
      );
    }

    const client = postgres(process.env.POSTGRES_URL ?? '');
    const db = drizzle(client);

    await db
      .insert(waitlist)
      .values({ email: normalized })
      .onConflictDoNothing();

    await client.end();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 },
    );
  }
}
