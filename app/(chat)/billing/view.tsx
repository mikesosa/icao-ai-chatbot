'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { Button } from '@/components/ui/button';

type BillingClientViewProps = {
  isActive: boolean;
  currentPeriodEnd: Date | null;
  monthlyPrice: number;
  annualPrice: number;
  monthlyCheckoutUrl: string;
  annualCheckoutUrl: string;
};

type DiscountState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'applied';
      code: string;
      discountType: string;
      discountValue: string;
      eligiblePlans: string[] | null;
    }
  | { status: 'error'; message: string };

export function BillingClientView({
  isActive,
  currentPeriodEnd,
  monthlyPrice,
  annualPrice,
  monthlyCheckoutUrl,
  annualCheckoutUrl,
}: BillingClientViewProps) {
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState<DiscountState>({ status: 'idle' });
  const appliedCode = discount.status === 'applied' ? discount.code : null;

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      setDiscount({ status: 'error', message: 'Enter a promo code.' });
      return;
    }

    setDiscount({ status: 'loading' });
    try {
      const response = await fetch('/api/billing/discount/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDiscount({
          status: 'error',
          message: data?.reason ?? 'Invalid promo code.',
        });
        return;
      }

      setDiscount({
        status: 'applied',
        code: data.discount.code ?? promoCode.toUpperCase(),
        discountType: data.discount.discountType,
        discountValue: data.discount.discountValue,
        eligiblePlans: data.discount.eligiblePlans,
      });
    } catch {
      setDiscount({
        status: 'error',
        message: 'Unable to validate promo code. Try again.',
      });
    }
  };

  const discountMessage = useMemo(() => {
    if (discount.status !== 'applied') return null;
    const scope = discount.eligiblePlans?.length
      ? `Applies to: ${discount.eligiblePlans.join(', ')}`
      : 'Applies to all plans.';
    return `Applied ${discount.code} (${discount.discountValue}${
      discount.discountType === 'percent' ? '%' : ''
    } off). ${scope}`;
  }, [discount]);

  const buildCheckoutUrl = (baseUrl: string, code: string | null) => {
    if (!baseUrl) return '';
    if (!code) return baseUrl;
    if (baseUrl.includes('{{coupon}}')) {
      return baseUrl.replace('{{coupon}}', encodeURIComponent(code));
    }
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}coupon=${encodeURIComponent(code)}`;
  };

  const eligiblePlans =
    discount.status === 'applied' ? discount.eligiblePlans : null;
  const canApplyMonthly = !eligiblePlans || eligiblePlans.includes('monthly');
  const canApplyAnnual = !eligiblePlans || eligiblePlans.includes('annual');

  const monthlyUrl = buildCheckoutUrl(
    monthlyCheckoutUrl,
    canApplyMonthly ? appliedCode : null,
  );
  const annualUrl = buildCheckoutUrl(
    annualCheckoutUrl,
    canApplyAnnual ? appliedCode : null,
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold">Billing</h1>
        <p className="text-muted-foreground">
          Access all exams with an active subscription.
        </p>
      </div>

      <div className="mt-8 rounded-xl border p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Status</div>
            <div className="text-lg font-semibold">
              {isActive ? 'Active subscription' : 'No active subscription'}
            </div>
          </div>
          {isActive && currentPeriodEnd && (
            <div className="text-sm text-muted-foreground">
              Renews on {new Date(currentPeriodEnd).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 rounded-xl border p-6 space-y-4">
        <div className="text-sm font-semibold">Promo code</div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value)}
            placeholder="Enter promo code"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button
            onClick={handleApplyPromo}
            disabled={discount.status === 'loading'}
          >
            Apply
          </Button>
        </div>
        {discount.status === 'error' && (
          <div className="text-sm text-destructive">{discount.message}</div>
        )}
        {discountMessage && (
          <div className="text-sm text-emerald-600">{discountMessage}</div>
        )}
        {discount.status === 'applied' &&
          !monthlyCheckoutUrl.includes('{{coupon}}') &&
          !annualCheckoutUrl.includes('{{coupon}}') && (
            <div className="text-xs text-muted-foreground">
              If your Rebill checkout link supports a coupon placeholder, use
              <span className="font-semibold"> {'{{coupon}}'} </span>
              in the URL to auto-apply this code.
            </div>
          )}
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border p-6 space-y-4">
          <div>
            <div className="text-lg font-semibold">Monthly</div>
            <div className="text-3xl font-semibold">${monthlyPrice}</div>
            <div className="text-sm text-muted-foreground">per month</div>
          </div>
          <Button asChild disabled={!monthlyUrl}>
            <Link href={monthlyUrl || '#'}>Subscribe monthly</Link>
          </Button>
          {!monthlyUrl && (
            <div className="text-xs text-muted-foreground">
              Configure `REBILL_CHECKOUT_MONTHLY_URL` to enable checkout.
            </div>
          )}
        </div>

        <div className="rounded-xl border p-6 space-y-4">
          <div>
            <div className="text-lg font-semibold">Annual</div>
            <div className="text-3xl font-semibold">${annualPrice}</div>
            <div className="text-sm text-muted-foreground">per year</div>
          </div>
          <Button asChild disabled={!annualUrl}>
            <Link href={annualUrl || '#'}>Subscribe annually</Link>
          </Button>
          {!annualUrl && (
            <div className="text-xs text-muted-foreground">
              Configure `REBILL_CHECKOUT_ANNUAL_URL` to enable checkout.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
