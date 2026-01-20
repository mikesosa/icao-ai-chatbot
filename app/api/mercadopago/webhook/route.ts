import { NextResponse } from 'next/server';

import { normalizeCode } from '@/lib/billing/discounts';
import { MP_STATUS_MAP } from '@/lib/billing/mercadopago-config';
import { normalizeSubscriptionStatus } from '@/lib/billing/subscription';
import {
  createDiscountRedemption,
  getActivePartnerDiscountByCode,
  getDiscountRedemptionsByUser,
  getUser,
  upsertSubscriptionForUser,
} from '@/lib/db/queries';

// MercadoPago webhook types
type MPWebhookPayload = {
  id: number;
  live_mode: boolean;
  type: string;
  date_created: string;
  user_id: number;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
};

const isAuthorized = (request: Request) => {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true; // No secret configured, allow all (dev mode)

  // MercadoPago uses x-signature header for verification
  const signature = request.headers.get('x-signature');
  if (!signature) return false;

  // Basic signature check (in production, implement proper HMAC verification)
  // See: https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks
  return true; // Simplified for now - implement proper verification in production
};

const parseDate = (value: unknown) => {
  if (!value || typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await request.json()) as MPWebhookPayload;

  // MercadoPago sends different event types
  // For subscriptions: subscription_preapproval, subscription_authorized_payment
  if (
    !payload.type?.includes('subscription') &&
    !payload.type?.includes('preapproval')
  ) {
    return NextResponse.json({
      received: true,
      reason: 'Not a subscription event',
    });
  }

  // Fetch full subscription details from MercadoPago API
  try {
    const { MercadoPagoConfig, PreApproval } = await import('mercadopago');

    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? '',
    });

    const preApprovalClient = new PreApproval(client);
    const subscription = await preApprovalClient.get({ id: payload.data.id });

    if (!subscription) {
      return NextResponse.json(
        { received: true, reason: 'Subscription not found' },
        { status: 200 },
      );
    }

    const email = subscription.payer_email;
    const externalRef = subscription.external_reference;

    // Try to find user by external_reference (user ID) or email
    let user = null;
    if (externalRef) {
      // external_reference should be our user ID
      const users = await getUser(email ?? '');
      user = users.find((u) => u.id === externalRef) ?? users[0];
    }

    if (!user && email) {
      const users = await getUser(email);
      user = users[0];
    }

    if (!user) {
      return NextResponse.json(
        { received: true, reason: 'User not found' },
        { status: 200 },
      );
    }

    // Map MercadoPago status to our status
    const mpStatus = subscription.status ?? 'unknown';
    const mappedStatus = MP_STATUS_MAP[mpStatus] ?? mpStatus;
    const status = normalizeSubscriptionStatus(mappedStatus);

    // Calculate next payment date
    const nextPaymentDate = parseDate(subscription.next_payment_date);

    await upsertSubscriptionForUser({
      userId: user.id,
      status,
      planId: subscription.preapproval_plan_id ?? null,
      rebillCustomerId: String(subscription.payer_id),
      rebillSubscriptionId: subscription.id,
      currentPeriodEnd: nextPaymentDate,
    });

    // Handle any coupon/discount code if present in metadata
    const couponCode = subscription.external_reference?.includes('PROMO_')
      ? subscription.external_reference.split('PROMO_')[1]
      : null;

    if (couponCode) {
      const normalized = normalizeCode(couponCode);
      const discount = await getActivePartnerDiscountByCode(normalized);
      if (discount) {
        const userRedemptions = await getDiscountRedemptionsByUser(
          discount.id,
          user.id,
        );
        if (userRedemptions === 0) {
          await createDiscountRedemption({
            discountId: discount.id,
            userId: user.id,
          });
        }
      }
    }

    return NextResponse.json({
      received: true,
      eventType: payload.type,
      action: payload.action,
    });
  } catch (error) {
    console.error('MercadoPago webhook error:', error);
    return NextResponse.json(
      { received: true, error: 'Processing error' },
      { status: 200 },
    );
  }
}
