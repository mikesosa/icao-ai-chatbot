import { MercadoPagoConfig, PreApproval, PreApprovalPlan } from 'mercadopago';

import { MERCADOPAGO_CONFIG } from './mercadopago-config';

// Server-side MercadoPago client
// Only use this in server components or API routes

let client: MercadoPagoConfig | null = null;

export function getMercadoPagoClient(): MercadoPagoConfig {
  if (!client) {
    if (!MERCADOPAGO_CONFIG.accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN is not configured');
    }
    client = new MercadoPagoConfig({
      accessToken: MERCADOPAGO_CONFIG.accessToken,
    });
  }
  return client;
}

export function getPreApprovalClient(): PreApproval {
  return new PreApproval(getMercadoPagoClient());
}

export function getPreApprovalPlanClient(): PreApprovalPlan {
  return new PreApprovalPlan(getMercadoPagoClient());
}

// Types for MercadoPago responses
export type MPSubscriptionStatus =
  | 'pending'
  | 'authorized'
  | 'paused'
  | 'cancelled';

export type MPSubscription = {
  id: string;
  payer_id: number;
  payer_email: string;
  status: MPSubscriptionStatus;
  preapproval_plan_id?: string;
  auto_recurring: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
  };
  next_payment_date?: string;
  date_created: string;
  external_reference?: string;
};
