import { LockClosedIcon } from '@heroicons/react/24/solid';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Wraps any content that requires a Pro or School plan.
 * Free-plan teachers see the content blurred with a lock overlay.
 * Never hides the content — always shows what they are missing.
 */
export default function ProGate({ children, feature = 'This feature', inline = false }) {
  const { isPro } = useAuth();
  const navigate  = useNavigate();

  if (isPro) return children;

  if (inline) {
    return (
      <span className="inline-flex items-center gap-1 text-slate-400 cursor-pointer" onClick={() => navigate('/billing')}>
        <LockClosedIcon className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">Pro</span>
      </span>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Blurred content preview */}
      <div className="select-none pointer-events-none blur-sm opacity-60" aria-hidden>
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px] p-6">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center max-w-xs">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <LockClosedIcon className="w-5 h-5 text-primary-600" />
          </div>
          <p className="font-semibold text-slate-900 text-sm mb-1">{feature} requires Pro</p>
          <p className="text-xs text-slate-500 mb-4">Upgrade to unlock unlimited exams, analytics, branding and more.</p>
          <button
            onClick={() => navigate('/billing')}
            className="btn-primary btn-sm w-full"
          >
            Upgrade to Pro — $12/mo
          </button>
        </div>
      </div>
    </div>
  );
}

/** Inline lock icon shown next to feature labels in the sidebar / form fields */
export function ProBadge() {
  const { isPro } = useAuth();
  if (isPro) return null;
  return (
    <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-1 uppercase tracking-wide">
      <LockClosedIcon className="w-2.5 h-2.5" /> Pro
    </span>
  );
}
