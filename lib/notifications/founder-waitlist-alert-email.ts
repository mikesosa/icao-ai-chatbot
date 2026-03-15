const BRAND_NAME = 'VectorEnglish.io';

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
  appUrl,
}: {
  from: string;
  to: string;
  appUrl?: string | null;
} & Omit<FounderWaitlistAlert, 'id'>): FounderWaitlistAlertEmail {
  const normalizedSource = source?.trim() || 'landing';
  const timestamp = createdAt.toISOString();
  const escapedEmail = escapeHtml(email);
  const escapedSource = escapeHtml(normalizedSource);
  const escapedTimestamp = escapeHtml(timestamp);
  const normalizedAppUrl = appUrl?.trim() || null;
  const escapedAppUrl = normalizedAppUrl ? escapeHtml(normalizedAppUrl) : null;
  const previewText = `${email} just joined the waitlist from ${normalizedSource}.`;
  const escapedPreviewText = escapeHtml(previewText);
  const subject = `${BRAND_NAME} waitlist: ${email} joined`;

  return {
    from,
    to: [to],
    subject,
    text: [
      `${email} joined the ${BRAND_NAME} waitlist.`,
      '',
      `Email: ${email}`,
      `Source: ${normalizedSource}`,
      `Created at: ${timestamp}`,
      ...(normalizedAppUrl ? ['', `Open app: ${normalizedAppUrl}`] : []),
    ].join('\n'),
    html: [
      '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">',
      escapedPreviewText,
      '</div>',
      '<div style="margin:0;padding:28px 18px;background:#f5f1e8;">',
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">',
      '<tr>',
      '<td align="center">',
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;">',
      '<tr>',
      '<td style="padding:0 0 14px 0;text-align:center;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">',
      'Founder Notification',
      '</td>',
      '</tr>',
      '<tr>',
      '<td style="background:#ffffff;border-radius:24px;padding:28px;border:1px solid #e7e0d3;">',
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">',
      '<tr>',
      '<td style="vertical-align:middle;">',
      '<div style="font-size:14px;line-height:1.2;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#a16207;">Waitlist Alert</div>',
      '<div style="padding-top:8px;font-size:28px;line-height:1;font-weight:800;color:#111827;">',
      '<span style="color:#c28d1a;">Vector</span><span style="color:#111827;">English</span><span style="color:#9ca3af;">.io</span>',
      '</div>',
      '</td>',
      '</tr>',
      '</table>',
      '<h1 style="margin:24px 0 10px 0;font-size:30px;line-height:1.08;color:#111827;font-weight:800;letter-spacing:-0.03em;">New waitlist signup</h1>',
      '<p style="margin:0 0 22px 0;font-size:16px;line-height:1.6;color:#4b5563;">',
      'Someone joined the waitlist. Here are the details.',
      '</p>',
      '<div style="padding:18px 20px;border-radius:18px;background:#fff8ea;border:1px solid #f1dfb1;">',
      '<div style="font-size:12px;line-height:1.2;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8b6b16;">Lead email</div>',
      `<div style="padding-top:8px;font-size:24px;line-height:1.2;font-weight:800;color:#111827;word-break:break-word;">${escapedEmail}</div>`,
      '</div>',
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;border-collapse:separate;border-spacing:0 10px;">',
      '<tr>',
      '<td style="width:132px;padding:12px 14px;border-radius:14px;background:#f7f7f5;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Source</td>',
      `<td style="padding:12px 14px;border-radius:14px;background:#f7f7f5;font-size:16px;color:#111827;">${escapedSource}</td>`,
      '</tr>',
      '<tr>',
      '<td style="width:132px;padding:12px 14px;border-radius:14px;background:#f7f7f5;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Signed up at</td>',
      `<td style="padding:12px 14px;border-radius:14px;background:#f7f7f5;font-size:16px;color:#111827;">${escapedTimestamp}</td>`,
      '</tr>',
      '</table>',
      normalizedAppUrl
        ? `<div style="margin-top:22px;"><a href="${escapedAppUrl}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#ffffff;color:#111827;font-size:15px;font-weight:700;text-decoration:none;border:1px solid #d1d5db;">Open app</a></div>`
        : '',
      '<p style="margin:20px 0 0 0;font-size:13px;line-height:1.6;color:#6b7280;">',
      'Generated automatically from the public waitlist form.',
      '</p>',
      '</td>',
      '</tr>',
      '</table>',
      '</td>',
      '</tr>',
      '</table>',
      '</div>',
    ].join(''),
  };
}
