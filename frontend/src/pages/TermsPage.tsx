import { Link } from 'react-router-dom';
import { Brand } from '../components/shared';

const termsPoints = [
  {
    title: 'Authorized use only',
    description:
      'Accounts should only be used by the teacher or student assigned to them, and exam credentials must not be shared.',
  },
  {
    title: 'Academic integrity',
    description:
      'Students must follow the exam rules shown by their instructor, including webcam verification and proctoring checks.',
  },
  {
    title: 'Service availability',
    description:
      'QuizShield is provided on a best-effort basis and may be updated or temporarily unavailable during maintenance.',
  },
];

const TermsPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <Brand to="/" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold tracking-[0.24em] text-primary-700">LEGAL</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Terms of Use</h1>
        <p className="mt-6 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          These terms describe the basic expectations for using the QuizShield platform in a school or training
          environment.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {termsPoints.map((point) => (
            <section key={point.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-base font-semibold text-slate-900">{point.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{point.description}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
          >
            Get started
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary-100 px-5 py-3 text-sm font-semibold text-primary-800 hover:bg-primary-200"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    </div>
  );
};

export default TermsPage;