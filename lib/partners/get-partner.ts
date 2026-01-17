import { DEFAULT_PARTNER, PARTNERS } from './config';
import type { PartnerBrand } from './types';

export const getPartnerConfig = (
  slug: string | null | undefined,
): PartnerBrand | null => {
  if (!slug) return null;
  const key = slug.toLowerCase();
  return PARTNERS[key] ?? null;
};

export const getPartner = (slug: string | null | undefined): PartnerBrand => {
  return getPartnerConfig(slug) ?? DEFAULT_PARTNER;
};

export const isPartnerSlug = (slug: string | null | undefined): boolean => {
  return Boolean(getPartnerConfig(slug));
};
