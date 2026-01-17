import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { getPartnerConfig } from '@/lib/partners/get-partner';

export default async function Page({
  params,
}: {
  params: Promise<{ partner: string }>;
}) {
  const { partner: partnerSlug } = await params;
  const partner = getPartnerConfig(partnerSlug);

  if (!partner) {
    notFound();
  }

  const headline =
    partner.headline ?? 'Official educational app to enforce ICAO Level 4';
  const subheadline =
    partner.subheadline ??
    'ELPAC Aviation English assessment tailored for professional training.';
  return (
    <main className="min-h-dvh bg-background">
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="flex flex-col items-start gap-10">
          <div className="flex items-center gap-4">
            {partner.logoPath ? (
              <img
                src={partner.logoPath}
                alt={`${partner.displayName} logo`}
                className="h-12 w-auto"
              />
            ) : (
              <div className="rounded-full border px-4 py-2 text-sm font-semibold">
                {partner.displayName}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight">
              {headline}
            </h1>
            <p className="text-lg text-muted-foreground">{subheadline}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
