'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';

type CheckoutUrls = {
  monthly: string;
  annual: string;
};

type BillingClientViewProps = {
  isActive: boolean;
  currentPeriodEnd: Date | null;
  checkoutUrls: CheckoutUrls;
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

// Static plan display info (no env vars needed)
const PLANS = {
  monthly: {
    name: 'Monthly',
    displayPrice: '$70.000',
    interval: 'month' as const,
    trialDays: 7,
  },
  annual: {
    name: 'Annual',
    displayPrice: '$700.000',
    interval: 'year' as const,
    trialDays: 7,
  },
};

export function BillingClientView({
  isActive,
  currentPeriodEnd,
  checkoutUrls,
}: BillingClientViewProps) {
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState<DiscountState>({ status: 'idle' });

  const isBillingConfigured = checkoutUrls.monthly && checkoutUrls.annual;

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

      {!isActive && (
        <>
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
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <PlanCard
              name={PLANS.monthly.name}
              price={PLANS.monthly.displayPrice}
              interval={PLANS.monthly.interval}
              checkoutUrl={checkoutUrls.monthly}
              trialDays={PLANS.monthly.trialDays}
            />
            <PlanCard
              name={PLANS.annual.name}
              price={PLANS.annual.displayPrice}
              interval={PLANS.annual.interval}
              checkoutUrl={checkoutUrls.annual}
              trialDays={PLANS.annual.trialDays}
              highlight
            />
          </div>

          {isBillingConfigured ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Prices in Colombian Pesos (COP). 7-day free trial included.
              <br />
              Secure payment powered by MercadoPago.
            </p>
          ) : (
            <div className="mt-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-700">
              Payment system not configured. Set{' '}
              <code className="rounded bg-amber-500/20 px-1">
                MERCADOPAGO_MONTHLY_PLAN_ID
              </code>{' '}
              and{' '}
              <code className="rounded bg-amber-500/20 px-1">
                MERCADOPAGO_ANNUAL_PLAN_ID
              </code>{' '}
              environment variables.
            </div>
          )}
        </>
      )}
    </main>
  );
}

type PlanCardProps = {
  name: string;
  price: string;
  interval: 'month' | 'year';
  checkoutUrl: string;
  trialDays?: number;
  highlight?: boolean;
};

function PlanCard({
  name,
  price,
  interval,
  checkoutUrl,
  trialDays,
  highlight,
}: PlanCardProps) {
  return (
    <div
      className={`rounded-xl border p-6 space-y-4 ${
        highlight ? 'border-primary ring-1 ring-primary' : ''
      }`}
    >
      <div>
        <div className="flex items-center gap-2">
          <div className="text-lg font-semibold">{name}</div>
          {highlight && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Save 17%
            </span>
          )}
        </div>
        <div className="text-3xl font-semibold">{price}</div>
        <div className="text-sm text-muted-foreground">
          per {interval}
          {trialDays && ` • ${trialDays} days free`}
        </div>
      </div>

      {checkoutUrl ? (
        <Button asChild className="w-full">
          <a href={checkoutUrl}>Subscribe {name.toLowerCase()}</a>
        </Button>
      ) : (
        <Button disabled className="w-full">
          Subscribe {name.toLowerCase()}
        </Button>
      )}
    </div>
  );
}
