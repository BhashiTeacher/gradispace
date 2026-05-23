import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  CheckIcon, XMarkIcon, SparklesIcon, CreditCardIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api';
import Spinner from '../../components/UI/Spinner';

// ── Plan feature lists ────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: null,
    tagline: 'Get started at no cost',
    colour: 'slate',
    features: [
      { label: '3 exams',                   included: true },
      { label: '50 questions in bank',       included: true },
      { label: '10 AI generations / month',  included: true },
      { label: 'Open exams only',            included: true },
      { label: 'Analytics & reports',        included: false },
      { label: 'Custom branding',            included: false },
      { label: 'Classrooms & rosters',       included: false },
      { label: 'Closed (email-gated) exams', included: false },
      { label: 'XLSX / CSV export',          included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 12,
    interval: 'month',
    tagline: 'For individual teachers',
    colour: 'primary',
    highlight: true,
    features: [
      { label: 'Unlimited exams',             included: true },
      { label: 'Unlimited question bank',     included: true },
      { label: '200 AI generations / month',  included: true },
      { label: 'Open & closed exams',         included: true },
      { label: 'Analytics & reports',         included: true },
      { label: 'Custom branding',             included: true },
      { label: 'Classrooms & rosters',        included: true },
      { label: 'PDF reports + XLSX export',   included: true },
      { label: 'Priority email support',      included: true },
    ],
  },
  {
    id: 'school',
    name: 'School',
    price: 35,
    interval: 'month',
    tagline: 'For departments & schools',
    colour: 'purple',
    features: [
      { label: 'Everything in Pro',           included: true },
      { label: 'Unlimited AI generations',    included: true },
      { label: 'School-wide analytics',       included: true },
      { label: 'Bulk student import',         included: true },
      { label: 'Multiple teachers (soon)',    included: true },
      { label: 'Dedicated onboarding',        included: true },
      { label: 'Priority support & SLA',      included: true },
    ],
  },
];

const STATUS_STYLES = {
  active:    'bg-green-100 text-green-700',
  trialing:  'bg-blue-100 text-blue-700',
  past_due:  'bg-red-100 text-red-600',
  canceled:  'bg-slate-100 text-slate-500',
};

const COLOUR = {
  slate:   { ring: 'ring-slate-200',   btn: 'btn-secondary', badge: 'bg-slate-100 text-slate-700' },
  primary: { ring: 'ring-primary-400', btn: 'btn-primary',   badge: 'bg-primary-100 text-primary-700' },
  purple:  { ring: 'ring-purple-400',  btn: 'bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors', badge: 'bg-purple-100 text-purple-700' },
};

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, currentPlan, onUpgrade, onPortal, loading }) {
  const isCurrent  = plan.id === currentPlan;
  const isUpgrade  = ['free','pro','school'].indexOf(plan.id) > ['free','pro','school'].indexOf(currentPlan);
  const c = COLOUR[plan.colour] || COLOUR.slate;

  return (
    <div className={`card p-6 flex flex-col ring-2 ${isCurrent ? c.ring : 'ring-transparent'} ${plan.highlight ? 'shadow-lg' : ''}`}>
      {plan.highlight && (
        <div className="text-center mb-4">
          <span className="text-xs font-bold uppercase tracking-wider bg-primary-600 text-white px-3 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-4">
        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${c.badge}`}>{plan.name}</span>
        <p className="mt-3">
          {plan.price === 0
            ? <span className="text-3xl font-bold text-slate-900">Free</span>
            : <>
                <span className="text-3xl font-bold text-slate-900">${plan.price}</span>
                <span className="text-slate-400 text-sm"> / month</span>
              </>}
        </p>
        <p className="text-sm text-slate-500 mt-1">{plan.tagline}</p>
      </div>

      <ul className="space-y-2 flex-1 mb-6">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            {f.included
              ? <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              : <XMarkIcon className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />}
            <span className={f.included ? 'text-slate-700' : 'text-slate-400'}>{f.label}</span>
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <button disabled className="btn-ghost w-full text-slate-400 cursor-default">
          Current Plan
        </button>
      ) : isUpgrade ? (
        <button onClick={() => onUpgrade(plan.id)} disabled={!!loading}
          className={`w-full ${c.btn} flex items-center justify-center gap-2`}>
          {loading === plan.id && <Spinner className="w-4 h-4" />}
          {plan.price === 0 ? 'Downgrade' : `Upgrade to ${plan.name}`}
        </button>
      ) : (
        <button onClick={onPortal} disabled={!!loading}
          className="btn-secondary w-full flex items-center justify-center gap-2">
          {loading === 'portal' && <Spinner className="w-4 h-4" />}
          Manage Subscription
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Billing() {
  const { teacher, refreshMe } = useAuth();
  const { toast } = useToast();
  const navigate   = useNavigate();
  const [searchParams] = useSearchParams();

  const [sub, setSub]       = useState(null);
  const [subLoading, setSubLoading] = useState(true);
  const [loading, setLoading] = useState(null); // planId | 'portal' | null

  const currentPlan = teacher?.plan || 'free';

  // Show feedback from Stripe redirect
  useEffect(() => {
    if (searchParams.get('success') === '1') {
      toast('Subscription activated! Welcome to Pro.', 'success');
      refreshMe();
      navigate('/billing', { replace: true });
    }
    if (searchParams.get('canceled') === '1') {
      toast('Checkout was canceled — no charge made.', 'info');
      navigate('/billing', { replace: true });
    }
  }, []); // eslint-disable-line

  // Load subscription details
  useEffect(() => {
    api.get('/billing/subscription')
      .then(data => setSub(data))
      .catch(() => {})
      .finally(() => setSubLoading(false));
  }, []);

  async function handleUpgrade(planId) {
    setLoading(planId);
    try {
      const { url } = await api.post('/billing/checkout', { planId });
      window.location.href = url;
    } catch (err) {
      toast(err.message || 'Could not start checkout. Please try again.', 'error');
      setLoading(null);
    }
  }

  async function handlePortal() {
    setLoading('portal');
    try {
      const { url } = await api.post('/billing/portal');
      window.location.href = url;
    } catch (err) {
      toast(err.message || 'Could not open billing portal.', 'error');
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Billing &amp; Plan</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your Gradispace subscription</p>
        </div>
        {currentPlan !== 'free' && (
          <button onClick={handlePortal} disabled={!!loading}
            className="btn-secondary flex items-center gap-2">
            {loading === 'portal' ? <Spinner className="w-4 h-4" /> : <CreditCardIcon className="w-4 h-4" />}
            Manage Billing
          </button>
        )}
      </div>

      {/* Current plan status */}
      <div className="card p-5 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Current plan</p>
              <p className="font-semibold text-slate-900 capitalize">{currentPlan}</p>
            </div>
          </div>

          {subLoading ? (
            <Spinner className="w-5 h-5 text-slate-400" />
          ) : sub ? (
            <div className="flex items-center gap-4 flex-wrap">
              <span className={`text-xs font-semibold uppercase px-2 py-1 rounded-full ${STATUS_STYLES[sub.status] || STATUS_STYLES.active}`}>
                {sub.status?.replace('_', ' ') || 'Active'}
              </span>
              {sub.currentPeriodEnd && (
                <p className="text-sm text-slate-500">
                  {sub.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on{' '}
                  <span className="font-medium text-slate-700">
                    {new Date(sub.currentPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* Past due warning */}
        {sub?.status === 'past_due' && (
          <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Payment failed</p>
              <p className="text-xs text-red-600 mt-0.5">
                Your last payment could not be processed. Please update your payment method to keep access.
              </p>
              <button onClick={handlePortal} className="btn-danger btn-sm mt-2">Update Payment Method</button>
            </div>
          </div>
        )}

        {/* Cancel notice */}
        {sub?.cancelAtPeriodEnd && (
          <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              Your plan is set to cancel at the end of the billing period. You can reactivate anytime from the billing portal.
            </p>
          </div>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {PLANS.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            currentPlan={currentPlan}
            onUpgrade={handleUpgrade}
            onPortal={handlePortal}
            loading={loading}
          />
        ))}
      </div>

      {/* Notes */}
      <div className="card p-5 text-sm text-slate-500 space-y-2">
        <p className="font-medium text-slate-700">Billing notes</p>
        <ul className="space-y-1.5 list-disc list-inside">
          <li>Subscriptions are billed monthly and can be canceled at any time from the billing portal.</li>
          <li>Downgrading to Free will take effect at the end of your current billing period.</li>
          <li>All payments are processed securely by <a href="https://stripe.com" target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">Stripe</a>.</li>
          <li>Need a custom plan for a large institution? <a href="mailto:hello@gradispace.com" className="text-primary-600 hover:underline">Contact us</a>.</li>
        </ul>
      </div>
    </div>
  );
}
