import type { Metadata } from 'next';

import { getPartnerConfig } from '@/lib/partners/get-partner';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ partner: string }>;
}): Promise<Metadata> {
  const { partner: partnerSlug } = await params;
  const partner = getPartnerConfig(partnerSlug);
  const title = partner?.displayName ?? 'AeroChat';
  const description =
    partner?.headline ??
    'Aviation English assessment and training platform for ICAO proficiency.';

  return {
    title,
    description,
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
