import { Link } from 'react-router-dom';

// The legacy adaptive UI calls endpoints that were never implemented.
// Keep old links understandable until that workflow has end-to-end acceptance.
export default function QuizStartPage() {
  return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-semibold">Topic practice is not available yet</h1><p className="mt-4 text-gray-600">Use your teacher’s four-digit assessment code to join a scheduled quiz. Reviewed practice suggestions appear after your results are released.</p><div className="mt-6 flex flex-wrap gap-4"><Link className="rounded-lg bg-primary-700 px-5 py-3 text-white" to="/dashboard/student/join-quiz">Join an assessment</Link><Link className="py-3 underline" to="/courses">Back to courses</Link></div></main>;
}
