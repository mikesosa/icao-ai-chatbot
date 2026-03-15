import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFounderWaitlistAlertEmail } from './founder-waitlist-alert-email';

test('buildFounderWaitlistAlertEmail includes signup details', () => {
  const email = buildFounderWaitlistAlertEmail({
    from: 'Vector English <waitlist@example.com>',
    to: 'founder@example.com',
    email: 'pilot@example.com',
    createdAt: new Date('2026-03-15T18:00:00.000Z'),
    source: 'landing',
    appUrl: 'https://vectorenglish.io',
  });

  assert.equal(
    email.subject,
    'VectorEnglish.io waitlist: pilot@example.com joined',
  );
  assert.deepEqual(email.to, ['founder@example.com']);
  assert.match(email.text, /pilot@example\.com/);
  assert.match(email.text, /Source: landing/);
  assert.match(email.text, /2026-03-15T18:00:00\.000Z/);
  assert.match(email.text, /Open app: https:\/\/vectorenglish\.io/);
  assert.match(email.html, /Vector/);
  assert.match(email.html, /English/);
  assert.match(email.html, /New waitlist signup/);
  assert.match(email.html, /Open app/);
  assert.doesNotMatch(email.html, /Reply to lead/);
  assert.doesNotMatch(email.html, /logo\.svg/);
});

test('buildFounderWaitlistAlertEmail escapes HTML content', () => {
  const email = buildFounderWaitlistAlertEmail({
    from: 'Vector English <waitlist@example.com>',
    to: 'founder@example.com',
    email: '<pilot>@example.com',
    createdAt: new Date('2026-03-15T18:00:00.000Z'),
    source: 'landing<script>alert(1)</script>',
    appUrl: 'https://vectorenglish.io',
  });

  assert.doesNotMatch(email.html, /<pilot>/);
  assert.match(email.html, /&lt;pilot&gt;@example\.com/);
  assert.match(email.html, /landing&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
