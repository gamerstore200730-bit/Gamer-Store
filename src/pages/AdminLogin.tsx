import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 60;

export default function AdminLogin({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [lockLeft, setLockLeft] = useState(0);

  const locked = lockUntil !== null && Date.now() < lockUntil;

  useEffect(() => {
    if (lockUntil === null) return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setLockLeft(left);
      if (left === 0) {
        setLockUntil(null);
        setAttempts(0);
        setError(null);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [lockUntil]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setBusy(false);
      console.error('signInWithPassword error:', err.message, 'status:', err.status);
      const unconfirmed = err.status === 400 && /confirm/i.test(err.message);
      const next = attempts + 1;
      setAttempts(next);
      if (unconfirmed) {
        setError('هذا الإيميل غير مؤكد بعد');
      } else if (next >= MAX_ATTEMPTS) {
        setLockUntil(Date.now() + LOCK_SECONDS * 1000);
        setLockLeft(LOCK_SECONDS);
        setError(`تم إيقاف المحاولات مؤقتًا. حاول مرة أخرى بعد ${LOCK_SECONDS} ثانية.`);
      } else {
        setError('بيانات الدخول غير صحيحة');
      }
      return;
    }

    const user = data.user ?? (await supabase.auth.getUser()).data.user;
    if (!user) {
      setBusy(false);
      console.error('No user returned after successful sign-in');
      setError('تعذر التحقق من الحساب. حاول مرة أخرى.');
      return;
    }

    const { data: adminRow, error: adminErr } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (adminErr) {
      setBusy(false);
      console.error('admins lookup error:', adminErr.message, 'code:', adminErr.code);
      await supabase.auth.signOut();
      setError('حدث خطأ أثناء التحقق من الصلاحيات. حاول مرة أخرى.');
      return;
    }
    if (!adminRow) {
      setBusy(false);
      console.error('User is not in admins table:', user.id);
      await supabase.auth.signOut();
      setError('هذا الحساب ليس حساب المالك');
      return;
    }

    setAttempts(0);
    setBusy(false);
    onSuccess?.();
  };

  return (
    <div className="page-enter mx-auto flex w-full max-w-sm flex-col items-center px-4 pt-10">
      <div className="w-full rounded-2xl border border-grape/40 bg-card p-6 shadow-glowSoft">
        <div className="mb-5 flex flex-col items-center gap-2">
          <span className="rounded-full bg-grape-deep p-3 text-grape-light">
            <Lock size={22} />
          </span>
          <h2 className="text-lg font-black text-white">دخول المالك</h2>
          <p className="text-center text-xs text-muted">هذه الصفحة مخصصة لإدارة الستور فقط.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-body">البريد الإلكتروني</span>
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={locked}
              className="w-full rounded-xl border border-grape/30 bg-ink px-4 py-3 text-left text-white focus:border-grape-light focus:shadow-glowSoft disabled:opacity-50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-body">كلمة المرور</span>
            <input
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={locked}
              className="w-full rounded-xl border border-grape/30 bg-ink px-4 py-3 text-left text-white focus:border-grape-light focus:shadow-glowSoft disabled:opacity-50"
            />
          </label>
          {error && <p className="text-sm font-semibold text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy || locked}
            className="w-full rounded-xl bg-grape py-3 font-black text-white transition hover:shadow-glow disabled:opacity-50"
          >
            {locked
              ? `مقفول مؤقتًا (${lockLeft} ثانية)`
              : busy
                ? 'جارٍ الدخول...'
                : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
