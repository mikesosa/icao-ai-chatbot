import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import { canRedeemDiscount, normalizeCode } from '@/lib/billing/discounts';
import {
  getActivePartnerDiscountByCode,
  getDiscountRedemptionsByUser,
  getDiscountRedemptionsCount,
} from '@/lib/db/queries';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { isValid: false, reason: 'Unauthorized' },
      { status: 401 },
    );
  }

  const { code } = await request.json();
  const normalizedCode = normalizeCode(code ?? '');

  if (!normalizedCode) {
    return NextResponse.json(
      { isValid: false, reason: 'Promo code is required.' },
      { status: 400 },
    );
  }

  const discount = await getActivePartnerDiscountByCode(normalizedCode);
  if (!discount) {
    return NextResponse.json(
      { isValid: false, reason: 'Invalid promo code.' },
      { status: 404 },
    );
  }

  const [totalRedemptions, userRedemptions] = await Promise.all([
    getDiscountRedemptionsCount(discount.id),
    getDiscountRedemptionsByUser(discount.id, session.user.id),
  ]);

  const validation = canRedeemDiscount({
    discount,
    totalRedemptions,
    userRedemptions,
  });

  if (!validation.isValid) {
    return NextResponse.json(validation, { status: 400 });
  }

  return NextResponse.json({
    isValid: true,
    discount: {
      id: discount.id,
      partnerSlug: discount.partnerSlug,
      code: discount.code,
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      eligiblePlans: discount.eligiblePlans ?? null,
    },
  });
}
