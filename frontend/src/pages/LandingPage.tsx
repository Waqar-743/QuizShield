import { Link } from 'react-router-dom';
import {
  ExclamationTriangleIcon,
  SparklesIcon,
  NoSymbolIcon,
  BellAlertIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

import shieldImage from '../assets/cybersecurity-shield.jpg';
import { Brand } from '../components/shared';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <Brand to="/" />

            <nav className="flex items-center gap-6">
              <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-slate-900">
                Sign in
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
              >
                Sign up
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
              <div>
                <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                  <span className="block">Conduct Exams with</span>
                  <span className="block">Uncompromising</span>
                  <span className="block">Integrity</span>
                </h1>
                <p className="mt-6 max-w-xl text-base leading-7 text-slate-500 sm:text-lg">
                  Experience a secure testing environment that ensures academic honesty. Our platform empowers teachers
                  to create rigorous quizzes while our advanced proctoring detects tab-switching, prevents copying, and
                  alerts instructors of any rule breaches instantly.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center rounded-md bg-primary-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
                  >
                    Get started
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center rounded-md bg-primary-100 px-8 py-3 text-sm font-semibold text-primary-800 hover:bg-primary-200"
                  >
                    Log in
                  </Link>
                </div>
              </div>

              <div className="relative">
                <div className="mx-auto w-full max-w-lg">
                  <div className="relative h-72 overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-black/10 sm:h-80 lg:h-[420px]">
                    <img
                      src={shieldImage}
                      alt="Cybersecurity shield"
                      className="absolute inset-0 block h-full w-full object-cover object-center"
                      loading="eager"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/40" />

                    <div className="absolute right-4 top-4 rounded-lg bg-white/90 px-3 py-2 shadow-sm ring-1 ring-white/40 backdrop-blur">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
                        <span>Tab Switch Detected</span>
                      </div>
                    </div>

                    <div className="absolute bottom-4 left-4 rounded-xl bg-white/90 px-4 py-3 shadow-sm ring-1 ring-white/40 backdrop-blur">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                          <ShieldCheckIcon className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Status</p>
                          <p className="text-sm font-semibold text-slate-900">100% Secure</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gray-50 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold tracking-[0.24em] text-primary-700">KEY CAPABILITIES</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                A smarter way to prevent cheating
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-500 sm:text-lg">
                Our platform combines ease of use for educators with enterprise-grade security features to maintain the
                value of your assessments.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 ring-1 ring-primary-100">
                  <SparklesIcon className="h-5 w-5 text-primary-700" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">Intuitive Quiz Generation</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Teachers can effortlessly create diverse question types. Set time limits, randomize questions, and
                  schedule exams with just a few clicks.
                </p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 ring-1 ring-primary-100">
                  <NoSymbolIcon className="h-5 w-5 text-primary-700" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">Anti-Cheating Measures</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  The browser environment is locked down. We disable copy-paste functions, right clicking, and restrict
                  access to external tools during the exam.
                </p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 ring-1 ring-primary-100">
                  <BellAlertIcon className="h-5 w-5 text-primary-700" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">Real-Time Violation Alerts</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Detect tab switching instantly. Upon submission, teachers receive a detailed report highlighting any
                  suspicious activity or rule breaches.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-slate-500">© 2023 Quiz Shield Inc. All rights reserved.</p>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <a href="#" className="hover:text-slate-900">
                Privacy
              </a>
              <a href="#" className="hover:text-slate-900">
                Terms
              </a>
              <a href="#" className="hover:text-slate-900">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
