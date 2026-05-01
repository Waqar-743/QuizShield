import { Link } from 'react-router-dom';
import { Brand } from '../components/shared';

const privacyPoints = [
  {
    title: 'Data we collect',
    description:
      'QuizShield only stores the account, course, quiz, and verification data needed to authenticate users and protect assessments.',
  },
  {
    title: 'How we use it',
    description:
      'Information is used to run the platform, verify student identity, generate reports, and support instructors during exams.',
  },
  {
    title: 'Retention and access',
    description:
      'Administrative data is retained for as long as the account or school deployment needs it, and access is limited to authorized users.',
  },
];

const PrivacyPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <Brand to="/" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold tracking-[0.24em] text-primary-700">LEGAL</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Privacy Policy</h1>
        <p className="mt-6 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          QuizShield is designed to collect the minimum information required to keep exams secure and support the
          learning experience.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {privacyPoints.map((point) => (
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
            Create account
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

export default PrivacyPage;