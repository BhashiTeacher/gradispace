import { useState, useEffect, useRef } from 'react';
import {
  ChartBarIcon, DocumentArrowDownIcon, TrashIcon,
  MagnifyingGlassIcon, XMarkIcon, ArrowDownTrayIcon,
  UserCircleIcon, ClipboardDocumentCheckIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api';
import Spinner from '../../components/UI/Spinner';
import ProGate, { ProBadge } from '../../components/UI/ProGate';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const LIMIT = 25;

// ── Helpers ───────────────────────────────────────────────────────────────────
const GRADE_STYLES = {
  'Excellent':       'bg-green-100 text-green-700',
  'Good':            'bg-blue-100  text-blue-700',
  'Keep Practising': 'bg-amber-100 text-amber-700',
  'Try Again':       'bg-red-100   text-red-700',
};

function GradeBadge({ grade }) {
  return (
    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full whitespace-nowrap ${GRADE_STYLES[grade] || 'bg-slate-100 text-slate-500'}`}>
      {grade || '—'}
    </span>
  );
}

function StatCard({ label, value, sub, colour }) {
  const c = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    amber:  'bg-amber-50 text-amber-600',
    red:    'bg-red-50 text-red-600',
    slate:  'bg-slate-50 text-slate-600',
  }[colour] || 'bg-slate-50 text-slate-600';
  return (
    <div className={`card p-5 ${c}`}>
      <p className="text-2xl font-bold mb-0.5">{value ?? '—'}</p>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({ submissionId, onClose, onSaved }) {
  const toast = useToast();
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [subData, setSubData]   = useState(null);
  const [marks, setMarks]       = useState({});  // questionId → 0 | 1
  const [notes, setNotes]       = useState({});  // questionId → string

  useEffect(() => {
    api.get(`/results/${submissionId}/for-review`)
      .then(data => {
        setSubData(data);
        const initMarks = {};
        const initNotes = {};
        data.answers.forEach(a => {
          if (a.type !== 'short_answer') return;
          if (a.override) {
            initMarks[a.questionId] = parseFloat(a.override.override_marks) > 0 ? 1 : 0;
            initNotes[a.questionId] = a.override.teacher_note || '';
          } else {
            // Default: if auto-matched (isCorrect===true) → 1, else 0
            initMarks[a.questionId] = a.isCorrect === true ? 1 : 0;
            initNotes[a.questionId] = '';
          }
        });
        setMarks(initMarks);
        setNotes(initNotes);
      })
      .catch(err => { toast(err.message || 'Failed to load.', 'error'); onClose(); })
      .finally(() => setLoading(false));
  }, [submissionId]); // eslint-disable-line

  async function handleSave() {
    setSaving(true);
    const shortAnswerQs = (subData?.answers || []).filter(a => a.type === 'short_answer');
    const overrides = shortAnswerQs.map(a => ({
      questionId: a.questionId,
      overrideMarks: marks[a.questionId] ?? 0,
      teacherNote: notes[a.questionId] || null,
    }));
    try {
      const res = await api.post(`/results/${submissionId}/review`, { overrides });
      toast(`Review saved. Final score: ${res.pct}% — ${res.grade}`, 'success');
      onSaved(submissionId, res);
      onClose();
    } catch (err) {
      toast(err.message || 'Failed to save review.', 'error');
    } finally { setSaving(false); }
  }

  const shortAnswers = (subData?.answers || []).filter(a => a.type === 'short_answer');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-900">Review Written Answers</h2>
            {subData && (
              <p className="text-xs text-slate-500 mt-0.5">
                {subData.result.student_name}
                {subData.result.student_class && ` · ${subData.result.student_class}`}
                {' · '}{subData.result.exam_title}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading && <div className="flex justify-center py-12"><Spinner className="w-7 h-7 text-primary-500" /></div>}

          {!loading && shortAnswers.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No written answers to review.</p>
          )}

          {!loading && shortAnswers.map((a, i) => (
            <div key={a.questionId} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Question {i + 1}</p>
              <p className="text-sm font-medium text-slate-800 leading-snug">{a.stem}</p>

              {/* Student's answer */}
              <div>
                <p className="text-xs text-slate-500 mb-1 font-medium">Student's answer</p>
                <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap min-h-[40px]">
                  {a.given || <span className="text-slate-400 italic">No answer given</span>}
                </div>
              </div>

              {/* Expected answer */}
              {a.correct && (
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-medium">Expected answer</p>
                  <div className="bg-green-50 rounded-lg px-3 py-2 text-sm text-green-800">{a.correct}</div>
                </div>
              )}

              {/* Mark toggle */}
              <div className="flex items-center gap-3 pt-1">
                <p className="text-xs font-medium text-slate-600 mr-1">Mark as:</p>
                <button
                  onClick={() => setMarks(m => ({ ...m, [a.questionId]: 1 }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors
                    ${marks[a.questionId] === 1
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-green-400 hover:text-green-600'}`}>
                  ✓ Correct
                </button>
                <button
                  onClick={() => setMarks(m => ({ ...m, [a.questionId]: 0 }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors
                    ${marks[a.questionId] === 0
                      ? 'bg-red-500 border-red-500 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-red-400 hover:text-red-600'}`}>
                  ✗ Incorrect
                </button>
              </div>

              {/* Teacher note */}
              <input
                type="text"
                placeholder="Teacher note (optional)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-primary-400"
                value={notes[a.questionId] || ''}
                onChange={e => setNotes(n => ({ ...n, [a.questionId]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        {!loading && shortAnswers.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
            <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary btn-sm flex items-center gap-1.5">
              {saving ? <Spinner className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
              Finalise Result
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Results() {
  const { isPro } = useAuth();
  const toast = useToast();
  const navigate  = useNavigate();

  const [tab, setTab] = useState('results');

  // ── Results tab ──
  const [results, setResults]             = useState([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [exams, setExams]                 = useState([]);
  const [filterExam, setFilterExam]       = useState('');
  const [filterFrom, setFilterFrom]       = useState('');
  const [filterTo, setFilterTo]           = useState('');
  const [filterEmail, setFilterEmail]     = useState('');
  const [deleting, setDeleting]           = useState(null);
  const [exporting, setExporting]         = useState(false);
  const [filterNeedsReview, setFilterNeedsReview] = useState(false);
  const [reviewId, setReviewId]           = useState(null);
  const emailTimer                        = useRef(null);

  // ── Analytics tab ──
  const [stats, setStats]             = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsExam, setStatsExam]     = useState('');

  // ── Reports tab ──
  const [reportEmail, setReportEmail]       = useState('');
  const [studentData, setStudentData]       = useState(null);
  const [reportLoading, setReportLoading]   = useState(false);
  const [reportDownloading, setReportDownloading] = useState(false);

  // Load exams for filter dropdown
  useEffect(() => {
    api.get('/exams?limit=100').then(({ exams: es }) => setExams(es)).catch(() => {});
  }, []);

  // Load results on filters change
  useEffect(() => { loadResults(1); }, [filterExam, filterFrom, filterTo, filterNeedsReview]); // eslint-disable-line

  function buildParams(extra = {}) {
    const p = new URLSearchParams(extra);
    if (filterExam)  p.set('examId',   filterExam);
    if (filterFrom)  p.set('dateFrom', filterFrom);
    if (filterTo)    p.set('dateTo',   filterTo);
    if (filterEmail) p.set('studentEmail', filterEmail);
    if (filterNeedsReview) p.set('needsReview', 'true');
    return p;
  }

  function loadResults(p = page, email = filterEmail, needsReview = filterNeedsReview) {
    setResultsLoading(true);
    const params = new URLSearchParams({ page: p, limit: LIMIT });
    if (filterExam)  params.set('examId',       filterExam);
    if (filterFrom)  params.set('dateFrom',      filterFrom);
    if (filterTo)    params.set('dateTo',        filterTo);
    if (email)       params.set('studentEmail',  email);
    if (needsReview) params.set('needsReview',   'true');
    api.get(`/results?${params}`)
      .then(({ results: rs, total: t }) => { setResults(rs); setTotal(t); setPage(p); })
      .catch(() => toast('Failed to load results.', 'error'))
      .finally(() => setResultsLoading(false));
  }

  function onReviewSaved(subId, updated) {
    setResults(prev => prev.map(r =>
      r.id === subId
        ? { ...r, correct: updated.correct, total: updated.total, pct: updated.pct, grade: updated.grade, review_completed: true }
        : r
    ));
  }

  function onEmailChange(val) {
    setFilterEmail(val);
    clearTimeout(emailTimer.current);
    emailTimer.current = setTimeout(() => loadResults(1, val), 500);
  }

  function clearFilters() {
    setFilterExam(''); setFilterFrom(''); setFilterTo(''); setFilterEmail(''); setFilterNeedsReview(false);
    loadResults(1, '', false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this submission? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await api.del(`/results/${id}`);
      setResults(prev => prev.filter(r => r.id !== id));
      setTotal(t => t - 1);
      toast('Submission deleted.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to delete.', 'error');
    } finally {
      setDeleting(null);
    }
  }

  async function handleExport(format) {
    if (!isPro) { navigate('/billing'); return; }
    setExporting(true);
    try {
      const p = buildParams({ format });
      await api.download(`/results/export?${p}`);
    } catch (err) {
      toast(err.message || 'Export failed.', 'error');
    } finally {
      setExporting(false);
    }
  }

  // Analytics
  function loadStats(examId = statsExam) {
    setStatsLoading(true);
    const p = examId ? `?examId=${examId}` : '';
    api.get(`/results/stats${p}`)
      .then(data => setStats(data))
      .catch(err => toast(err.message || 'Failed to load analytics.', 'error'))
      .finally(() => setStatsLoading(false));
  }

  useEffect(() => {
    if (tab === 'analytics' && isPro) loadStats();
  }, [tab]); // eslint-disable-line

  // Student report
  async function searchStudent() {
    if (!reportEmail.trim()) return;
    setReportLoading(true);
    setStudentData(null);
    try {
      const data = await api.get(`/results/student/${encodeURIComponent(reportEmail.trim())}`);
      setStudentData(data);
    } catch (err) {
      if (err.status === 404) toast('No results found for this student.', 'warning');
      else toast(err.message || 'Search failed.', 'error');
    } finally {
      setReportLoading(false);
    }
  }

  async function downloadReport() {
    setReportDownloading(true);
    try {
      await api.download(`/results/student/${encodeURIComponent(studentData.student.email)}/report`);
    } catch (err) {
      toast(err.message || 'PDF generation failed.', 'error');
    } finally {
      setReportDownloading(false);
    }
  }

  const pages   = Math.ceil(total / LIMIT);
  const hasFilters = filterExam || filterFrom || filterTo || filterEmail || filterNeedsReview;

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">Results &amp; Analytics</h1>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 mb-6">
        {[
          { key: 'results',   label: 'Results',   icon: DocumentArrowDownIcon },
          { key: 'analytics', label: 'Analytics', icon: ChartBarIcon, pro: true },
          { key: 'reports',   label: 'Reports',   icon: UserCircleIcon, pro: true },
        ].map(({ key, label, icon: Icon, pro }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${tab === key ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Icon className="w-4 h-4" /> {label}
            {pro && <ProBadge />}
          </button>
        ))}
      </div>

      {/* ── Results tab ── */}
      {tab === 'results' && (
        <div>
          {/* Filters */}
          <div className="card p-4 mb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <select className="input w-52" value={filterExam} onChange={e => setFilterExam(e.target.value)}>
                <option value="">All exams</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
              <div className="relative flex-1 min-w-[180px]">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input className="input pl-9" value={filterEmail} onChange={e => onEmailChange(e.target.value)}
                  placeholder="Filter by student email…" />
              </div>
              <input type="date" className="input w-36" value={filterFrom}
                onChange={e => setFilterFrom(e.target.value)} />
              <span className="text-slate-400 text-sm">to</span>
              <input type="date" className="input w-36" value={filterTo}
                onChange={e => setFilterTo(e.target.value)} />
              <button
                onClick={() => setFilterNeedsReview(v => !v)}
                className={`btn-sm flex items-center gap-1.5 ${filterNeedsReview ? 'btn-primary' : 'btn-secondary'}`}>
                <ClipboardDocumentCheckIcon className="w-4 h-4" />
                Needs Review {isPro && <ProBadge />}
              </button>
              {hasFilters && (
                <button onClick={clearFilters} className="btn-ghost btn-sm">
                  <XMarkIcon className="w-4 h-4 mr-1" /> Clear
                </button>
              )}

              {/* Export */}
              <div className="ml-auto flex gap-2">
                <button onClick={() => handleExport('xlsx')} disabled={exporting}
                  className="btn-secondary btn-sm flex items-center gap-1.5">
                  {exporting ? <Spinner className="w-4 h-4" /> : <ArrowDownTrayIcon className="w-4 h-4" />}
                  XLSX <ProBadge />
                </button>
                <button onClick={() => handleExport('csv')} disabled={exporting}
                  className="btn-ghost btn-sm flex items-center gap-1.5">
                  <ArrowDownTrayIcon className="w-4 h-4" /> CSV <ProBadge />
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          {resultsLoading ? (
            <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-primary-500" /></div>
          ) : results.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <ChartBarIcon className="w-14 h-14 mx-auto mb-3 text-slate-200" />
              <p className="text-base font-medium text-slate-500">
                {hasFilters ? 'No results match your filters.' : 'No submissions yet.'}
              </p>
              {!hasFilters && <p className="text-sm mt-1">Results will appear here once students complete exams.</p>}
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-2">{total} submission{total !== 1 ? 's' : ''}</p>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <th className="px-4 py-3 text-left">Student</th>
                        <th className="px-4 py-3 text-left hidden md:table-cell">Exam</th>
                        <th className="px-4 py-3 text-center">Score</th>
                        <th className="px-4 py-3 text-center">Grade</th>
                        <th className="px-4 py-3 text-center hidden sm:table-cell">Status</th>
                        <th className="px-4 py-3 text-left hidden lg:table-cell">Time</th>
                        <th className="px-4 py-3 text-left hidden lg:table-cell">Date</th>
                        <th className="px-4 py-3 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 group">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800 truncate max-w-[140px]">{r.student_name}</p>
                            {r.student_email && (
                              <p className="text-xs text-slate-400 truncate max-w-[140px]">{r.student_email}</p>
                            )}
                            {r.student_class && (
                              <p className="text-xs text-slate-400">{r.student_class}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <p className="text-slate-700 truncate max-w-[180px]">{r.exam_title}</p>
                            {r.exam_grade_level && <p className="text-xs text-slate-400">{r.exam_grade_level}</p>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold text-slate-900">{r.pct}%</span>
                            <p className="text-xs text-slate-400">{r.correct}/{r.total}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <GradeBadge grade={r.grade} />
                          </td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell">
                            {r.requires_review && !r.review_completed && (
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                                Needs Review
                              </span>
                            )}
                            {r.requires_review && r.review_completed && (
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                                Reviewed
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500 hidden lg:table-cell whitespace-nowrap">{r.time_taken || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 hidden lg:table-cell whitespace-nowrap">
                            {new Date(r.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {r.requires_review && !r.review_completed && isPro && (
                                <button onClick={() => setReviewId(r.id)}
                                  className="p-1.5 rounded hover:bg-amber-50 text-slate-300 hover:text-amber-600"
                                  title="Review written answers">
                                  <ClipboardDocumentCheckIcon className="w-4 h-4" />
                                </button>
                              )}
                              <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                                className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500">
                                {deleting === r.id ? <Spinner className="w-4 h-4" /> : <TrashIcon className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-5">
                  <button disabled={page === 1} onClick={() => loadResults(page - 1)}
                    className="btn-secondary btn-sm disabled:opacity-40">← Prev</button>
                  <span className="text-sm text-slate-500">Page {page} of {pages}</span>
                  <button disabled={page === pages} onClick={() => loadResults(page + 1)}
                    className="btn-secondary btn-sm disabled:opacity-40">Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Analytics tab ── */}
      {tab === 'analytics' && (
        <ProGate feature="Analytics">
          <div className="space-y-6">
            {/* Exam filter */}
            <div className="flex items-center gap-3">
              <select className="input w-56" value={statsExam}
                onChange={e => { setStatsExam(e.target.value); loadStats(e.target.value); }}>
                <option value="">All exams</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
              {statsLoading && <Spinner className="w-5 h-5 text-primary-500" />}
            </div>

            {!stats && !statsLoading && (
              <div className="text-center py-16 text-slate-400">
                <ChartBarIcon className="w-12 h-12 mx-auto mb-2 text-slate-200" />
                <p className="text-sm">No data yet. Analytics will appear once students submit exams.</p>
              </div>
            )}

            {stats && (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Total Submissions" value={stats.submissionCount} colour="blue" />
                  <StatCard label="Average Score"  value={stats.averagePct != null ? `${stats.averagePct}%` : '—'} colour="green" />
                  <StatCard label="Highest Score"  value={stats.highestPct != null ? `${stats.highestPct}%` : '—'} colour="slate" />
                  <StatCard label="Lowest Score"   value={stats.lowestPct  != null ? `${stats.lowestPct}%`  : '—'} colour="slate" />
                </div>

                {/* Score distribution */}
                {stats.submissionCount > 0 && (
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Score Distribution</h3>
                    <div className="h-52">
                      <Bar
                        data={{
                          labels: stats.distribution.map(d => d.range),
                          datasets: [{
                            label: 'Students',
                            data: stats.distribution.map(d => d.count),
                            backgroundColor: ['#EF4444','#F97316','#EAB308','#22C55E','#4F46E5'],
                            borderRadius: 5,
                          }],
                        }}
                        options={{
                          responsive: true, maintainAspectRatio: false,
                          plugins: { legend: { display: false }, tooltip: { callbacks: {
                            label: ctx => ` ${ctx.raw} student${ctx.raw !== 1 ? 's' : ''}`,
                          }}},
                          scales: {
                            x: { grid: { display: false } },
                            y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#F1F5F9' } },
                          },
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Grade breakdown */}
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Grade Breakdown</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(GRADE_STYLES).map(([grade, cls]) => {
                      const count = stats.gradeBreakdown?.[grade] ?? 0;
                      const pct   = stats.submissionCount ? Math.round((count / stats.submissionCount) * 100) : 0;
                      return (
                        <div key={grade} className={`rounded-xl p-4 text-center ${cls}`}>
                          <p className="text-2xl font-bold mb-0.5">{count}</p>
                          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{grade}</p>
                          <p className="text-xs opacity-60 mt-0.5">{pct}%</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Weak questions */}
                {stats.weakQuestions?.length > 0 && (
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-1">Hardest Questions</h3>
                    <p className="text-xs text-slate-400 mb-4">Questions with the lowest correct-answer rate across all submissions.</p>
                    <div className="space-y-3">
                      {stats.weakQuestions.map((q, i) => {
                        const rate = Math.round((q.correct_rate ?? 0) * 100);
                        return (
                          <div key={q.question_id}>
                            <div className="flex items-start gap-2 mb-1">
                              <span className="text-xs font-bold text-slate-400 w-5 shrink-0 mt-0.5">{i + 1}.</span>
                              <p className="text-sm text-slate-700 flex-1 line-clamp-2">{q.stem}</p>
                              <span className={`text-xs font-semibold shrink-0 ${rate < 40 ? 'text-red-600' : rate < 70 ? 'text-amber-600' : 'text-green-600'}`}>
                                {rate}%
                              </span>
                            </div>
                            <div className="ml-7 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${rate < 40 ? 'bg-red-400' : rate < 70 ? 'bg-amber-400' : 'bg-green-400'}`}
                                style={{ width: `${rate}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ProGate>
      )}

      {/* Review Modal */}
      {reviewId && (
        <ReviewModal
          submissionId={reviewId}
          onClose={() => setReviewId(null)}
          onSaved={onReviewSaved}
        />
      )}

      {/* ── Reports tab ── */}
      {tab === 'reports' && (
        <ProGate feature="Student Reports">
          <div className="max-w-2xl space-y-5">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Student Progress Report</h3>
              <p className="text-xs text-slate-500 mb-4">
                Search by student email to view their full exam history and download a PDF progress report.
              </p>
              <div className="flex gap-2">
                <input className="input flex-1" type="email"
                  value={reportEmail} onChange={e => setReportEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchStudent()}
                  placeholder="student@example.com" />
                <button onClick={searchStudent} disabled={reportLoading || !reportEmail.trim()}
                  className="btn-primary btn-sm">
                  {reportLoading ? <Spinner className="w-4 h-4" /> : <MagnifyingGlassIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {studentData && (
              <>
                {/* Student card */}
                <div className="card p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <UserCircleIcon className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{studentData.student.name || studentData.student.email}</p>
                        <p className="text-xs text-slate-500">{studentData.student.email}</p>
                        {studentData.student.class && (
                          <p className="text-xs text-slate-400">{studentData.student.class}</p>
                        )}
                      </div>
                    </div>
                    <button onClick={downloadReport} disabled={reportDownloading}
                      className="btn-secondary btn-sm flex-shrink-0">
                      {reportDownloading
                        ? <Spinner className="w-4 h-4 mr-1.5" />
                        : <ArrowDownTrayIcon className="w-4 h-4 mr-1.5" />}
                      Download PDF
                    </button>
                  </div>

                  {/* Summary */}
                  {studentData.submissions.length > 0 && (() => {
                    const pcts = studentData.submissions.map(s => s.pct);
                    const avg  = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
                    const trend = pcts.length > 1 ? pcts[pcts.length - 1] - pcts[0] : null;
                    return (
                      <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100">
                        <div className="text-center flex-1">
                          <p className="text-lg font-bold text-slate-900">{studentData.submissions.length}</p>
                          <p className="text-xs text-slate-400">Exams taken</p>
                        </div>
                        <div className="text-center flex-1">
                          <p className="text-lg font-bold text-slate-900">{avg}%</p>
                          <p className="text-xs text-slate-400">Average score</p>
                        </div>
                        {trend !== null && (
                          <div className="text-center flex-1">
                            <p className={`text-lg font-bold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {trend >= 0 ? '+' : ''}{trend}%
                            </p>
                            <p className="text-xs text-slate-400">Progress trend</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Submission history */}
                <div className="card overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide flex">
                    <span className="flex-1">Exam</span>
                    <span className="w-20 text-center">Score</span>
                    <span className="w-24 text-center">Grade</span>
                    <span className="w-28 hidden sm:block">Date</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {studentData.submissions.map(s => (
                      <div key={s.id} className="px-4 py-3 flex items-center hover:bg-slate-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 truncate">{s.exam_title}</p>
                          {s.subject && <p className="text-xs text-slate-400">{s.subject}</p>}
                        </div>
                        <span className="w-20 text-center font-semibold text-slate-900">{s.pct}%</span>
                        <div className="w-24 text-center">
                          <GradeBadge grade={s.grade} />
                        </div>
                        <span className="w-28 text-xs text-slate-400 hidden sm:block">
                          {new Date(s.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ProGate>
      )}
    </div>
  );
}
