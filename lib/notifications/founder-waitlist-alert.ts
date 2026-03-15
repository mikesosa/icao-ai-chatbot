import 'server-only';

import nodemailer from 'nodemailer';

import {
  type FounderWaitlistAlert,
  buildFounderWaitlistAlertEmail,
} from './founder-waitlist-alert-email';

export async function sendFounderWaitlistAlert(
  signup: FounderWaitlistAlert,
): Promise<void> {
  const gmailUser = process.env.GMAIL_SMTP_USER;
  const gmailAppPassword = process.env.GMAIL_SMTP_APP_PASSWORD;
  const to = process.env.WAITLIST_ALERT_TO_EMAIL;

  if (!gmailUser || !gmailAppPassword || !to) {
    console.warn(
      'Founder waitlist alert skipped because GMAIL_SMTP_USER, GMAIL_SMTP_APP_PASSWORD, or WAITLIST_ALERT_TO_EMAIL is missing.',
    );
    return;
  }

  const email = buildFounderWaitlistAlertEmail({
    from: gmailUser,
    to,
    email: signup.email,
    createdAt: signup.createdAt,
    source: signup.source,
  });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  await transporter.sendMail({
    from: email.from,
    to: email.to.join(', '),
    subject: email.subject,
    text: email.text,
    html: email.html,
    headers: {
      'X-Waitlist-Signup-Id': signup.id,
    },
  });
}
