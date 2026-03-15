'use client';

import { type FormEvent, useState } from 'react';

import Link from 'next/link';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle,
  ChevronDown,
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
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55 } },
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
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 -top-64 size-[42rem] -translate-x-1/2 rounded-full bg-[#f4c46b]/25 blur-[130px]" />
        <div className="absolute -right-40 top-1/3 size-[32rem] rounded-full bg-[#7dd7de]/15 blur-[130px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_40%),linear-gradient(180deg,#090b10_0%,#0d1220_50%,#090b10_100%)]" />
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
        <FAQ t={t.faq} />
        <FinalCta t={t.finalCta} />
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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#090b10]/85 backdrop-blur-xl">
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
            className="rounded-full border border-white/15 px-3 py-1.5 text-white/60 transition-colors hover:text-white"
          >
            {t.toggleLocale}
          </button>

          <a
            href="#waitlist"
            className="hidden rounded-full border border-white/15 px-3 py-1.5 text-white/60 transition-colors hover:text-white sm:inline-flex"
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
      className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-20 pt-36 text-center sm:pt-44"
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex w-full max-w-4xl flex-col items-center"
      >
        {/* Badge */}
        <motion.p
          variants={itemVariants}
          className="rounded-full border border-[#f4c46b]/25 bg-[#f4c46b]/8 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-[#f4c46b]/80"
        >
          {t.badge}
        </motion.p>

        {/* Headline */}
        <motion.h1
          variants={itemVariants}
          className="mt-7 max-w-4xl text-balance text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl"
        >
          {t.headline}
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          variants={itemVariants}
          className="mt-6 max-w-xl text-balance text-base leading-relaxed text-white/60 sm:text-lg"
        >
          {t.subheadline}
        </motion.p>

        {/* Form */}
        <motion.div variants={itemVariants} className="mt-10 w-full max-w-lg">
          {state === 'done' ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-5 py-3 text-sm text-emerald-300">
              <CheckCircle className="size-4" />
              {t.success}
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              className="flex w-full flex-col gap-3 rounded-2xl border border-white/12 bg-white/4 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-md sm:flex-row sm:gap-2.5 sm:p-2.5"
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
                className="h-14 w-full rounded-xl border border-white/10 bg-[#0d121c] px-5 text-base text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#f4c46b]/50 sm:h-11 sm:flex-1 sm:px-4 sm:text-sm"
              />
              <button
                type="submit"
                disabled={state === 'loading'}
                className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#f4c46b] px-6 text-base font-medium text-[#0a0f18] transition-all hover:bg-[#ffd88f] disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:px-5 sm:text-sm"
              >
                {state === 'loading' ? '...' : t.button}
                <ArrowRight className="size-4" />
              </button>
            </form>
          )}

          {state === 'error' && (
            <p className="mt-3 text-xs text-red-400/80">{t.error}</p>
          )}
          <p className="mt-3 text-xs text-white/35">{t.footnote}</p>
        </motion.div>

        {/* Secondary CTAs */}
        <motion.div
          variants={itemVariants}
          className="mt-6 flex flex-col items-center gap-2 sm:flex-row"
        >
          <a
            href="#platform-preview"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white"
          >
            {t.ctaSecondary}
            <CirclePlay className="size-4" />
          </a>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm text-white/45 transition-colors hover:text-white/70"
          >
            {t.signInHint}
          </Link>
        </motion.div>

        {/* Proof cards */}
        <motion.div
          variants={itemVariants}
          className="mt-14 grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {proof.items.map((item) => (
            <div
              key={item.value}
              className="rounded-2xl border border-white/8 bg-[#0d121c]/60 p-5 text-left backdrop-blur-sm"
            >
              <div className="mb-3 size-1.5 rounded-full bg-[#f4c46b]" />
              <p className="text-base font-semibold text-white">{item.value}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/50">
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
  const waveHeights = [
    14, 22, 18, 30, 26, 20, 34, 24, 16, 28, 32, 20, 14, 26, 30, 18, 24, 34, 20,
    16, 28, 22, 18, 14,
  ];

  return (
    <section
      id="platform-preview"
      className="mx-auto w-full max-w-6xl px-6 pb-24 pt-4"
    >
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={containerVariants}
        className="grid items-center gap-8 rounded-3xl border border-white/10 bg-[#0d1220]/80 p-6 backdrop-blur-sm lg:grid-cols-[1.1fr_0.9fr] lg:p-10"
      >
        {/* UI Mockup */}
        <motion.div
          variants={itemVariants}
          className="relative order-2 overflow-hidden rounded-2xl border border-white/10 bg-[#090b10] lg:order-1"
        >
          {/* Window chrome */}
          <div className="flex items-center gap-1.5 border-b border-white/8 px-4 py-3">
            <div className="size-2.5 rounded-full bg-red-500/60" />
            <div className="size-2.5 rounded-full bg-yellow-500/60" />
            <div className="size-2.5 rounded-full bg-green-500/60" />
            <span className="ml-3 text-[11px] text-white/25 tracking-wider">
              ELPAC Simulation — Scenario 3 of 5
            </span>
          </div>

          <div className="p-5 flex flex-col gap-4">
            {/* Examiner prompt */}
            <div className="rounded-xl border border-[#f4c46b]/15 bg-[#f4c46b]/5 p-4">
              <p className="mb-2 text-[10px] uppercase tracking-widest text-[#f4c46b]/50">
                Examiner
              </p>
              <p className="text-sm leading-relaxed text-white/80">
                &ldquo;Delta 421, turn right heading 090, descend and maintain
                flight level 180, reduce speed to 250 knots.&rdquo;
              </p>
            </div>

            {/* Microphone / waveform */}
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/4 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f4c46b]">
                <Mic className="size-4 text-[#090b10]" />
              </div>
              <div className="flex flex-1 items-center justify-center gap-0.5 h-8">
                {waveHeights.map((h) => (
                  <div
                    key={h}
                    className="w-1 rounded-full bg-[#f4c46b]/50"
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>
              <span className="text-xs text-white/30 tabular-nums">0:06</span>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-4 gap-2">
              {[
                ['Fluency', '4.5'],
                ['Vocab', '4.0'],
                ['Pronun.', '4.5'],
                ['Compreh.', '5.0'],
              ].map(([label, score]) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/8 bg-white/4 p-3 text-center"
                >
                  <p className="text-lg font-semibold text-[#f4c46b]">
                    {score}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/35">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between border-t border-white/8 px-4 py-3 text-xs text-white/30">
            <span>{t.watchLabel}</span>
            <span>{t.duration}</span>
          </div>
        </motion.div>

        {/* Text side */}
        <motion.div variants={itemVariants} className="order-1 lg:order-2">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">
            {t.sectionLabel}
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {t.heading}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/60 sm:text-base">
            {t.body}
          </p>
          <Link
            href="/login"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#f4c46b] px-5 py-2.5 text-sm font-medium text-[#0a0f18] transition-colors hover:bg-[#ffd88f]"
          >
            {t.watchLabel}
            <ArrowRight className="size-4" />
          </Link>

          <div className="mt-7 space-y-2.5">
            {features.map(({ title, description }, index) => {
              const icons = [Mic, Globe2, Gauge];
              const Icon = icons[index];
              return (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-2xl border border-white/8 bg-[#0b111d]/80 p-4"
                >
                  <div className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f4c46b]/10 text-[#f4c46b]">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-white">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/50">
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

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-white/8">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm font-medium text-white sm:text-base">
          {question}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-white/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="pb-5 text-sm leading-relaxed text-white/55">{answer}</p>
      )}
    </div>
  );
}

function FAQ({ t }: { t: LandingTranslations['faq'] }) {
  return (
    <section className="mx-auto w-full max-w-2xl px-6 pb-24">
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={containerVariants}
      >
        <motion.p
          variants={itemVariants}
          className="mb-10 text-center text-[11px] uppercase tracking-[0.22em] text-white/35"
        >
          {t.sectionLabel}
        </motion.p>
        <motion.div variants={itemVariants}>
          {t.items.map(({ question, answer }) => (
            <FAQItem key={question} question={question} answer={answer} />
          ))}
          <div className="border-t border-white/8" />
        </motion.div>
      </motion.div>
    </section>
  );
}

function FinalCta({ t }: { t: LandingTranslations['finalCta'] }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-28">
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        variants={containerVariants}
      >
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-3xl border border-[#f4c46b]/15 bg-[#f4c46b]/5 px-8 py-16 text-center"
        >
          {/* Subtle glow behind */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-1/2 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f4c46b]/10 blur-[80px]" />
          </div>

          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {t.heading}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-white/55">
            {t.description}
          </p>
          <a
            href="#waitlist"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#f4c46b] px-7 py-3 text-sm font-medium text-[#0a0f18] transition-colors hover:bg-[#ffd88f]"
          >
            {t.button}
            <ArrowRight className="size-4" />
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}

function Footer({ t }: { t: LandingTranslations['footer'] }) {
  return (
    <footer className="border-t border-white/8 px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center">
          <span className="text-[#f4c46b]/60">Vector</span>
          <span>English</span>
        </span>
        <span>{t.note}</span>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
