import { redirect } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { isActiveSubscriptionStatus } from '@/lib/billing/subscription';
import { getSubscriptionByUserId } from '@/lib/db/queries';

import { BillingClientView } from './view';

// Build checkout URLs on server where env vars are available
function getCheckoutUrls() {
  const monthlyPlanId = process.env.MERCADOPAGO_MONTHLY_PLAN_ID ?? '';
  const annualPlanId = process.env.MERCADOPAGO_ANNUAL_PLAN_ID ?? '';

  return {
    monthly: monthlyPlanId
      ? `https://www.mercadopago.com.co/subscriptions/checkout?preapproval_plan_id=${monthlyPlanId}`
      : '',
    annual: annualPlanId
      ? `https://www.mercadopago.com.co/subscriptions/checkout?preapproval_plan_id=${annualPlanId}`
      : '',
  };
}

export default async function Page() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?callbackUrl=%2Fbilling');
  }

  const subscription = await getSubscriptionByUserId(session.user.id);
  const isActive = isActiveSubscriptionStatus(subscription?.status);
  const checkoutUrls = getCheckoutUrls();

  return (
    <BillingClientView
      isActive={isActive}
      currentPeriodEnd={subscription?.currentPeriodEnd ?? null}
      checkoutUrls={checkoutUrls}
    />
  );
}
