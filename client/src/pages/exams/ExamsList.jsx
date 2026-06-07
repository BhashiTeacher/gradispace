import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  PlusIcon, MagnifyingGlassIcon, PencilSquareIcon, ChartBarIcon,
  PrinterIcon, TrashIcon, ShareIcon, FunnelIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api';
import Spinner from '../../components/UI/Spinner';
import Badge from '../../components/UI/Badge';

// ── Share / copy-link modal (same pattern as Dashboard) ──────────────────────
function ShareModal({ exam, onClose }) {
  const link = `${window.location.origin}/e/${exam?.access_token}`;
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  if (!exam) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold text-slate-900 mb-1">Share Exam</h2>
        <p className="text-sm text-slate-500 mb-4">{exam.title}</p>
        <div className="flex gap-2">
          <input readOnly value={link} className="input flex-1 text-xs" />
          <button onClick={copy} className="btn-primary btn-sm flex-shrink-0">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <button onClick={onClose} className="mt-4 text-sm text-slate-400 hover:text-slate-600 w-full text-center">Close</button>
      </div>
    </div>
  );
}

// ── Exam row ─────────────────────────────────────────────────────────────────
function ExamRow({ exam, onEdit, onResults, onPrint, onShare, onPublish, onUnpublish, onDelete, isPro }) {
  const [acting, setActing] = useState(null);

  async function wrap(label, fn) {
    setActing(label);
    try { await fn(); } finally { setActing(null); }
  }

  return (
    <tr className="group hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-slate-800 truncate max-w-[220px]">{exam.title}</p>
        {exam.subject && <p className="text-xs text-slate-400 mt-0.5">{exam.subject}{exam.grade_level ? ` · ${exam.grade_level}` : ''}</p>}
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <Badge variant={exam.published ? 'green' : 'gray'}>{exam.published ? 'Live' : 'Draft'}</Badge>
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-sm text-slate-600 text-center">
        {exam.question_count ?? '—'}
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-sm text-slate-600 text-center">
        {exam.submission_count ?? '—'}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-400">
        {exam.created_at ? new Date(exam.created_at).toLocaleDateString() : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(exam)} className="btn-ghost btn-sm" title="Edit">
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button onClick={() => onResults(exam)} className="btn-ghost btn-sm" title="Results">
            <ChartBarIcon className="w-4 h-4" />
          </button>
          <button onClick={() => wrap('print', () => onPrint(exam))} disabled={acting === 'print'}
            className="btn-ghost btn-sm hidden sm:inline-flex" title="Print PDF">
            {acting === 'print' ? <Spinner className="w-3.5 h-3.5" /> : <PrinterIcon className="w-4 h-4" />}
          </button>
          {exam.published ? (
            <>
              <button onClick={() => onShare(exam)} className="btn-ghost btn-sm hidden sm:inline-flex" title="Share">
                <ShareIcon className="w-4 h-4" />
              </button>
              <button onClick={() => wrap('unpublish', () => onUnpublish(exam))} disabled={acting === 'unpublish'}
                className="btn-ghost btn-sm text-xs text-slate-500 hidden sm:inline-flex" title="Unpublish">
                {acting === 'unpublish' ? <Spinner className="w-3.5 h-3.5" /> : 'Unpublish'}
              </button>
            </>
          ) : (
            <button onClick={() => wrap('publish', () => onPublish(exam))} disabled={acting === 'publish'}
              className="btn-ghost btn-sm text-xs text-primary-600 hidden sm:inline-flex" title="Publish">
              {acting === 'publish' ? <Spinner className="w-3.5 h-3.5" /> : 'Publish'}
            </button>
          )}
          <button onClick={() => onDelete(exam)} className="btn-ghost btn-sm text-red-400 hover:text-red-600" title="Delete">
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExamsList() {
  const navigate  = useNavigate();
  const toast     = useToast();
  const { isPro } = useAuth();

  const [exams, setExams]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('all');   // 'all' | 'live' | 'draft'
  const [filterSubject, setFilterSubject] = useState('');
  const [sortBy, setSortBy]     = useState('newest');        // 'newest' | 'oldest' | 'updated'
  const [shareExam, setShareExam] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/exams?limit=500')
      .then(({ exams: data }) => setExams(data || []))
      .catch(() => toast('Could not load exams.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  // Unique subjects for the subject filter
  const subjects = useMemo(() => [...new Set(exams.map(e => e.subject).filter(Boolean))].sort(), [exams]);

  // Client-side filter + sort
  const visible = useMemo(() => {
    let list = exams;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.title?.toLowerCase().includes(q) || e.subject?.toLowerCase().includes(q));
    }
    if (filterStatus === 'live')  list = list.filter(e => e.published);
    if (filterStatus === 'draft') list = list.filter(e => !e.published);
    if (filterSubject)            list = list.filter(e => e.subject === filterSubject);
    const sorted = [...list];
    if (sortBy === 'oldest')  sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (sortBy === 'updated') sorted.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    if (sortBy === 'newest')  sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return sorted;
  }, [exams, search, filterStatus, filterSubject, sortBy]);

  function handleEdit(exam)    { navigate(`/exams/${exam.id}`); }
  function handleResults(exam) { navigate(`/results?examId=${exam.id}`); }

  async function handlePrint(exam) {
    if (!isPro) { navigate('/billing'); return; }
    try { await api.download(`/exams/${exam.id}/print-pdf`, `${exam.title || 'exam'}_paper.pdf`); }
    catch (err) { toast(err.message || 'PDF generation failed.', 'error'); }
  }

  function handleShare(exam) { setShareExam(exam); }

  async function handlePublish(exam) {
    try {
      const { exam: updated } = await api.post(`/exams/${exam.id}/publish`);
      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, published: true, access_token: updated.access_token } : e));
      toast('Exam published!', 'success');
    } catch (err) { toast(err.message || 'Publish failed.', 'error'); }
  }

  async function handleUnpublish(exam) {
    try {
      await api.post(`/exams/${exam.id}/unpublish`);
      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, published: false } : e));
      toast('Exam unpublished.', 'success');
    } catch (err) { toast(err.message || 'Unpublish failed.', 'error'); }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/exams/${deleteConfirm.id}`);
      setExams(prev => prev.filter(e => e.id !== deleteConfirm.id));
      toast('Exam deleted.', 'success');
      setDeleteConfirm(null);
    } catch (err) { toast(err.message || 'Delete failed.', 'error'); }
    finally { setDeleting(false); }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">All Exams</h1>
          <p className="text-sm text-slate-500 mt-0.5">{exams.length} exam{exams.length !== 1 ? 's' : ''} total</p>
        </div>
        <Link to="/exams/new" className="btn-primary flex items-center gap-1.5">
          <PlusIcon className="w-4 h-4" /> New Exam
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            className="input pl-8 w-full"
            placeholder="Search exams…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="input w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All status</option>
          <option value="live">Live</option>
          <option value="draft">Draft</option>
        </select>

        <select className="input w-auto" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
          <option value="">All subjects</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select className="input w-auto" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="updated">Recently updated</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-primary-500" /></div>
      ) : visible.length === 0 ? (
        <div className="card p-12 text-center">
          <FunnelIcon className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="font-medium text-slate-600">
            {exams.length === 0 ? 'No exams yet' : 'No exams match your filters'}
          </p>
          {exams.length === 0 && (
            <Link to="/exams/new" className="btn-primary btn-sm mt-4 inline-flex">
              <PlusIcon className="w-4 h-4 mr-1" /> Create your first exam
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Exam</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell text-center">Questions</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell text-center">Submissions</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Created</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map(exam => (
                <ExamRow
                  key={exam.id}
                  exam={exam}
                  isPro={isPro}
                  onEdit={handleEdit}
                  onResults={handleResults}
                  onPrint={handlePrint}
                  onShare={handleShare}
                  onPublish={handlePublish}
                  onUnpublish={handleUnpublish}
                  onDelete={e => setDeleteConfirm(e)}
                />
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400">
            Showing {visible.length} of {exams.length} exam{exams.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Share modal */}
      <ShareModal exam={shareExam} onClose={() => setShareExam(null)} />

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold text-slate-900 mb-1">Delete Exam?</h2>
            <p className="text-sm text-slate-500 mb-5">
              "{deleteConfirm.title}" and all its submissions will be permanently deleted.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} className="btn-danger flex-1">
                {deleting ? <Spinner className="w-4 h-4 mx-auto" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
