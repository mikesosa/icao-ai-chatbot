import type { PartnerBrand } from './types';

export const DEFAULT_PARTNER: PartnerBrand = {
  slug: 'default',
  displayName: 'AeroChat',
  headline: 'Aviation English assessment platform',
  subheadline:
    'Practice and evaluate ICAO language proficiency with AI-assisted exams.',
  ctaLabel: 'Start assessment',
};

export const PARTNERS: Record<string, PartnerBrand> = {
  acdecta: {
    slug: 'acdecta',
    displayName: 'ACDECTA',
    headline: 'Official educational app to enforce ICAO Level 4',
    subheadline:
      'ELPAC Aviation English assessment tailored for professional training.',
    ctaLabel: 'Start ELPAC assessment',
    defaultExamId: 'elpac-evaluator',
  },
};

export const PARTNER_SLUGS = Object.keys(PARTNERS);
