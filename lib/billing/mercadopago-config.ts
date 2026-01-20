// MercadoPago Configuration
// Docs: https://www.mercadopago.com/developers/en/docs/subscriptions

export const MERCADOPAGO_CONFIG = {
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? '',
  webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? '',
} as const;

// Plan IDs from MercadoPago dashboard (required)
const MONTHLY_PLAN_ID = process.env.MERCADOPAGO_MONTHLY_PLAN_ID ?? '';
const ANNUAL_PLAN_ID = process.env.MERCADOPAGO_ANNUAL_PLAN_ID ?? '';

const buildCheckoutUrl = (planId: string) =>
  planId
    ? `https://www.mercadopago.com.co/subscriptions/checkout?preapproval_plan_id=${planId}`
    : '';

export const PLAN_CONFIG = {
  monthly: {
    id: 'monthly',
    name: 'ICAO Exam Simulator - Mensual',
    preapprovalPlanId: MONTHLY_PLAN_ID,
    checkoutUrl: buildCheckoutUrl(MONTHLY_PLAN_ID),
    amount: 70000,
    currency: 'COP' as const,
    displayPrice: '$70.000',
    frequency: 1,
    frequencyType: 'months' as const,
  },
  annual: {
    id: 'annual',
    name: 'ICAO Exam Simulator - Anual',
    preapprovalPlanId: ANNUAL_PLAN_ID,
    checkoutUrl: buildCheckoutUrl(ANNUAL_PLAN_ID),
    amount: 700000,
    currency: 'COP' as const,
    displayPrice: '$700.000',
    frequency: 12,
    frequencyType: 'months' as const,
  },
} as const;

export const isBillingConfigured = () =>
  Boolean(MONTHLY_PLAN_ID && ANNUAL_PLAN_ID);

export type PlanId = keyof typeof PLAN_CONFIG;

// Subscription status mapping from MercadoPago to our internal status
export const MP_STATUS_MAP: Record<string, string> = {
  authorized: 'active',
  pending: 'pending',
  paused: 'paused',
  cancelled: 'canceled',
  canceled: 'canceled',
} as const;
