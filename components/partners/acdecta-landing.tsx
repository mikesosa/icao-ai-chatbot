import Image from 'next/image';
import Link from 'next/link';

import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PartnerBrand } from '@/lib/partners/types';

import acdectaLogo from '../../logo.png';

const NAV_ITEMS = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Plataforma', href: '#plataforma' },
  { label: 'Sitio oficial', href: 'https://acdecta.com.co/', external: true },
] as const;

export function AcdectaLanding({ partner }: { partner: PartnerBrand }) {
  const headline =
    partner.headline ?? 'Official educational app to enforce ICAO Level 4';
  const subheadline =
    partner.subheadline ??
    'ELPAC Aviation English assessment tailored for professional training.';
  const ctaLabel = partner.ctaLabel ?? 'Start assessment';

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#2f4dff] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-400" />
        <div className="absolute -right-40 -top-40 size-[520px] rounded-full bg-indigo-900/30 blur-3xl" />
        <div className="absolute -bottom-52 -left-52 size-[680px] rounded-full bg-blue-900/30 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 size-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-emerald-200/70 via-cyan-200/40 to-indigo-200/10 blur-2xl" />

        <div
          className="absolute inset-0 opacity-10 mix-blend-overlay"
          style={{
            WebkitMaskImage:
              'radial-gradient(circle at 50% 45%, black 0%, transparent 62%)',
            maskImage:
              'radial-gradient(circle at 50% 45%, black 0%, transparent 62%)',
          }}
          aria-hidden="true"
        >
          <Image
            src={acdectaLogo}
            alt=""
            fill
            sizes="100vw"
            className="object-contain blur-[1px] contrast-125 brightness-110 saturate-0"
            priority
          />
        </div>
      </div>

      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-6">
          <Link href="#inicio" className="flex items-center gap-3">
            <Image
              src={acdectaLogo}
              alt="ACDECTA"
              priority
              className="h-9 w-auto drop-shadow-sm"
            />
            <span className="hidden text-sm font-semibold tracking-wide text-white/90 sm:inline">
              ACDECTA
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const className =
                'inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold tracking-wide text-white/90 hover:bg-white/10 hover:text-white';

              if ('external' in item && item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className={className}
                  >
                    {item.label}
                  </a>
                );
              }

              return (
                <a key={item.href} href={item.href} className={className}>
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              asChild
              className="hidden rounded-full bg-white/90 px-6 text-xs font-semibold text-slate-900 hover:bg-white md:inline-flex"
            >
              <Link href="/login">Ingresar</Link>
            </Button>

            <details className="relative md:hidden">
              <summary className="inline-flex size-10 list-none items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/15">
                <span className="sr-only">Open menu</span>
                <Menu className="size-5" />
              </summary>
              <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-white/15 bg-white/10 p-2 shadow-xl backdrop-blur">
                <div className="grid gap-1">
                  {NAV_ITEMS.map((item) => {
                    const className =
                      'rounded-xl px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white';
                    if ('external' in item && item.external) {
                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className={className}
                        >
                          {item.label}
                        </a>
                      );
                    }
                    return (
                      <a key={item.href} href={item.href} className={className}>
                        {item.label}
                      </a>
                    );
                  })}
                  <Button
                    asChild
                    className="mt-1 w-full rounded-xl bg-white text-slate-900 hover:bg-white/90"
                  >
                    <Link href="/login">Ingresar</Link>
                  </Button>
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <section id="inicio" className="mx-auto max-w-6xl px-4">
          <div className="flex h-full flex-col items-center justify-center pt-16 mt-16 text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-white/80">
              ACCESO PARA MIEMBROS • ACDECTA
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              Plataforma ICAO / ELPAC
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white sm:text-base">
              {headline}. {subheadline}
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-11 rounded-full bg-white text-slate-900 hover:bg-white/90"
              >
                <Link href="/login">{ctaLabel}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="h-11 rounded-full bg-white/10 text-white hover:bg-white/15"
              >
                <Link href="#plataforma">Ver detalles</Link>
              </Button>
            </div>

            <div
              className="mt-10 flex items-center gap-3"
              aria-label="Slide indicators"
            >
              <span className="size-2 rounded-full bg-white/90" />
              <span className="size-2 rounded-full bg-white/40" />
              <span className="size-2 rounded-full bg-white/40" />
              <span className="size-2 rounded-full bg-white/40" />
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 pb-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-white/70">
          <span className="font-semibold text-white/80">ACDECTA</span> • Acceso
          para miembros
        </div>
      </footer>
    </div>
  );
}
