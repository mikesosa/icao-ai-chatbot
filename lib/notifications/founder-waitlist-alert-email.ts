const WAITLIST_ALERT_SUBJECT = 'New waitlist signup';

export type FounderWaitlistAlert = {
  id: string;
  email: string;
  createdAt: Date;
  source: string | null;
};

type FounderWaitlistAlertEmail = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildFounderWaitlistAlertEmail({
  from,
  to,
  email,
  createdAt,
  source,
}: {
  from: string;
  to: string;
} & Omit<FounderWaitlistAlert, 'id'>): FounderWaitlistAlertEmail {
  const normalizedSource = source?.trim() || 'landing';
  const timestamp = createdAt.toISOString();
  const escapedEmail = escapeHtml(email);
  const escapedSource = escapeHtml(normalizedSource);
  const escapedTimestamp = escapeHtml(timestamp);

  return {
    from,
    to: [to],
    subject: WAITLIST_ALERT_SUBJECT,
    text: [
      'A new user joined the waitlist.',
      '',
      `Email: ${email}`,
      `Source: ${normalizedSource}`,
      `Created at: ${timestamp}`,
    ].join('\n'),
    html: [
      '<p>A new user joined the waitlist.</p>',
      '<ul>',
      `<li><strong>Email:</strong> ${escapedEmail}</li>`,
      `<li><strong>Source:</strong> ${escapedSource}</li>`,
      `<li><strong>Created at:</strong> ${escapedTimestamp}</li>`,
      '</ul>',
    ].join(''),
  };
}
