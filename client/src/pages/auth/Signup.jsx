import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SparklesIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api';
import Spinner from '../../components/UI/Spinner';

const perks = [
  'Create unlimited exam papers with AI',
  'Question bank with dedup detection',
  'Student results & progress tracking',
  'Start free — no credit card needed',
];

export default function Signup() {
  const { login } = useAuth();
  const toast     = useToast();
  const navigate  = useNavigate();

  const [form, setForm]     = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim())    e.name     = 'Your name is required.';
    if (!form.email.trim())   e.email    = 'Email is required.';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await api.post('/auth/signup', {
        name:     form.name.trim(),
        email:    form.email.trim().toLowerCase(),
        password: form.password,
      });
      if (!data) return;
      login(data.token, data.teacher);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err.code === 'duplicate') {
        setErrors({ email: 'An account with this email already exists.' });
      } else {
        toast(err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-8 items-center">

        {/* Left — value prop */}
        <div className="hidden lg:block text-white">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl tracking-tight">Gradispace</span>
          </div>
          <h2 className="text-3xl font-bold mb-4 leading-snug">
            The smarter way to<br />run your exams.
          </h2>
          <p className="text-slate-400 mb-8">
            Generate questions with AI, build custom exam papers, publish to students, and track their progress — all in one place.
          </p>
          <ul className="space-y-3">
            {perks.map(p => (
              <li key={p} className="flex items-center gap-3 text-sm text-slate-300">
                <div className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckIcon className="w-3 h-3 text-white" />
                </div>
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Right — form */}
        <div>
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
              <span className="text-white font-bold text-2xl">Gradispace</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h1 className="text-xl font-bold text-slate-900 mb-1">Create your account</h1>
            <p className="text-sm text-slate-500 mb-6">Free forever — upgrade anytime.</p>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label className="label">Your name</label>
                <input
                  type="text"
                  className={`input ${errors.name ? 'input-error' : ''}`}
                  placeholder="Mrs. Ahmed"
                  value={form.name}
                  onChange={set('name')}
                  autoComplete="name"
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="label">Email address</label>
                <input
                  type="email"
                  className={`input ${errors.email ? 'input-error' : ''}`}
                  placeholder="you@school.com"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  className={`input ${errors.password ? 'input-error' : ''}`}
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>

              <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
                {loading ? <><Spinner size="sm" /> Creating account…</> : 'Create free account'}
              </button>

              <p className="text-[11px] text-center text-slate-400">
                By signing up you agree to our Terms of Service and Privacy Policy.
              </p>
            </form>
          </div>

          <p className="text-center text-sm text-slate-400 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-white font-medium hover:underline">Sign in →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
