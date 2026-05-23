import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SparklesIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { api } from '../../api';
import Spinner from '../../components/UI/Spinner';

export default function ForgotPassword() {
  const [email, setEmail]   = useState('');
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required.'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-bold text-2xl">Gradispace</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircleIcon className="w-7 h-7 text-green-600" />
              </div>
              <h1 className="text-lg font-bold text-slate-900 mb-2">Check your inbox</h1>
              <p className="text-sm text-slate-500 mb-6">
                If an account exists for <strong>{email}</strong>, a reset link has been sent. It expires in 1 hour.
              </p>
              <Link to="/login" className="btn-primary w-full justify-center">Back to sign in</Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-slate-900 mb-1">Forgot your password?</h1>
              <p className="text-sm text-slate-500 mb-6">Enter your email and we'll send a reset link.</p>
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email"
                    className={`input ${error ? 'input-error' : ''}`}
                    placeholder="you@school.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                  />
                  {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                </div>
                <button type="submit" className="btn-primary w-full" disabled={loading}>
                  {loading ? <><Spinner size="sm" /> Sending…</> : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-slate-400 mt-5">
          <Link to="/login" className="text-white hover:underline">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
