import { redirect } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { isActiveSubscriptionStatus } from '@/lib/billing/subscription';
import { getSubscriptionByUserId } from '@/lib/db/queries';

import { BillingClientView } from './view';

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
    <BillingClientView
      isActive={isActive}
      currentPeriodEnd={subscription?.currentPeriodEnd ?? null}
      monthlyPrice={MONTHLY_PRICE}
      annualPrice={ANNUAL_PRICE}
      monthlyCheckoutUrl={monthlyCheckoutUrl}
      annualCheckoutUrl={annualCheckoutUrl}
    />
  );
}
