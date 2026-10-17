import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../services/api';

export default function ReviewedPractice() {
  const [items, setItems] = useState<{ attempt_id: string; suggestions: string[]; created_at: string }[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/automations/followups').then(r => setItems(r.data.data)).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);
  return <div className="max-w-4xl space-y-6"><header><h1 className="font-display text-3xl text-ink-950">Practice suggestions</h1><p className="mt-2 text-sm text-ink-500">Prepared from your reviewed, released results and teacher feedback.</p></header>
    {loading && <p>Loading suggestions…</p>}
    {error && <p role="alert">Suggestions could not be loaded. Please try again later.</p>}
    {!loading && !error && !items.length && <p className="rounded-2xl border bg-white p-6 text-ink-500">Your practice suggestions will appear after your teacher releases reviewed results.</p>}
    {items.map(item => <article key={item.attempt_id} className="rounded-2xl border border-ink-200 bg-white p-6"><h2 className="font-semibold">Your next practice steps</h2><ul className="mt-4 list-disc pl-5 space-y-3 text-sm text-ink-600">{item.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul><Link className="mt-5 inline-block text-sm text-primary-700" to={`/quiz/teacher-results/${item.attempt_id}`}>View reviewed results</Link></article>)}
  </div>;
}
