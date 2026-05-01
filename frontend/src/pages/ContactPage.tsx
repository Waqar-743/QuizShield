import { Link } from 'react-router-dom';
import { Brand } from '../components/shared';

const contactChannels = [
  {
    title: 'School administrator',
    description: 'Most QuizShield deployments are managed by your institution, so that is the first place to request help.',
  },
  {
    title: 'Instructor support',
    description: 'Teachers can review quiz activity, student status, and proctoring flags from their dashboard.',
  },
  {
    title: 'Account access',
    description: 'If you cannot sign in, use the password reset flow or ask your teacher to confirm your access.',
  },
];

const ContactPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <Brand to="/" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold tracking-[0.24em] text-primary-700">SUPPORT</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Contact</h1>
        <p className="mt-6 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          QuizShield support is usually handled through the institution that deployed the platform. The options below
          cover the most common ways to get help.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {contactChannels.map((channel) => (
            <section key={channel.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-base font-semibold text-slate-900">{channel.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{channel.description}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-md bg-primary-100 px-5 py-3 text-sm font-semibold text-primary-800 hover:bg-primary-200"
          >
            Create account
          </Link>
        </div>
      </main>
    </div>
  );
};

export default ContactPage;