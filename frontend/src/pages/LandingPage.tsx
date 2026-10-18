import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/shared";
import { useReveal } from "../hooks/useReveal";
import {
  AssessmentJourney,
  CompactJourney,
  ActivityReviewGraphic,
  CompactActivityGraphic,
  FocusGraphic,
  CopyGuardGraphic,
  PracticeGraphic,
  CourseGraphic,
  ExportGraphic,
  WorkflowGraphic,
  PrivateResultsGraphic,
} from "../components/landing/Illustrations";

/* ──────────────────────────────────────────────────────────────────────────
   Vibe: Ethereal Glass · Layout: Asymmetrical Bento + Editorial Split
   ────────────────────────────────────────────────────────────────────────── */

/* ───── Ultra-thin line icons (custom — no Lucide / Heroicons / Material) ───── */
const Stroke = ({
  d,
  size = 18,
  className = "",
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

const Arrow = ({
  size = 14,
  className = "",
}: {
  size?: number;
  className?: string;
}) => <Stroke d="M5 19 19 5 M9 5h10v10" size={size} className={className} />;

/* ───── Floating Glass Island Nav (with morphing hamburger) ───── */
const NavIsland = () => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        document.getElementById("mobile-menu-toggle")?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const links = [
    { href: "#features", label: "Features" },
    { href: "#how", label: "How it works" },
    { href: "#integrity", label: "Integrity" },
    { href: "#trust", label: "Trust" },
  ];

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-6">
        <div
          className="
            flex w-full max-w-4xl items-center gap-2 rounded-full p-1.5
            bg-white/70 backdrop-blur-2xl ring-1 ring-ink-900/5
            shadow-[0_20px_60px_-30px_rgba(5,7,11,0.25)]
          "
        >
          <div className="shrink-0 pl-3 pr-2">
            <Brand to="/" />
          </div>

          <nav className="hidden lg:flex items-center gap-1 px-2">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="
                  rounded-full px-3.5 py-2 whitespace-nowrap text-sm font-medium text-ink-600
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
                hidden shrink-0 whitespace-nowrap sm:inline-flex rounded-full px-4 py-2 text-sm font-medium text-ink-700
                transition-all duration-500 ease-spring hover:text-ink-900 hover:bg-ink-900/[0.04]
              "
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="btn-island-primary hidden shrink-0 whitespace-nowrap sm:inline-flex"
            >
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
              id="mobile-menu-toggle"
              aria-expanded={open}
              aria-controls="mobile-navigation"
              className="
                lg:hidden relative ml-1 flex h-10 w-10 items-center justify-center
                rounded-full bg-ink-900/[0.04] ring-1 ring-ink-900/5
              "
            >
              <span
                className={`absolute h-[1.5px] w-4 bg-ink-900 transition-all duration-500 ease-spring ${
                  open ? "rotate-45 translate-y-0" : "-translate-y-1.5"
                }`}
              />
              <span
                className={`absolute h-[1.5px] w-4 bg-ink-900 transition-all duration-500 ease-spring ${
                  open ? "-rotate-45 translate-y-0" : "translate-y-1.5"
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile screen-filling glass overlay */}
      <div
        id="mobile-navigation"
        aria-hidden={!open}
        style={{ visibility: open ? "visible" : "hidden" }}
        className={`
          fixed inset-0 z-30 lg:hidden
          transition-all duration-700 ease-spring
          ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
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
                ${open ? "translate-y-0 opacity-100 blur-0" : "translate-y-12 opacity-0 blur-md"}
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
const Hero = ({ motionControl }: { motionControl: ReactNode }) => (
  <section className="relative overflow-hidden pt-40 md:pt-48 pb-24 md:pb-32">
    {/* Mesh background */}
    <div aria-hidden className="absolute inset-0 -z-10 bg-mesh-emerald" />
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
          Assessment scheduling and review
        </span>

        <h1 className="reveal reveal-delay-1 mt-6 font-display text-[44px] sm:text-6xl md:text-7xl lg:text-[88px] leading-[0.95] tracking-tightest text-balance text-ink-900">
          The integrity engine for{" "}
          <span className="relative inline-block">
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #047857 0%, #10B981 40%, #06B6D4 100%)",
              }}
            >
              modern classrooms
            </span>
            <span className="absolute -bottom-2 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-primary-300/60 to-transparent blur-md" />
          </span>
        </h1>

        <p className="reveal reveal-delay-2 mx-auto mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-ink-500">
          QuizShield supports assessments with scheduled availability,
          tab-switch sentinels, and copy-paste guards — so educators measure
          what students actually know, not what they could borrow.
        </p>

        <div className="reveal reveal-delay-3 mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register" className="btn-island-primary">
            <span className="pr-1">Create an account</span>
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
          Create a teacher account · Create, schedule and review assessments
        </p>
      </div>

      <figure className="reveal reveal-delay-5 mx-auto mt-16 max-w-5xl">
        <div className="bezel">
          <div className="bezel-core overflow-hidden bg-[#f7faf8]">
            <AssessmentJourney />
            <CompactJourney />
          </div>
        </div>
        <figcaption className="home-art-caption mt-4 px-2">
          <p>
            <span className="font-semibold text-ink-700">
              Create. Schedule. Review. Grade.
            </span>{" "}
            An illustrated workflow.
          </p>
          {motionControl}
        </figcaption>
      </figure>
    </div>
  </section>
);

/* ───── SOCIAL PROOF marquee ───── */

/* ───── FEATURE BENTO (Asymmetrical) ───── */
type Feat = {
  title: string;
  label: string;
  copy: string;
  span: string;
  visual: React.ReactNode;
  accent?: "emerald" | "cyan" | "violet";
};

const FeatureCard = ({
  title,
  label,
  copy,
  span,
  visual,
  accent = "emerald",
}: Feat) => {
  const tag =
    accent === "cyan"
      ? "text-accent-700 bg-accent-50 ring-accent-200"
      : accent === "violet"
        ? "text-secondary-700 bg-secondary-50 ring-secondary-200"
        : "text-primary-700 bg-primary-50 ring-primary-200";
  return (
    <div className={`reveal bezel ${span}`}>
      <div className="bezel-core flex h-full flex-col justify-between gap-6 p-7">
        <div
          className={`home-feature-art ${span.includes("row-span-2") ? "home-feature-art--large" : ""} relative overflow-hidden rounded-[1.25rem] bg-ink-50 ring-1 ring-ink-900/5`}
        >
          {visual}
        </div>
        <div>
          <span className={`eyebrow ring-1 ${tag}`}>{label}</span>
          <h3 className="mt-3 font-display text-2xl tracking-tightest text-ink-900">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">{copy}</p>
        </div>
      </div>
    </div>
  );
};

const features: Feat[] = [
  {
    title: "Assessment activity review",
    label: "Event review",
    copy: "Records tab and focus events for teacher review alongside submitted answers.",
    span: "md:col-span-7 md:row-span-2",
    visual: (
      <>
        <ActivityReviewGraphic />
        <CompactActivityGraphic />
      </>
    ),
  },
  {
    title: "Tab-switch sentinel",
    label: "Browser focus",
    copy: "Records supported tab visibility and focus changes during an attempt for teacher review.",
    span: "md:col-span-5",
    accent: "cyan",
    visual: <FocusGraphic />,
  },
  {
    title: "Copy-paste guard",
    label: "Attempt controls",
    copy: "Guards supported copy, paste, context-menu and developer-tool shortcuts during an assessment.",
    span: "md:col-span-5",
    accent: "violet",
    visual: <CopyGuardGraphic />,
  },
  {
    title: "Learning and practice",
    label: "Practice",
    copy: "Explore learning resources and practice guidance alongside your course work and reviewed results.",
    span: "md:col-span-4",
    visual: <PracticeGraphic />,
  },
  {
    title: "Course performance",
    label: "Courses",
    copy: "Educators review course performance, submissions and reported browser events from their dashboard.",
    span: "md:col-span-4",
    accent: "cyan",
    visual: <CourseGraphic />,
  },
  {
    title: "Assessment records",
    label: "Reviewed marks",
    copy: "Review student submissions, teacher grades, feedback and recorded events in one place.",
    span: "md:col-span-4",
    accent: "violet",
    visual: <ExportGraphic />,
  },
];

const FeaturesBento = ({ motionControl }: { motionControl: ReactNode }) => (
  <section id="features" className="relative py-24 md:py-32">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="reveal mx-auto max-w-3xl text-center">
        <span className="eyebrow eyebrow-light">Capabilities</span>
        <h2 className="mt-4 font-display text-4xl md:text-6xl tracking-tightest text-ink-900 text-balance">
          Every layer of integrity, in one platform.
        </h2>
        <p className="mt-5 text-lg text-ink-500 text-pretty">
          From assessment entry to reviewed results, keep the work and its
          context together.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <span className="text-xs text-ink-500">Workflow illustrations</span>
          {motionControl}
        </div>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-12 md:auto-rows-[minmax(280px,auto)]">
        {features.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </div>
  </section>
);

/* ───── HOW IT WORKS — vertical staggered timeline ───── */
const HowItWorks = () => {
  const steps = [
    {
      n: "01",
      t: "Author a quiz in minutes",
      d: "Create multiple-choice and short-answer questions, choose a course, and set an assessment start time.",
    },
    {
      n: "02",
      t: "Distribute via secure code",
      d: "Students enrol using a course code and enter a four-digit assessment code. The server checks enrolment and scheduled availability.",
    },
    {
      n: "03",
      t: "Review assessment activity",
      d: "Review submitted answers and recorded tab and focus events before assigning a grade.",
    },
    {
      n: "04",
      t: "Grade and give feedback",
      d: "Review each submission, save a teacher grade and feedback, and let students view their reviewed results.",
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
            <Link
              to="/register"
              className="reveal reveal-delay-3 mt-8 btn-island-primary"
            >
              <span className="pr-1">Try the workflow</span>
              <span className="btn-icon bg-white/15">
                <Arrow />
              </span>
            </Link>
            <div className="reveal mt-10 max-w-sm">
              <WorkflowGraphic />
            </div>
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
const IntegritySpotlight = ({
  motionControl,
}: {
  motionControl: ReactNode;
}) => (
  <section
    id="integrity"
    className="relative overflow-hidden bg-ink-950 py-24 text-white md:py-32"
  >
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <span className="eyebrow eyebrow-dark reveal">
            Assessment integrity
          </span>
          <h2 className="reveal reveal-delay-1 mt-4 font-display text-4xl md:text-6xl tracking-tightest text-white text-balance">
            Assessment protection that respects{" "}
            <span className="text-primary-300">students.</span>
          </h2>
          <p className="reveal reveal-delay-2 mt-5 max-w-xl text-lg text-white/60 text-pretty">
            Course enrolment and scheduled availability
            are checked by the server. Browser activity events provide context
            for teacher review.
          </p>
          <ul className="reveal reveal-delay-3 mt-10 space-y-4">
            {[
              "Server-checked enrolment and scheduled availability",
              "Browser events alongside submitted answers",
              "Results held until teacher review",
              "Teacher judgment at the centre of review",
            ].map((line) => (
              <li key={line} className="flex items-start gap-3 text-white/80">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/20 ring-1 ring-primary-400/40">
                  <Stroke
                    d="M5 13l4 4L19 7"
                    size={12}
                    className="text-primary-300"
                  />
                </span>
                <span className="text-sm leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <figure className="reveal reveal-delay-2 min-w-0">
          <div className="bezel-dark">
            <div className="bezel-core-dark overflow-hidden">
              <PrivateResultsGraphic />
            </div>
          </div>
          <figcaption className="home-art-caption home-art-caption--dark mt-4 px-2">
            <p>Illustration · Submitted by students. Reviewed by you.</p>
            {motionControl}
          </figcaption>
        </figure>
      </div>
    </div>
  </section>
);

/* ───── METRICS strip ───── */
const Metrics = () => {
  const items = [
    { k: "Create", l: "Build course assessments" },
    { k: "Schedule", l: "Choose the start time" },
    { k: "Review", l: "Teacher-approved grades" },
    { k: "Feedback", l: "Help students improve" },
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
      q: "Create course assessments and choose when students can start them.",
      a: "Create and schedule",
      r: "Teacher controls",
      rot: "md:-rotate-2",
    },
    {
      q: "Review answers and recorded events before saving a teacher grade and feedback.",
      a: "Review and grade",
      r: "Assessment workflow",
      rot: "md:rotate-1",
    },
    {
      q: "Organise topics, learning resources and enrolled students within each course.",
      a: "Manage your courses",
      r: "Course workspace",
      rot: "md:-rotate-1",
    },
  ];

  return (
    <section id="trust" className="relative bg-ink-50 py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal mx-auto max-w-3xl text-center">
          <span className="eyebrow eyebrow-light">Your workflow</span>
          <h2 className="mt-4 font-display text-4xl md:text-6xl tracking-tightest text-ink-900 text-balance">
            A clear path from questions to reviewed results.
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
                    {qq.a.split(" ").slice(-1)[0][0]}
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
            Bring integrity back to{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #6CE8B7 0%, #22D3EE 100%)",
              }}
            >
              every assessment.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60 text-pretty">
            Manage courses, scheduled assessments and reviewed results with
            QuizShield.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register" className="btn-island-emerald">
              <span className="pr-1">Create an account</span>
              <span className="btn-icon-dark">
                <Arrow />
              </span>
            </Link>
            <Link to="/contact" className="btn-island-ghost-dark">
              <span className="pr-1">Get support</span>
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
            h: "Platform",
            l: [
              ["Features", "#features"],
              ["Workflow", "#how"],
              ["Integrity", "#integrity"],
              ["Trust", "#trust"],
            ],
          },
          {
            h: "Account",
            l: [
              ["Sign in", "/login"],
              ["Create account", "/register"],
              ["Profile", "/profile"],
            ],
          },
          {
            h: "Company",
            l: [
              ["Contact", "/contact"],
              ["Privacy", "/privacy"],
              ["Terms", "/terms"],
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
  const page = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    const updateVisibility = () => {
      if (page.current)
        page.current.dataset.homeVisible = String(!document.hidden);
    };
    preference.addEventListener("change", updatePreference);
    document.addEventListener("visibilitychange", updateVisibility);
    updateVisibility();
    return () => {
      preference.removeEventListener("change", updatePreference);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);
  const stopped = paused || reducedMotion;
  const motionControl = (
    <button
      type="button"
      className="home-motion-control"
      aria-pressed={stopped}
      disabled={reducedMotion}
      onClick={() => setPaused((value) => !value)}
      title={
        reducedMotion
          ? "Your device has requested reduced motion."
          : "Control animations across this page."
      }
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {stopped ? (
          <path
            d="m5 3 7 5-7 5V3Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M5 3v10M11 3v10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}
      </svg>
      {reducedMotion
        ? "Reduced motion on"
        : stopped
          ? "Play animations"
          : "Pause animations"}
    </button>
  );

  return (
    <div
      ref={page}
      data-reveal-root
      data-home-motion={stopped ? "paused" : "running"}
      data-home-visible="true"
      className="home-page min-h-[100dvh] bg-ink-50 text-ink-900 grain-fixed"
    >
      <NavIsland />
      <main>
        <Hero motionControl={motionControl} />

        <FeaturesBento motionControl={motionControl} />
        <HowItWorks />
        <IntegritySpotlight motionControl={motionControl} />
        <Metrics />
        <Testimonials />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
