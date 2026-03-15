'use client';

import { type FormEvent, useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle,
  CirclePlay,
  Gauge,
  Globe2,
  Mic,
} from 'lucide-react';

import {
  type LandingTranslations,
  type Locale,
  translations,
} from '@/lib/i18n/landing';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
    },
  },
};

type WaitlistState = 'idle' | 'loading' | 'done' | 'error';

export function LandingPage({ locale }: { locale: Locale }) {
  const t = translations[locale];
  const [email, setEmail] = useState('');
  const [state, setState] = useState<WaitlistState>('idle');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    <div className="relative min-h-dvh overflow-x-hidden bg-[#090b10] text-[#f5f7fb] font-[family-name:var(--font-geist)]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 -top-80 size-[36rem] -translate-x-1/2 rounded-full bg-[#f4c46b]/30 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 size-[28rem] rounded-full bg-[#7dd7de]/20 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_38%),linear-gradient(180deg,#090b10_0%,#111723_45%,#090d14_100%)]" />
      </div>

      <Nav t={t.nav} locale={locale} />

      <main className="relative z-10">
        <Hero
          t={t.hero}
          proof={t.proof}
          email={email}
          state={state}
          setEmail={setEmail}
          onSubmit={handleSubmit}
        />
        <Demo t={t.demo} features={t.features} />
      </main>

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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#090b10]/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <span className="flex items-center text-sm font-semibold tracking-tight">
          <span className="text-[#f4c46b]">Vector</span>
          <span className="text-white">English</span>
        </span>

        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => {
              const next = locale === 'en' ? 'es' : 'en';
              document.cookie = `locale=${next}; path=/; max-age=31536000`;
              window.location.reload();
            }}
            className="rounded-full border border-white/15 px-3 py-1.5 text-white/70 transition-colors hover:text-white"
          >
            {t.toggleLocale}
          </button>

          <a
            href="#waitlist"
            className="hidden rounded-full border border-white/15 px-3 py-1.5 text-white/70 transition-colors hover:text-white sm:inline-flex"
          >
            {t.joinWaitlist}
          </a>

          <Link
            href="/login"
            className="rounded-full bg-white px-3 py-1.5 text-black transition-colors hover:bg-white/90"
          >
            {t.signIn}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({
  t,
  proof,
  email,
  state,
  setEmail,
  onSubmit,
}: {
  t: LandingTranslations['hero'];
  proof: LandingTranslations['proof'];
  email: string;
  state: WaitlistState;
  setEmail: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section
      id="waitlist"
      className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-16 pt-36 text-center sm:pt-44"
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex w-full max-w-4xl flex-col items-center"
      >
        <motion.p
          variants={itemVariants}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-white/70"
        >
          {t.badge}
        </motion.p>

        <motion.h1
          variants={itemVariants}
          className="mt-8 max-w-4xl text-balance text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl"
        >
          {t.headline}
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="mt-6 max-w-2xl text-balance text-base leading-relaxed text-white/70 sm:text-lg"
        >
          {t.subheadline}
        </motion.p>

        <motion.div variants={itemVariants} className="mt-10 w-full max-w-xl">
          {state === 'done' ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
              <CheckCircle className="size-4" />
              {t.success}
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              className="flex w-full flex-col gap-3 rounded-3xl border border-white/15 bg-white/5 p-3 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-md sm:flex-row"
            >
              <label htmlFor="waitlist-email" className="sr-only">
                Email
              </label>
              <input
                id="waitlist-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t.placeholder}
                className="h-12 flex-1 rounded-2xl border border-white/10 bg-[#0d121c] px-4 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-[#f4c46b]"
              />
              <button
                type="submit"
                disabled={state === 'loading'}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#f4c46b] px-6 text-sm font-medium text-[#0a0f18] transition-all hover:bg-[#ffd88f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state === 'loading' ? '...' : t.button}
                <ArrowRight className="size-4" />
              </button>
            </form>
          )}

          {state === 'error' && (
            <p className="mt-3 text-xs text-red-300">{t.error}</p>
          )}

          <p className="mt-4 text-xs text-white/50">{t.footnote}</p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="mt-8 flex flex-col items-center gap-3 sm:flex-row"
        >
          <a
            href="#platform-preview"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/80 transition-colors hover:text-white"
          >
            {t.ctaSecondary}
            <CirclePlay className="size-4" />
          </a>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm text-white/70 transition-colors hover:text-white"
          >
            {t.signInHint}
          </Link>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="mt-10 grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {proof.items.map((item) => (
            <div
              key={item.value}
              className="rounded-2xl border border-white/10 bg-[#0d121c]/80 p-4 text-left backdrop-blur-sm"
            >
              <p className="text-sm font-semibold text-[#f4c46b]">
                {item.value}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-white/60">
                {item.label}
              </p>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}

function Demo({
  t,
  features,
}: {
  t: LandingTranslations['demo'];
  features: LandingTranslations['features'];
}) {
  return (
    <section
      id="platform-preview"
      className="mx-auto w-full max-w-6xl px-6 pb-20 pt-8"
    >
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.25 }}
        variants={containerVariants}
        className="grid items-center gap-8 rounded-3xl border border-white/10 bg-[#0f1522]/70 p-6 backdrop-blur-sm lg:grid-cols-[1.2fr_0.8fr] lg:p-10"
      >
        <motion.div
          variants={itemVariants}
          className="group relative overflow-hidden rounded-2xl border border-white/10"
        >
          <Image
            src="/images/demo-thumbnail.png"
            alt="VectorEnglish platform preview"
            width={1200}
            height={750}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090b10]/80 via-transparent to-transparent" />
          <div className="absolute bottom-4 inset-x-4 flex items-center justify-between rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-xs text-white/85 backdrop-blur-sm">
            <span>{t.watchLabel}</span>
            <span>{t.duration}</span>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">
            {t.sectionLabel}
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t.heading}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70 sm:text-base">
            {t.body}
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#f4c46b] px-5 py-2.5 text-sm font-medium text-[#0a0f18] transition-colors hover:bg-[#ffd88f]"
          >
            {t.watchLabel}
            <ArrowRight className="size-4" />
          </Link>

          <div className="mt-8 space-y-3">
            {features.map(({ title, description }, index) => {
              const icons = [Mic, Globe2, Gauge];
              const Icon = icons[index];

              return (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0b111d] p-4"
                >
                  <div className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#f4c46b]">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-white">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/60">
                      {description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function Footer({ t }: { t: LandingTranslations['footer'] }) {
  return (
    <footer className="border-t border-white/10 px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
        <span>{t.brand}</span>
        <span>{t.note}</span>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
