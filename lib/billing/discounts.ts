import type { PartnerDiscount } from '@/lib/db/schema';

export type DiscountValidationResult =
  | {
      isValid: true;
      discount: PartnerDiscount;
    }
  | {
      isValid: false;
      reason: string;
    };

export const parseIntOrNull = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const normalizeCode = (code: string) => code.trim().toUpperCase();

export const canRedeemDiscount = ({
  discount,
  totalRedemptions,
  userRedemptions,
}: {
  discount: PartnerDiscount;
  totalRedemptions: number;
  userRedemptions: number;
}): DiscountValidationResult => {
  const maxTotal = parseIntOrNull(discount.maxRedemptions);
  if (maxTotal !== null && totalRedemptions >= maxTotal) {
    return { isValid: false, reason: 'This promo code has reached its limit.' };
  }

  const maxPerUser = parseIntOrNull(discount.maxRedemptionsPerUser);
  if (maxPerUser !== null && userRedemptions >= maxPerUser) {
    return {
      isValid: false,
      reason: 'You have already used this promo code.',
    };
  }

  return { isValid: true, discount };
};
