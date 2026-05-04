import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/shared';
import { useReveal } from '../hooks/useReveal';

/* ──────────────────────────────────────────────────────────────────────────
   Vibe: Ethereal Glass · Layout: Asymmetrical Bento + Editorial Split
   ────────────────────────────────────────────────────────────────────────── */

/* ───── Ultra-thin line icons (custom — no Lucide / Heroicons / Material) ───── */
const Stroke = ({
  d,
  size = 18,
  className = '',
}: {
  d: string;
  size?: number;
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const Arrow = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <Stroke d="M5 19 19 5 M9 5h10v10" size={size} className={className} />
);

/* ───── Floating Glass Island Nav (with morphing hamburger) ───── */
const NavIsland = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [open]);

  const links = [
    { href: '#features', label: 'Features' },
    { href: '#how', label: 'How it works' },
    { href: '#integrity', label: 'AI Integrity' },
    { href: '#trust', label: 'Trust' },
  ];

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-6">
        <div
          className="
            flex w-full max-w-3xl items-center gap-2 rounded-full p-1.5
            bg-white/70 backdrop-blur-2xl ring-1 ring-ink-900/5
            shadow-[0_20px_60px_-30px_rgba(5,7,11,0.25)]
          "
        >
          <div className="pl-3 pr-2">
            <Brand to="/" />
          </div>

          <nav className="hidden md:flex items-center gap-1 px-2">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="
                  rounded-full px-3.5 py-2 text-sm font-medium text-ink-600
                  transition-all duration-500 ease-spring
                  hover:text-ink-900 hover:bg-ink-900/[0.04]
                "
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Link
              to="/login"
              className="
                hidden sm:inline-flex rounded-full px-4 py-2 text-sm font-medium text-ink-700
                transition-all duration-500 ease-spring hover:text-ink-900 hover:bg-ink-900/[0.04]
              "
            >
              Sign in
            </Link>
            <Link to="/register" className="btn-island-primary">
              <span className="pr-1">Get started</span>
              <span className="btn-icon bg-white/15">
                <Arrow />
              </span>
            </Link>

            {/* Hamburger → X morph */}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
              className="
                md:hidden relative ml-1 flex h-10 w-10 items-center justify-center
                rounded-full bg-ink-900/[0.04] ring-1 ring-ink-900/5
              "
            >
              <span
                className={`absolute h-[1.5px] w-4 bg-ink-900 transition-all duration-500 ease-spring ${
                  open ? 'rotate-45 translate-y-0' : '-translate-y-1.5'
                }`}
              />
              <span
                className={`absolute h-[1.5px] w-4 bg-ink-900 transition-all duration-500 ease-spring ${
                  open ? '-rotate-45 translate-y-0' : 'translate-y-1.5'
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile screen-filling glass overlay */}
      <div
        className={`
          fixed inset-0 z-30 md:hidden
          transition-all duration-700 ease-spring
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          backdrop-blur-3xl bg-white/80
        `}
      >
        <div className="flex h-full flex-col justify-center px-8">
          {links.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`
                block py-4 font-display text-5xl tracking-tightest text-ink-900
                transition-all duration-700 ease-spring
                ${open ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-12 opacity-0 blur-md'}
              `}
              style={{ transitionDelay: `${100 + i * 60}ms` }}
            >
              {l.label}
            </a>
          ))}
          <div className="mt-10 flex gap-3">
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="btn-island-ghost"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              onClick={() => setOpen(false)}
              className="btn-island-primary"
            >
              <span className="pr-1">Get started</span>
              <span className="btn-icon bg-white/15">
                <Arrow />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

/* ───── HERO ───── */
const Hero = () => (
  <section className="relative overflow-hidden pt-40 md:pt-48 pb-24 md:pb-32">
    {/* Mesh background */}
    <div
      aria-hidden
      className="absolute inset-0 -z-10 bg-mesh-emerald"
    />
    <div
      aria-hidden
      className="absolute inset-x-0 top-0 -z-10 h-[60vh] bg-grid-faint [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]"
    />
    {/* Floating glow orb */}
    <div
      aria-hidden
      className="absolute left-1/2 top-32 -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary-300/30 blur-3xl animate-pulse-soft"
    />

    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <span className="eyebrow eyebrow-light reveal">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse" />
          Now with AI face-presence proctoring
        </span>

        <h1 className="reveal reveal-delay-1 mt-6 font-display text-[44px] sm:text-6xl md:text-7xl lg:text-[88px] leading-[0.95] tracking-tightest text-balance text-ink-900">
          The integrity engine for{' '}
          <span className="relative inline-block">
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #047857 0%, #10B981 40%, #06B6D4 100%)',
              }}
            >
              modern classrooms
            </span>
            <span className="absolute -bottom-2 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-primary-300/60 to-transparent blur-md" />
          </span>
        </h1>

        <p className="reveal reveal-delay-2 mx-auto mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-ink-500">
          QuizShield secures every assessment with face-presence detection,
          tab-switch sentinels, and copy-paste guards — so educators measure what
          students actually know, not what they could borrow.
        </p>

        <div className="reveal reveal-delay-3 mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register" className="btn-island-primary">
            <span className="pr-1">Start free trial</span>
            <span className="btn-icon bg-white/15">
              <Arrow />
            </span>
          </Link>
          <a href="#how" className="btn-island-ghost">
            <span className="pr-1">See how it works</span>
            <span className="btn-icon bg-ink-900/[0.06]">
              <Stroke d="M8 5v14l11-7z" size={12} />
            </span>
          </a>
        </div>

        <p className="reveal reveal-delay-4 mt-6 text-xs text-ink-400">
          No credit card · Set up in under 5 minutes · Trusted by 200+ institutions
        </p>
      </div>

      {/* Hero showcase — Double-bezel display panel */}
      <div className="reveal reveal-delay-5 mt-20">
        <div className="bezel mx-auto max-w-5xl">
          <div className="bezel-core relative overflow-hidden">
            {/* Faux app chrome */}
            <div className="flex items-center gap-2 border-b border-ink-900/5 px-5 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
              <span className="ml-4 text-[11px] font-medium text-ink-400">
                quizshield.io / live-session / CS-401-Final
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-semibold text-primary-700 ring-1 ring-primary-200">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse" />
                MONITORING · 24 STUDENTS
              </span>
            </div>

            <div className="grid gap-px bg-ink-900/5 md:grid-cols-[260px_1fr_220px]">
              {/* Sidebar */}
              <div className="bg-white p-5">
                <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-ink-400">
                  Sections
                </p>
                <ul className="mt-3 space-y-1 text-sm text-ink-700">
                  {['Algorithms', 'Data Structures', 'Complexity', 'Recursion'].map((s, i) => (
                    <li
                      key={s}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                        i === 0 ? 'bg-ink-900 text-white' : 'hover:bg-ink-50'
                      }`}
                    >
                      <span>{s}</span>
                      <span className={`text-[10px] ${i === 0 ? 'text-white/60' : 'text-ink-400'}`}>
                        {12 - i * 2}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Main quiz */}
              <div className="bg-white p-6">
                <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-ink-400">
                  Question 04 / 20
                </p>
                <p className="mt-2 font-display text-2xl tracking-tightest text-ink-900">
                  What is the worst-case time complexity of inserting into a balanced BST?
                </p>
                <div className="mt-5 grid gap-2.5">
                  {['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'].map((opt, i) => (
                    <div
                      key={opt}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ring-1 transition-all duration-500 ease-spring ${
                        i === 1
                          ? 'bg-primary-50 ring-primary-200 text-primary-800'
                          : 'bg-white ring-ink-900/5 text-ink-700'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                          i === 1 ? 'bg-primary-500 text-white' : 'bg-ink-900/[0.06] text-ink-500'
                        }`}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Live monitor */}
              <div className="bg-white p-5">
                <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-ink-400">
                  Live presence
                </p>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className={`aspect-square rounded-lg ring-1 ${
                        i === 5
                          ? 'bg-rose-100 ring-rose-300'
                          : 'bg-primary-50 ring-primary-200'
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-rose-50 p-3 ring-1 ring-rose-200">
                  <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-rose-700">
                    Flagged
                  </p>
                  <p className="mt-1 text-xs text-rose-900">
                    Seat 06 — face absent 4.2s
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

/* ───── SOCIAL PROOF marquee ───── */
const TrustStrip = () => (
  <section className="border-y border-ink-900/5 bg-white py-10">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <p className="text-center text-[10px] font-semibold uppercase tracking-eyebrow text-ink-400">
        Trusted by faculty, security teams, and academic boards worldwide
      </p>
      <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap py-2">
          {[
            'NUTECH',
            'COMSATS',
            'STANFORD ED',
            'BUITEMS',
            'IBA',
            'NUST',
            'OXFORD ONLINE',
            'CAMBRIDGE EDU',
            'MIT OPEN',
            'UoP',
          ]
            .concat([
              'NUTECH',
              'COMSATS',
              'STANFORD ED',
              'BUITEMS',
              'IBA',
              'NUST',
              'OXFORD ONLINE',
              'CAMBRIDGE EDU',
              'MIT OPEN',
              'UoP',
            ])
            .map((n, i) => (
              <span
                key={i}
                className="font-display text-2xl font-medium tracking-tightest text-ink-300"
              >
                {n}
              </span>
            ))}
        </div>
      </div>
    </div>
  </section>
);

/* ───── FEATURE BENTO (Asymmetrical) ───── */
type Feat = {
  title: string;
  copy: string;
  span: string;
  visual: React.ReactNode;
  accent?: 'emerald' | 'cyan' | 'violet';
};

const FeatureCard = ({ title, copy, span, visual, accent = 'emerald' }: Feat) => {
  const tag =
    accent === 'cyan'
      ? 'text-accent-700 bg-accent-50 ring-accent-200'
      : accent === 'violet'
      ? 'text-secondary-700 bg-secondary-50 ring-secondary-200'
      : 'text-primary-700 bg-primary-50 ring-primary-200';
  return (
    <div className={`reveal bezel ${span}`}>
      <div className="bezel-core flex h-full flex-col justify-between gap-6 p-7">
        <div className="relative h-44 overflow-hidden rounded-[1.25rem] bg-ink-50 ring-1 ring-ink-900/5">
          {visual}
        </div>
        <div>
          <span className={`eyebrow ring-1 ${tag}`}>{accent}</span>
          <h3 className="mt-3 font-display text-2xl tracking-tightest text-ink-900">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">{copy}</p>
        </div>
      </div>
    </div>
  );
};

const FeaturesBento = () => (
  <section id="features" className="relative py-32">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="reveal mx-auto max-w-3xl text-center">
        <span className="eyebrow eyebrow-light">Capabilities</span>
        <h2 className="mt-4 font-display text-4xl md:text-6xl tracking-tightest text-ink-900 text-balance">
          Every layer of integrity, in one platform.
        </h2>
        <p className="mt-5 text-lg text-ink-500 text-pretty">
          From the moment a student joins a session to the final analytics
          breakdown, QuizShield enforces fairness without disrupting flow.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-12 md:auto-rows-[minmax(280px,auto)]">
        <FeatureCard
          span="md:col-span-7 md:row-span-2"
          title="AI Face-Presence Proctoring"
          copy="Continuously verifies the student is present, alone, and focused — using an on-device face-detection pipeline. Zero footage uploaded."
          accent="emerald"
          visual={
            <div className="relative flex h-full items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-100/60 via-transparent to-accent-100/40" />
              <div className="relative h-32 w-32 rounded-full bg-white ring-1 ring-ink-900/5 shadow-soft" />
              <div
                className="absolute h-44 w-44 rounded-full border-2 border-dashed border-primary-400/60 animate-orbit-slow"
                style={{ animationDuration: '20s' }}
              />
              <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-primary-700 ring-1 ring-primary-200">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse" />
                FACE OK
              </span>
            </div>
          }
        />
        <FeatureCard
          span="md:col-span-5"
          title="Tab-Switch Sentinel"
          copy="Detects every blur, alt-tab, and split-screen attempt. Counts toward a configurable strike system."
          accent="cyan"
          visual={
            <div className="relative flex h-full items-center justify-center bg-ink-900">
              <div className="absolute inset-0 bg-grid-faint [background-size:24px_24px] opacity-30" />
              <div className="relative grid grid-cols-3 gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-10 w-14 rounded-md ring-1 ${
                      i === 4
                        ? 'bg-rose-500/20 ring-rose-400/60'
                        : 'bg-white/5 ring-white/10'
                    }`}
                  />
                ))}
              </div>
            </div>
          }
        />
        <FeatureCard
          span="md:col-span-5"
          title="Copy-Paste Guard"
          copy="Disables copy, paste, right-click, and DevTools shortcuts inside live sessions."
          accent="violet"
          visual={
            <div className="relative flex h-full items-center justify-center">
              <div className="font-mono text-[11px] text-ink-300 select-none">
                <p>Ctrl + C ✗</p>
                <p>Ctrl + V ✗</p>
                <p>Right-click ✗</p>
                <p>DevTools ✗</p>
              </div>
            </div>
          }
        />
        <FeatureCard
          span="md:col-span-4"
          title="Adaptive Question Flow"
          copy="Difficulty self-tunes to each student's signal — keeping the cohort in challenge state."
          accent="emerald"
          visual={
            <div className="relative flex h-full items-end justify-around p-4">
              {[40, 65, 50, 80, 60, 90, 75].map((h, i) => (
                <div
                  key={i}
                  className="w-3 rounded-t-md bg-gradient-to-t from-primary-200 to-primary-500"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          }
        />
        <FeatureCard
          span="md:col-span-4"
          title="Live Cohort Heatmap"
          copy="Educators see attention, accuracy, and risk in a single ambient grid."
          accent="cyan"
          visual={
            <div className="grid h-full grid-cols-6 gap-1 p-3">
              {Array.from({ length: 30 }).map((_, i) => {
                const intensity = (Math.sin(i * 1.7) + 1) / 2;
                return (
                  <div
                    key={i}
                    className="rounded-md"
                    style={{
                      background: `rgba(16,185,129,${0.15 + intensity * 0.7})`,
                    }}
                  />
                );
              })}
            </div>
          }
        />
        <FeatureCard
          span="md:col-span-4"
          title="Forensic Analytics"
          copy="Per-student timelines, violation receipts, and exportable academic reports."
          accent="violet"
          visual={
            <div className="relative h-full p-4">
              <svg viewBox="0 0 200 100" className="h-full w-full">
                <path
                  d="M0 80 C 30 60, 60 30, 90 50 S 150 90, 200 30"
                  fill="none"
                  stroke="#7C3AED"
                  strokeWidth="1.5"
                />
                <path
                  d="M0 80 C 30 60, 60 30, 90 50 S 150 90, 200 30 L 200 100 L 0 100 Z"
                  fill="url(#g1)"
                  opacity="0.3"
                />
                <defs>
                  <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#A78BFA" />
                    <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          }
        />
      </div>
    </div>
  </section>
);

/* ───── HOW IT WORKS — vertical staggered timeline ───── */
const HowItWorks = () => {
  const steps = [
    {
      n: '01',
      t: 'Author a quiz in minutes',
      d: 'Build with rich question types — multiple-choice, code blocks, free response. Versioned, branchable, instantly publishable.',
    },
    {
      n: '02',
      t: 'Distribute via secure code',
      d: 'Students enter a 6-digit join code. We verify identity, request camera permission, and lock the testing window.',
    },
    {
      n: '03',
      t: 'Monitor in real time',
      d: 'A live heatmap surfaces presence anomalies, tab switches, and pace outliers. Intervene with one click.',
    },
    {
      n: '04',
      t: 'Analyze & defend grades',
      d: 'Per-student forensic timelines and exportable reports give you the receipts to defend every score.',
    },
  ];

  return (
    <section id="how" className="relative bg-white py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-5 lg:sticky lg:top-32 self-start">
            <span className="eyebrow eyebrow-light reveal">Workflow</span>
            <h2 className="reveal reveal-delay-1 mt-4 font-display text-4xl md:text-6xl tracking-tightest text-ink-900 text-balance">
              From blank slate to defensible grade.
            </h2>
            <p className="reveal reveal-delay-2 mt-5 text-lg text-ink-500 text-pretty">
              Four deliberate steps — engineered so educators spend more time
              teaching, less time policing.
            </p>
            <Link to="/register" className="reveal reveal-delay-3 mt-8 btn-island-primary">
              <span className="pr-1">Try the workflow</span>
              <span className="btn-icon bg-white/15">
                <Arrow />
              </span>
            </Link>
          </div>

          <div className="relative lg:col-span-7">
            <div className="absolute left-[27px] top-3 bottom-3 w-px bg-gradient-to-b from-transparent via-ink-900/10 to-transparent" />
            <ol className="space-y-6">
              {steps.map((s, i) => (
                <li key={s.n} className={`reveal reveal-delay-${i + 1}`}>
                  <div className="bezel">
                    <div className="bezel-core flex gap-5 p-6">
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink-900 text-white font-display text-lg ring-4 ring-white">
                        {s.n}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-display text-2xl tracking-tightest text-ink-900">
                          {s.t}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-ink-500">
                          {s.d}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ───── INTEGRITY SPOTLIGHT (dark editorial split) ───── */
const IntegritySpotlight = () => (
  <section
    id="integrity"
    className="relative overflow-hidden bg-ink-950 py-32 text-white"
  >
    <div
      aria-hidden
      className="absolute inset-0 -z-10 bg-mesh-emerald opacity-60"
    />
    <div
      aria-hidden
      className="absolute inset-x-0 top-0 -z-10 h-full bg-grid-faint [background-size:48px_48px] opacity-[0.04]"
    />

    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid items-center gap-16 lg:grid-cols-2">
        <div>
          <span className="eyebrow eyebrow-dark reveal">AI Integrity</span>
          <h2 className="reveal reveal-delay-1 mt-4 font-display text-4xl md:text-6xl tracking-tightest text-white text-balance">
            Proctoring that respects{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #6CE8B7 0%, #22D3EE 100%)',
              }}
            >
              students.
            </span>
          </h2>
          <p className="reveal reveal-delay-2 mt-5 max-w-xl text-lg text-white/60 text-pretty">
            All face-presence inference happens on-device using face-api.js.
            We store anomaly events, never video. Reviewable. Explainable.
            FERPA-aligned.
          </p>

          <ul className="reveal reveal-delay-3 mt-10 space-y-4">
            {[
              'On-device inference — no biometric uploads',
              'Event-only logs with timestamped rationale',
              'Configurable strike thresholds per quiz',
              'Auditable trail for every flagged moment',
            ].map((line) => (
              <li key={line} className="flex items-start gap-3 text-white/80">
                <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/20 ring-1 ring-primary-400/40">
                  <Stroke d="M5 13l4 4L19 7" size={12} className="text-primary-300" />
                </span>
                <span className="text-sm leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Visual — Camera ring + telemetry */}
        <div className="reveal reveal-delay-2 relative">
          <div className="bezel-dark">
            <div className="bezel-core-dark relative aspect-[4/5] overflow-hidden p-8">
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-accent-500/10"
              />

              <div className="relative flex h-full flex-col">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-eyebrow text-white/70 ring-1 ring-white/10">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                    REC · 00:14:32
                  </span>
                  <span className="font-mono text-[10px] text-white/40">
                    QS · v4.2
                  </span>
                </div>

                <div className="relative mx-auto my-auto flex h-56 w-56 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-white/10" />
                  <div className="absolute inset-2 rounded-full border border-primary-400/40 animate-orbit-slow" />
                  <div className="absolute inset-6 rounded-full border-2 border-dashed border-accent-400/40 [animation:orbit_18s_linear_infinite_reverse]" />
                  <div
                    className="relative h-32 w-32 rounded-full bg-gradient-to-br from-primary-400/30 to-accent-400/30 backdrop-blur-xl ring-1 ring-white/20"
                    style={{
                      boxShadow: '0 0 80px rgba(16,185,129,0.45)',
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { l: 'Confidence', v: '99.4%' },
                    { l: 'Latency', v: '12ms' },
                    { l: 'Anomalies', v: '0' },
                  ].map((m) => (
                    <div
                      key={m.l}
                      className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10"
                    >
                      <p className="font-display text-xl text-white">{m.v}</p>
                      <p className="mt-0.5 text-[9px] uppercase tracking-eyebrow text-white/40">
                        {m.l}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

/* ───── METRICS strip ───── */
const Metrics = () => {
  const items = [
    { k: '2.4M+', l: 'Sessions secured' },
    { k: '99.97%', l: 'Uptime SLA' },
    { k: '<14ms', l: 'Detection latency' },
    { k: '0', l: 'Biometric uploads' },
  ];
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((m, i) => (
            <div
              key={m.k}
              className={`reveal reveal-delay-${i + 1} border-l border-ink-900/10 pl-6`}
            >
              <p className="font-display text-5xl tracking-tightest text-ink-900">
                {m.k}
              </p>
              <p className="mt-2 text-sm font-medium text-ink-500">{m.l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ───── TESTIMONIALS — Z-axis cascade on desktop ───── */
const Testimonials = () => {
  const quotes = [
    {
      q: 'QuizShield killed our cheating problem in a single semester. Faculty actually trust online assessments again.',
      a: 'Dr. Hira Khan',
      r: 'Dean of Computing, NUTECH',
      rot: 'md:-rotate-2',
    },
    {
      q: 'The forensic timeline is what sold us. When a student disputes a grade, we have the receipts.',
      a: 'Prof. Daniyal Ahmad',
      r: 'Department Head, COMSATS',
      rot: 'md:rotate-1',
    },
    {
      q: 'On-device proctoring with no video upload — finally an integrity tool our DPO actually approves.',
      a: 'Sara Iqbal',
      r: 'Privacy Officer, IBA',
      rot: 'md:-rotate-1',
    },
  ];

  return (
    <section id="trust" className="relative bg-ink-50 py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal mx-auto max-w-3xl text-center">
          <span className="eyebrow eyebrow-light">Voices</span>
          <h2 className="mt-4 font-display text-4xl md:text-6xl tracking-tightest text-ink-900 text-balance">
            Educators who got their classrooms back.
          </h2>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {quotes.map((qq, i) => (
            <figure
              key={i}
              className={`reveal reveal-delay-${i + 1} bezel ${qq.rot} transition-transform duration-700 ease-spring hover:rotate-0`}
            >
              <blockquote className="bezel-core flex h-full flex-col gap-6 p-7">
                <Stroke
                  d="M9 7H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v3a2 2 0 0 1-2 2H4 M19 7h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v3a2 2 0 0 1-2 2h-1"
                  size={28}
                  className="text-primary-500"
                />
                <p className="font-display text-xl leading-snug tracking-tightest text-ink-900">
                  {qq.q}
                </p>
                <figcaption className="mt-auto flex items-center gap-3 border-t border-ink-900/5 pt-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-accent-400 font-display text-white">
                    {qq.a.split(' ').slice(-1)[0][0]}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{qq.a}</p>
                    <p className="text-xs text-ink-500">{qq.r}</p>
                  </div>
                </figcaption>
              </blockquote>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ───── FINAL CTA ───── */
const FinalCTA = () => (
  <section className="relative px-4 py-32">
    <div className="reveal mx-auto max-w-6xl">
      <div className="bezel-dark">
        <div className="bezel-core-dark relative overflow-hidden px-8 py-24 sm:px-16 text-center">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-mesh-emerald opacity-80"
          />
          <span className="eyebrow eyebrow-dark">Ready when you are</span>
          <h2 className="mt-5 font-display text-5xl md:text-7xl tracking-tightest text-white text-balance">
            Bring integrity back to{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #6CE8B7 0%, #22D3EE 100%)',
              }}
            >
              every assessment.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60 text-pretty">
            Join the institutions running fairer, faster, more defensible exams
            with QuizShield.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register" className="btn-island-emerald">
              <span className="pr-1">Start free trial</span>
              <span className="btn-icon-dark">
                <Arrow />
              </span>
            </Link>
            <Link to="/contact" className="btn-island-ghost-dark">
              <span className="pr-1">Talk to sales</span>
              <span className="btn-icon">
                <Arrow />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  </section>
);

/* ───── FOOTER ───── */
const Footer = () => (
  <footer className="border-t border-ink-900/5 bg-white">
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Brand to="/" />
          <p className="mt-5 max-w-sm text-sm text-ink-500">
            QuizShield is the integrity engine for modern classrooms. Built by
            educators, secured by engineers.
          </p>
        </div>
        {[
          {
            h: 'Platform',
            l: [
              ['Features', '#features'],
              ['Workflow', '#how'],
              ['AI Integrity', '#integrity'],
              ['Trust', '#trust'],
            ],
          },
          {
            h: 'Account',
            l: [
              ['Sign in', '/login'],
              ['Create account', '/register'],
              ['Profile', '/profile'],
            ],
          },
          {
            h: 'Company',
            l: [
              ['Contact', '/contact'],
              ['Privacy', '/privacy'],
              ['Terms', '/terms'],
            ],
          },
        ].map((col) => (
          <div key={col.h} className="lg:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-ink-400">
              {col.h}
            </p>
            <ul className="mt-4 space-y-2.5">
              {col.l.map(([label, href]) => (
                <li key={label}>
                  <Link
                    to={href}
                    className="text-sm text-ink-700 transition-colors duration-300 hover:text-primary-700"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="hairline-x mt-14" />
      <div className="mt-6 flex flex-col items-start justify-between gap-4 text-xs text-ink-400 sm:flex-row sm:items-center">
        <p>© {new Date().getFullYear()} QuizShield. All rights reserved.</p>
        <p className="font-mono">Engineered for academic integrity.</p>
      </div>
    </div>
  </footer>
);

/* ───── PAGE ROOT ───── */
const LandingPage = () => {
  useReveal();

  return (
    <div data-reveal-root className="min-h-[100dvh] bg-ink-50 text-ink-900 grain-fixed">
      <NavIsland />
      <main>
        <Hero />
        <TrustStrip />
        <FeaturesBento />
        <HowItWorks />
        <IntegritySpotlight />
        <Metrics />
        <Testimonials />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
