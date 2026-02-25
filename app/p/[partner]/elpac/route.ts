import { NextResponse } from 'next/server';

import { getPartnerConfig } from '@/lib/partners/get-partner';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ partner: string }> },
) {
  const { partner: partnerSlug } = await params;
  const partner = getPartnerConfig(partnerSlug);

  if (!partner) {
    return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
  }

  const examId = partner.defaultExamId ?? 'elpac-demo';
  const redirectUrl = new URL(`/?exam=${examId}&autostart=1`, request.url);

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set('partner', partner.slug, {
    path: '/',
    sameSite: 'lax',
  });

  return response;
}
