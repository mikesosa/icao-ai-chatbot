'use client';

import { useState } from 'react';

import Link from 'next/link';

import { CheckCircle, Mic, Radio, Zap } from 'lucide-react';

import {
  type LandingTranslations,
  type Locale,
  translations,
} from '@/lib/i18n/landing';

export function LandingPage({ locale }: { locale: Locale }) {
  const t = translations[locale];
  return (
    <div className="min-h-dvh bg-black text-white font-[family-name:var(--font-geist)]">
      <Nav t={t.nav} locale={locale} />
      <Hero t={t.hero} />
      <Features t={t.features} />
      <HowItWorks t={t.howItWorks} />
      <Waitlist t={t.waitlist} />
      <Footer t={t.footer} />
    </div>
  );
}

function Nav({
  t,
  locale,
}: {
  t: LandingTranslations['nav'];
  locale: Locale;
}) {
  return (
    <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/80 backdrop-blur-md">
      <span className="text-sm font-semibold tracking-tight">AeroChat</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => {
            const next = locale === 'en' ? 'es' : 'en';
            document.cookie = `locale=${next}; path=/; max-age=31536000`;
            window.location.reload();
          }}
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          {t.toggleLocale}
        </button>
        <Link
          href="/login"
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          {t.signIn}
        </Link>
      </div>
    </header>
  );
}

function Hero({ t }: { t: LandingTranslations['hero'] }) {
  const [line1, line2] = t.headline.split('\n');
  return (
    <section className="flex flex-col items-center justify-center text-center px-6 pt-40 pb-32 gap-8">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/50 tracking-widest uppercase">
        {t.badge}
      </div>

      <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.1] max-w-2xl text-balance">
        {line1}
        <br />
        {line2}
      </h1>

      <p className="text-white/50 text-base sm:text-lg max-w-md leading-relaxed">
        {t.subheadline}
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
        <Link
          href="/login"
          className="px-6 py-3 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
        >
          {t.ctaPrimary}
        </Link>
        <a
          href="#waitlist"
          className="px-6 py-3 rounded-full border border-white/15 text-sm text-white/70 hover:border-white/30 hover:text-white transition-colors"
        >
          {t.ctaSecondary}
        </a>
      </div>

      <p className="text-xs text-white/25 mt-2">{t.footnote}</p>
    </section>
  );
}

function Features({ t }: { t: LandingTranslations['features'] }) {
  const icons = [Mic, Radio, Zap];
  return (
    <section className="px-6 py-24 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
        {t.map(({ title, description }, i) => {
          const Icon = icons[i];
          return (
            <div key={title} className="bg-black p-8 flex flex-col gap-4">
              <div className="size-9 rounded-lg bg-white/5 flex items-center justify-center">
                <Icon className="size-4 text-white/60" />
              </div>
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">
                {description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HowItWorks({ t }: { t: LandingTranslations['howItWorks'] }) {
  const numbers = ['01', '02', '03'];
  return (
    <section className="px-6 py-24 max-w-5xl mx-auto">
      <p className="text-xs text-white/30 uppercase tracking-widest text-center mb-16">
        {t.sectionLabel}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-12">
        {t.steps.map(({ title, body }, i) => (
          <div key={numbers[i]} className="flex flex-col gap-4">
            <span className="text-3xl font-semibold text-white/10">
              {numbers[i]}
            </span>
            <h3 className="text-sm font-medium">{title}</h3>
            <p className="text-sm text-white/40 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Waitlist({ t }: { t: LandingTranslations['waitlist'] }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>(
    'idle',
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || state === 'loading') return;
    setState('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
    <section
      id="waitlist"
      className="px-6 py-32 flex flex-col items-center text-center gap-8"
    >
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {t.heading}
          </h2>
          <p className="text-white/40 text-sm mt-3">{t.description}</p>
        </div>

        {state === 'done' ? (
          <div className="flex items-center gap-2 text-sm text-white/60">
            <CheckCircle className="size-4 text-green-500" />
            {t.success}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex w-full max-w-sm gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.placeholder}
              className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25 transition-colors"
            />
            <button
              type="submit"
              disabled={state === 'loading'}
              className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-50 transition-colors shrink-0"
            >
              {state === 'loading' ? '...' : t.button}
            </button>
          </form>
        )}

        {state === 'error' && (
          <p className="text-xs text-red-400/80">{t.error}</p>
        )}

        <p className="text-xs text-white/20">{t.footnote}</p>
      </div>
    </section>
  );
}

function Footer({ t }: { t: LandingTranslations['footer'] }) {
  return (
    <footer className="border-t border-white/5 px-6 py-8 flex items-center justify-between">
      <span className="text-xs text-white/20">{t.brand}</span>
      <span className="text-xs text-white/20">
        © {new Date().getFullYear()}
      </span>
    </footer>
  );
}
