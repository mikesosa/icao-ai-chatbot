import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { Button } from '@/components/ui/button';
import { isActiveSubscriptionStatus } from '@/lib/billing/subscription';
import { getSubscriptionByUserId } from '@/lib/db/queries';

const MONTHLY_PRICE = 17;
const ANNUAL_PRICE = 170;

export default async function Page() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?callbackUrl=%2Fbilling');
  }

  const subscription = await getSubscriptionByUserId(session.user.id);
  const isActive = isActiveSubscriptionStatus(subscription?.status);

  const monthlyCheckoutUrl = process.env.REBILL_CHECKOUT_MONTHLY_URL ?? '';
  const annualCheckoutUrl = process.env.REBILL_CHECKOUT_ANNUAL_URL ?? '';

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
          {isActive && subscription?.currentPeriodEnd && (
            <div className="text-sm text-muted-foreground">
              Renews on{' '}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border p-6 space-y-4">
          <div>
            <div className="text-lg font-semibold">Monthly</div>
            <div className="text-3xl font-semibold">${MONTHLY_PRICE}</div>
            <div className="text-sm text-muted-foreground">per month</div>
          </div>
          <Button asChild disabled={!monthlyCheckoutUrl}>
            <Link href={monthlyCheckoutUrl || '#'}>Subscribe monthly</Link>
          </Button>
          {!monthlyCheckoutUrl && (
            <div className="text-xs text-muted-foreground">
              Configure `REBILL_CHECKOUT_MONTHLY_URL` to enable checkout.
            </div>
          )}
        </div>

        <div className="rounded-xl border p-6 space-y-4">
          <div>
            <div className="text-lg font-semibold">Annual</div>
            <div className="text-3xl font-semibold">${ANNUAL_PRICE}</div>
            <div className="text-sm text-muted-foreground">per year</div>
          </div>
          <Button asChild disabled={!annualCheckoutUrl}>
            <Link href={annualCheckoutUrl || '#'}>Subscribe annually</Link>
          </Button>
          {!annualCheckoutUrl && (
            <div className="text-xs text-muted-foreground">
              Configure `REBILL_CHECKOUT_ANNUAL_URL` to enable checkout.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
