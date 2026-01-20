import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import { getPreApprovalClient } from '@/lib/billing/mercadopago-client';
import { PLAN_CONFIG, type PlanId } from '@/lib/billing/mercadopago-config';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { planId, cardTokenId } = body as {
    planId: PlanId;
    cardTokenId: string;
  };

  if (!planId || !PLAN_CONFIG[planId]) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  if (!cardTokenId) {
    return NextResponse.json(
      { error: 'Card token is required' },
      { status: 400 },
    );
  }

  const plan = PLAN_CONFIG[planId];

  try {
    const preApprovalClient = getPreApprovalClient();

    // Create subscription with or without associated plan
    const subscriptionData = plan.preapprovalPlanId
      ? {
          // With associated plan (preferred)
          preapproval_plan_id: plan.preapprovalPlanId,
          payer_email: session.user.email,
          card_token_id: cardTokenId,
          external_reference: session.user.id,
          status: 'authorized' as const,
        }
      : {
          // Without associated plan (fallback)
          reason: plan.name,
          payer_email: session.user.email,
          card_token_id: cardTokenId,
          external_reference: session.user.id,
          auto_recurring: {
            frequency: plan.frequency,
            frequency_type: plan.frequencyType,
            transaction_amount: plan.amount,
            currency_id: plan.currency,
          },
          status: 'authorized' as const,
          back_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
        };

    const subscription = await preApprovalClient.create({
      body: subscriptionData,
    });

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
    });
  } catch (error) {
    console.error('MercadoPago subscription error:', error);

    const message =
      error instanceof Error ? error.message : 'Failed to create subscription';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
