import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  DocumentTextIcon, CircleStackIcon, UsersIcon, SparklesIcon,
  PencilSquareIcon, ChartBarIcon, RocketLaunchIcon, EyeIcon,
  ArrowRightIcon, CheckCircleIcon, ClockIcon, LockClosedIcon,
  ShareIcon, XMarkIcon, ClipboardDocumentIcon, CheckIcon, PrinterIcon,
} from '@heroicons/react/24/outline';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api';
import Spinner from '../../components/UI/Spinner';
import Badge from '../../components/UI/Badge';

// ─── Share modal ─────────────────────────────────────────────────────────────

function ShareModal({ link, title, onClose }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-900">Share Exam</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-5 truncate">{title}</p>
        <div className="flex justify-center mb-5">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <QRCodeSVG value={link} size={160} />
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 mb-4">
          <span className="text-xs text-slate-600 flex-1 truncate font-mono">{link}</span>
          <button onClick={copyLink} className="btn-secondary btn-sm flex-shrink-0">
            {copied
              ? <><CheckIcon className="w-4 h-4 text-green-500 mr-1" />Copied!</>
              : <><ClipboardDocumentIcon className="w-4 h-4 mr-1" />Copy</>
            }
          </button>
        </div>
        <button onClick={onClose} className="btn-ghost btn-sm w-full">Close</button>
      </div>
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, colour, warning }) {
  const colours = {
    blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-500',   text: 'text-blue-600' },
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-500', text: 'text-purple-600' },
    green:  { bg: 'bg-green-50',  icon: 'bg-green-500',  text: 'text-green-600' },
    amber:  { bg: 'bg-amber-50',  icon: 'bg-amber-500',  text: 'text-amber-600' },
  };
  const c = colours[colour] || colours.blue;

  return (
    <div className={`card p-5 ${warning ? 'ring-2 ring-amber-400' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.icon}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {warning && (
          <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
            LIMIT NEAR
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-0.5">{value ?? '—'}</p>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

// ─── Recent exam row ─────────────────────────────────────────────────────────

function ExamRow({ exam, onUnpublish, onPublish, onShare, onPrint }) {
  const navigate = useNavigate();
  const [unpublishing, setUnpublishing] = useState(false);
  const [publishing, setPublishing]     = useState(false);

  async function handleUnpublish(e) {
    e.stopPropagation();
    setUnpublishing(true);
    try { await onUnpublish(exam.id); }
    finally { setUnpublishing(false); }
  }

  async function handlePublish(e) {
    e.stopPropagation();
    setPublishing(true);
    try { await onPublish(exam.id); }
    finally { setPublishing(false); }
  }

  return (
    <div className="flex items-center gap-4 py-3.5 px-1 hover:bg-slate-50 rounded-lg transition-colors group">
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${exam.published ? 'bg-green-500' : 'bg-slate-300'}`} />

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{exam.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {exam.subject && (
            <span className="text-xs text-slate-500">{exam.subject}</span>
          )}
          {exam.grade_level && (
            <>
              <span className="text-slate-300 text-xs">·</span>
              <span className="text-xs text-slate-500">{exam.grade_level}</span>
            </>
          )}
          {exam.exam_type === 'closed' && (
            <>
              <span className="text-slate-300 text-xs">·</span>
              <span className="inline-flex items-center gap-0.5 text-xs text-slate-500">
                <LockClosedIcon className="w-3 h-3" /> Closed
              </span>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-900">{exam.question_count ?? 0}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Qs</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-900">{exam.submission_count ?? 0}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Submitted</p>
        </div>
      </div>

      {/* Status badge */}
      <Badge variant={exam.published ? 'green' : 'gray'} className="flex-shrink-0 hidden sm:inline-flex">
        {exam.published ? 'Live' : 'Draft'}
      </Badge>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => navigate(`/exams/${exam.id}`)}
          className="btn-ghost btn-sm"
          title="Edit exam"
        >
          <PencilSquareIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate(`/results?examId=${exam.id}`)}
          className="btn-ghost btn-sm"
          title="View results"
        >
          <ChartBarIcon className="w-4 h-4" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onPrint(exam); }}
          className="btn-ghost btn-sm hidden sm:inline-flex"
          title="Print exam paper PDF"
        >
          <PrinterIcon className="w-4 h-4" />
        </button>
        {exam.published ? (
          <>
            <button
              onClick={e => { e.stopPropagation(); onShare(exam); }}
              className="btn-ghost btn-sm hidden sm:inline-flex"
              title="Share exam link"
            >
              <ShareIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleUnpublish}
              disabled={unpublishing}
              className="btn-ghost btn-sm text-xs text-slate-500 hidden sm:inline-flex"
              title="Unpublish exam"
            >
              {unpublishing ? <Spinner className="w-3.5 h-3.5" /> : 'Unpublish'}
            </button>
          </>
        ) : (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="btn-ghost btn-sm text-xs text-primary-600 hidden sm:inline-flex"
            title="Publish exam"
          >
            {publishing ? <Spinner className="w-3.5 h-3.5" /> : 'Publish'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Quick action card ───────────────────────────────────────────────────────

function QuickAction({ icon: Icon, label, description, to, colour = 'indigo' }) {
  const navigate = useNavigate();
  const colours = {
    indigo: 'hover:border-primary-300 hover:bg-primary-50',
    green:  'hover:border-green-300 hover:bg-green-50',
    purple: 'hover:border-purple-300 hover:bg-purple-50',
  };
  const iconColours = {
    indigo: 'bg-primary-100 text-primary-600',
    green:  'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <button
      onClick={() => navigate(to)}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 transition-all ${colours[colour]} group text-left`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColours[colour]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <ArrowRightIcon className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
    </button>
  );
}

// ─── AI Usage card ───────────────────────────────────────────────────────────

function AiUsageCard({ teacher, isPro }) {
  const used  = teacher?.aiUsage?.used  ?? 0;
  const limit = teacher?.aiUsage?.limit ?? null;
  const pct   = limit ? Math.min((used / limit) * 100, 100) : 0;
  const nearLimit = limit && used >= limit * 0.8;

  return (
    <div className="card p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <SparklesIcon className="w-4 h-4 text-amber-500" />
        <p className="text-sm font-semibold text-slate-900">AI Generations</p>
        <span className="ml-auto text-xs text-slate-500">This month</span>
      </div>

      <div className="flex items-end justify-between mb-2">
        <span className="text-2xl font-bold text-slate-900">{used}</span>
        <span className="text-sm text-slate-500">
          {limit ? `/ ${limit}` : '/ ∞'}
        </span>
      </div>

      {limit && (
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${nearLimit ? 'bg-amber-500' : 'bg-primary-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {!isPro && limit && (
        <p className="text-[11px] text-slate-400 mt-2">
          {limit - used > 0
            ? `${limit - used} generations left this month`
            : 'Monthly limit reached — '}
          {limit - used <= 0 && (
            <Link to="/billing" className="text-primary-600 font-medium hover:underline">upgrade for unlimited</Link>
          )}
        </p>
      )}
      {isPro && (
        <p className="text-[11px] text-slate-400 mt-2">Unlimited on your plan</p>
      )}
    </div>
  );
}

// ─── Free plan banner ────────────────────────────────────────────────────────

function FreePlanBanner() {
  const navigate = useNavigate();
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-primary-600 to-purple-600 rounded-xl p-5 mb-6 text-white">
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-bold text-base mb-1">You're on the Free plan</p>
          <p className="text-sm text-primary-100">
            Upgrade to Pro to unlock closed exams, file uploads, analytics, PDF reports, and your own branded student portal.
          </p>
        </div>
        <button
          onClick={() => navigate('/billing')}
          className="flex-shrink-0 bg-white text-primary-700 font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-primary-50 transition-colors self-start sm:self-auto"
        >
          Upgrade to Pro →
        </button>
      </div>
      {/* decorative circles */}
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full" />
      <div className="absolute -right-4 -bottom-8 w-24 h-24 bg-white/10 rounded-full" />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const { teacher, isPro, refreshMe } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [recentExams, setRecentExams]   = useState([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [shareModal, setShareModal]     = useState(null); // { link, title }

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [examsData] = await Promise.all([
        api.get('/exams?page=1&limit=5'),
        refreshMe(), // keep stats fresh
      ]);
      setRecentExams(examsData?.exams || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoadingExams(false);
    }
  }

  async function handleUnpublish(examId) {
    try {
      await api.post(`/exams/${examId}/unpublish`);
      setRecentExams(prev => prev.map(e => e.id === examId ? { ...e, published: false } : e));
      refreshMe();
      toast('Exam returned to draft.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handlePublish(examId) {
    try {
      const { exam, studentLink } = await api.post(`/exams/${examId}/publish`);
      setRecentExams(prev => prev.map(e =>
        e.id === examId ? { ...e, published: true, access_token: exam.access_token } : e
      ));
      refreshMe();
      setShareModal({ link: studentLink, title: exam.title });
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function handleShare(exam) {
    const link = `${window.location.origin}/e/${exam.access_token}`;
    setShareModal({ link, title: exam.title });
  }

  async function handlePrint(exam) {
    if (!isPro) { navigate('/billing'); return; }
    try {
      await api.download(`/exams/${exam.id}/print-pdf`, `${exam.title || 'exam'}_paper.pdf`);
    } catch (err) {
      toast(err.message || 'PDF generation failed.', 'error');
    }
  }

  // Stat card data
  const examLimit = isPro ? '∞' : '3';
  const bankLimit = isPro ? '∞' : '50';
  const nearExamLimit  = !isPro && (teacher?.examCount ?? 0) >= 2;
  const nearBankLimit  = !isPro && (teacher?.questionBankCount ?? 0) >= 40;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Good {getGreeting()}, {teacher?.name?.split(' ')[0] || 'Teacher'} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Here's what's happening with your exams.</p>
        </div>
        <button
          onClick={() => navigate('/exams/new')}
          className="btn-primary hidden sm:flex"
        >
          <PencilSquareIcon className="w-4 h-4" />
          New Exam
        </button>
      </div>

      {/* Free plan banner */}
      {!isPro && <FreePlanBanner />}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={DocumentTextIcon}
          label="Exams Created"
          value={teacher?.examCount ?? <Skeleton className="h-7 w-10" />}
          sub={`of ${examLimit} on your plan`}
          colour="blue"
          warning={nearExamLimit}
        />
        <StatCard
          icon={CircleStackIcon}
          label="Questions in Bank"
          value={teacher?.questionBankCount ?? <Skeleton className="h-7 w-10" />}
          sub={`of ${bankLimit} on your plan`}
          colour="purple"
          warning={nearBankLimit}
        />
        <StatCard
          icon={UsersIcon}
          label="Student Submissions"
          value={teacher?.submissionCount ?? <Skeleton className="h-7 w-10" />}
          sub="All time"
          colour="green"
        />
        <StatCard
          icon={SparklesIcon}
          label="AI Generations"
          value={
            teacher?.aiUsage
              ? `${teacher.aiUsage.used} / ${teacher.aiUsage.limit != null ? teacher.aiUsage.limit : '∞'}`
              : <Skeleton className="h-7 w-16" />
          }
          sub="This calendar month"
          colour="amber"
        />
      </div>

      {/* Content grid */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Recent Exams — 2/3 width */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Recent Exams</h2>
              <Link to="/exams/new" className="text-sm text-primary-600 hover:underline font-medium">
                + New exam
              </Link>
            </div>

            <div className="px-4 py-2 divide-y divide-slate-50">
              {loadingExams ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="py-4 flex items-center gap-4">
                    <Skeleton className="w-2 h-2 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                ))
              ) : recentExams.length === 0 ? (
                <div className="text-center py-12">
                  <DocumentTextIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-600 mb-1">No exams yet</p>
                  <p className="text-xs text-slate-400 mb-4">Create your first exam to get started.</p>
                  <button onClick={() => navigate('/exams/new')} className="btn-primary btn-sm">
                    Create Exam
                  </button>
                </div>
              ) : (
                recentExams.map(exam => (
                  <ExamRow key={exam.id} exam={exam}
                    onUnpublish={handleUnpublish}
                    onPublish={handlePublish}
                    onShare={handleShare}
                    onPrint={handlePrint}
                  />
                ))
              )}
            </div>

            {recentExams.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-100">
                <button
                  onClick={() => navigate('/exams/new')}
                  className="text-sm text-slate-500 hover:text-primary-600 transition-colors"
                >
                  View all exams →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right column — Quick actions + AI usage */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="card p-4">
            <h2 className="font-semibold text-slate-900 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <QuickAction
                icon={PencilSquareIcon}
                label="Create New Exam"
                description="Build from scratch or with AI"
                to="/exams/new"
                colour="indigo"
              />
              <QuickAction
                icon={CircleStackIcon}
                label="Question Bank"
                description="Browse and manage your questions"
                to="/questions"
                colour="purple"
              />
              <QuickAction
                icon={ChartBarIcon}
                label="View Results"
                description="Student scores and analytics"
                to="/results"
                colour="green"
              />
            </div>
          </div>

          {/* AI Usage */}
          <AiUsageCard teacher={teacher} isPro={isPro} />

          {/* Getting started checklist — shown until at least one exam exists */}
          {!loadingExams && recentExams.length === 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <RocketLaunchIcon className="w-4 h-4 text-primary-600" />
                <p className="text-sm font-semibold text-slate-900">Getting started</p>
              </div>
              <ul className="space-y-2.5">
                {[
                  { label: 'Account created', done: true },
                  { label: 'Create your first exam', done: false, to: '/exams/new' },
                  { label: 'Publish & share with students', done: false },
                  { label: 'View student results', done: false },
                ].map(item => (
                  <li key={item.label} className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-green-100' : 'bg-slate-100'}`}>
                      {item.done
                        ? <CheckCircleIcon className="w-3.5 h-3.5 text-green-600" />
                        : <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                      }
                    </div>
                    {item.to ? (
                      <button onClick={() => navigate(item.to)} className="text-xs text-primary-600 hover:underline font-medium">
                        {item.label}
                      </button>
                    ) : (
                      <span className={`text-xs ${item.done ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                        {item.label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {shareModal && (
        <ShareModal
          link={shareModal.link}
          title={shareModal.title}
          onClose={() => setShareModal(null)}
        />
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
