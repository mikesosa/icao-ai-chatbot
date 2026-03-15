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
  const logoUrl = normalizedAppUrl
    ? `${normalizedAppUrl.replace(/\/$/, '')}/logo.svg`
    : null;
  const escapedLogoUrl = logoUrl ? escapeHtml(logoUrl) : null;
  const mailtoUrl = `mailto:${encodeURIComponent(email)}`;
  const escapedMailtoUrl = escapeHtml(mailtoUrl);
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
      '',
      `Reply to lead: ${mailtoUrl}`,
      ...(normalizedAppUrl ? ['', `Open app: ${normalizedAppUrl}`] : []),
    ].join('\n'),
    html: [
      '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">',
      escapedPreviewText,
      '</div>',
      '<div style="margin:0;padding:28px 18px;background:#efe7d8;">',
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">',
      '<tr>',
      '<td align="center">',
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;">',
      '<tr>',
      '<td style="padding:0 0 16px 0;text-align:center;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#6b7280;">',
      'Founder Notification',
      '</td>',
      '</tr>',
      '<tr>',
      '<td style="background:#0b1018;border-top:6px solid #f4c46b;border-radius:32px 32px 0 0;padding:28px 28px 24px 28px;">',
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">',
      '<tr>',
      '<td style="vertical-align:top;">',
      '<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">',
      '<tr>',
      '<td style="width:52px;height:52px;border-radius:18px;background:#f4c46b;color:#111827;font-size:22px;font-weight:800;text-align:center;">VE</td>',
      '<td style="padding-left:14px;vertical-align:middle;">',
      '<div style="font-size:13px;line-height:1.2;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#f4c46b;">Waitlist Alert</div>',
      '<div style="padding-top:6px;font-size:26px;line-height:1;font-weight:800;color:#ffffff;">',
      '<span style="color:#f4c46b;">Vector</span><span style="color:#ffffff;">English</span><span style="color:rgba(255,255,255,0.28);">.io</span>',
      '</div>',
      '</td>',
      '</tr>',
      '</table>',
      '</td>',
      escapedLogoUrl
        ? `<td align="right" style="vertical-align:top;"><img src="${escapedLogoUrl}" alt="${BRAND_NAME}" width="124" style="display:block;width:124px;max-width:100%;height:auto;border:0;opacity:0.92;" /></td>`
        : '',
      '</tr>',
      '</table>',
      '<h1 style="margin:24px 0 10px 0;font-size:36px;line-height:1.02;color:#ffffff;font-weight:800;letter-spacing:-0.03em;">Another future user just joined</h1>',
      '<p style="margin:0;font-size:16px;line-height:1.65;color:rgba(255,255,255,0.74);">',
      'A new waitlist lead landed in your inbox. The email below is ready for a follow-up.',
      '</p>',
      '<div style="margin-top:22px;padding:18px 20px;border-radius:22px;background:#111827;border:1px solid rgba(255,255,255,0.08);">',
      '<div style="font-size:12px;line-height:1.2;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">New lead</div>',
      `<div style="padding-top:8px;font-size:28px;line-height:1.15;font-weight:800;color:#ffffff;word-break:break-word;">${escapedEmail}</div>`,
      '</div>',
      '</td>',
      '</tr>',
      '<tr>',
      '<td style="background:#ffffff;border-radius:0 0 32px 32px;padding:28px 28px 30px 28px;border:1px solid #e5e7eb;border-top:none;">',
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 12px;">',
      '<tr>',
      '<td style="width:132px;padding:14px 16px;border-radius:18px;background:#f8fafc;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Lead email</td>',
      `<td style="padding:14px 16px;border-radius:18px;background:#fff7e6;font-size:18px;font-weight:700;color:#111827;"><a href="${escapedMailtoUrl}" style="color:#0f172a;text-decoration:none;">${escapedEmail}</a></td>`,
      '</tr>',
      '<tr>',
      '<td style="width:132px;padding:14px 16px;border-radius:18px;background:#f8fafc;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Source</td>',
      `<td style="padding:14px 16px;border-radius:18px;background:#f9fafb;font-size:16px;color:#111827;">${escapedSource}</td>`,
      '</tr>',
      '<tr>',
      '<td style="width:132px;padding:14px 16px;border-radius:18px;background:#f8fafc;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Signed up at</td>',
      `<td style="padding:14px 16px;border-radius:18px;background:#f9fafb;font-size:16px;color:#111827;">${escapedTimestamp}</td>`,
      '</tr>',
      '</table>',
      '<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px;border-collapse:collapse;">',
      '<tr>',
      `<td style="padding:0 10px 0 0;"><a href="${escapedMailtoUrl}" style="display:inline-block;padding:14px 20px;border-radius:14px;background:#111827;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Reply to lead</a></td>`,
      normalizedAppUrl
        ? `<td style="padding:0;"><a href="${escapedAppUrl}" style="display:inline-block;padding:14px 20px;border-radius:14px;background:#f4c46b;color:#111827;font-size:15px;font-weight:800;text-decoration:none;">Open ${BRAND_NAME}</a></td>`
        : '',
      '</tr>',
      '</table>',
      '<p style="margin:22px 0 0 0;font-size:13px;line-height:1.6;color:#6b7280;">',
      'Generated automatically from the public waitlist form so you can follow up fast while the interest is fresh.',
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
