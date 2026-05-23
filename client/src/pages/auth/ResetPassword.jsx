import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { api } from '../../api';
import { useToast } from '../../contexts/ToastContext';
import Spinner from '../../components/UI/Spinner';

export default function ResetPassword() {
  const [params]   = useSearchParams();
  const token      = params.get('token') || '';
  const toast      = useToast();
  const navigate   = useNavigate();

  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      toast('Password reset successfully. Please sign in.', 'success');
      navigate('/login');
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
          <h1 className="text-xl font-bold text-slate-900 mb-1">Set a new password</h1>
          <p className="text-sm text-slate-500 mb-6">Choose something you haven't used before.</p>

          {!token ? (
            <div className="text-center">
              <p className="text-sm text-red-500 mb-4">Invalid or missing reset token.</p>
              <Link to="/forgot-password" className="btn-primary">Request a new link</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label className="label">New password</label>
                <input
                  type="password"
                  className={`input ${error ? 'input-error' : ''}`}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  autoComplete="new-password"
                />
                {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? <><Spinner size="sm" /> Saving…</> : 'Reset password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
