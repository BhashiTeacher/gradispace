import { useState, useEffect, useRef } from 'react';
import {
  PlusIcon, MagnifyingGlassIcon, TrashIcon, PencilIcon,
  CircleStackIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api';
import Spinner from '../../components/UI/Spinner';

const LIMIT = 20;
const LETTERS = ['A', 'B', 'C', 'D'];
const toApiOptions = (arr) => LETTERS.map((letter, i) => ({ letter, text: arr[i] || '' }));

const emptyForm = {
  type: 'mcq', stem: '', opts: ['', '', '', ''],
  answer: 'A', modelAnswer: '',
  subject: '', topic: '', gradeLevel: '',
  difficulty: 'medium', tags: '',
};

function TypeBadge({ type }) {
  return type === 'mcq'
    ? <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">MCQ</span>
    : <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">Short</span>;
}

function DiffBadge({ value }) {
  const s = { easy: 'bg-green-100 text-green-700', medium: 'bg-amber-100 text-amber-700', hard: 'bg-red-100 text-red-700' };
  return <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${s[value] || s.medium}`}>{value || 'medium'}</span>;
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────
function QuestionModal({ mode, initial, onSave, onClose, saving }) {
  const [form, setForm]   = useState(initial || emptyForm);
  const [errors, setErrors] = useState({});
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function validate() {
    const e = {};
    if (!form.stem.trim()) e.stem = 'Question text is required.';
    if (form.type === 'mcq' && (!form.opts[0].trim() || !form.opts[1].trim()))
      e.opts = 'At least options A and B are required.';
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSubmit() {
    if (!validate()) return;
    const payload = {
      stem: form.stem.trim(), type: form.type,
      difficulty: form.difficulty,
      subject:    form.subject.trim()    || null,
      topic:      form.topic.trim()      || null,
      gradeLevel: form.gradeLevel.trim() || null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      inBank: true,
    };
    if (form.type === 'mcq') {
      payload.options = toApiOptions(form.opts);
      payload.answer  = form.answer;
    } else {
      payload.answer = form.modelAnswer.trim() || null;
    }
    onSave(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="font-semibold text-slate-900">{mode === 'add' ? 'Add Question' : 'Edit Question'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* Type selector */}
          <div className="flex gap-2">
            {['mcq', 'short_answer'].map(t => (
              <label key={t}
                className={`flex-1 flex items-center justify-center py-2 rounded-lg border-2 cursor-pointer text-sm font-medium transition-colors
                  ${form.type === t ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                <input type="radio" name="qtype" value={t} checked={form.type === t}
                  onChange={() => setF('type', t)} className="sr-only" />
                {t === 'mcq' ? 'Multiple Choice (MCQ)' : 'Short Answer'}
              </label>
            ))}
          </div>

          {/* Stem */}
          <div>
            <label className="label">Question text <span className="text-red-400">*</span></label>
            <textarea className={`input resize-none ${errors.stem ? 'border-red-400' : ''}`}
              rows={3} value={form.stem} onChange={e => setF('stem', e.target.value)}
              placeholder="Enter the question here..." />
            {errors.stem && <p className="text-xs text-red-500 mt-1">{errors.stem}</p>}
          </div>

          {/* MCQ options + answer */}
          {form.type === 'mcq' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {LETTERS.map((letter, i) => (
                  <div key={letter}>
                    <label className="label text-xs">
                      Option {letter} {i < 2 && <span className="text-red-400">*</span>}
                    </label>
                    <input className={`input ${errors.opts && i < 2 ? 'border-red-400' : ''}`}
                      value={form.opts[i]}
                      onChange={e => { const n = [...form.opts]; n[i] = e.target.value; setF('opts', n); }}
                      placeholder={`Option ${letter}`} />
                  </div>
                ))}
              </div>
              {errors.opts && <p className="text-xs text-red-500 -mt-2">{errors.opts}</p>}
              <div>
                <label className="label">Correct Answer</label>
                <div className="flex gap-2 mt-1">
                  {LETTERS.map(letter => (
                    <label key={letter}
                      className={`flex items-center justify-center w-10 h-10 rounded-lg border-2 cursor-pointer font-semibold text-sm transition-colors
                        ${form.answer === letter
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      <input type="radio" name="answer" value={letter} checked={form.answer === letter}
                        onChange={() => setF('answer', letter)} className="sr-only" />
                      {letter}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Short answer model answer */}
          {form.type === 'short_answer' && (
            <div>
              <label className="label">Model Answer</label>
              <textarea className="input resize-none" rows={2}
                value={form.modelAnswer} onChange={e => setF('modelAnswer', e.target.value)}
                placeholder="Expected answer or marking notes..." />
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Subject</label>
              <input className="input" value={form.subject} onChange={e => setF('subject', e.target.value)} placeholder="e.g. Science" />
            </div>
            <div>
              <label className="label">Topic</label>
              <input className="input" value={form.topic} onChange={e => setF('topic', e.target.value)} placeholder="e.g. Human Body" />
            </div>
            <div>
              <label className="label">Grade Level</label>
              <input className="input" value={form.gradeLevel} onChange={e => setF('gradeLevel', e.target.value)} placeholder="e.g. Grade 10" />
            </div>
            <div>
              <label className="label">Difficulty</label>
              <select className="input" value={form.difficulty} onChange={e => setF('difficulty', e.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Tags <span className="text-slate-400 font-normal">(comma-separated)</span></label>
            <input className="input" value={form.tags} onChange={e => setF('tags', e.target.value)}
              placeholder="e.g. biology, cells, grade10" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary btn-sm">
            {saving && <Spinner className="w-4 h-4 mr-1.5" />}
            {mode === 'add' ? 'Add to Bank' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function QuestionBank() {
  const { teacher, refreshMe } = useAuth();
  const toast = useToast();

  const [questions, setQuestions] = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);

  const [search, setSearch]               = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterType, setFilterType]       = useState('');
  const [filterDiff, setFilterDiff]       = useState('');

  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving]     = useState(false);

  const [modal, setModal] = useState(null); // null | { mode, q, initial }

  const searchTimer = useRef(null);

  // Plan limits
  const bankCount = teacher?.questionBankCount ?? 0;
  const isFree    = teacher?.plan === 'free';
  const bankLimit = 50;
  const limitNear = isFree && bankCount >= 40;
  const limitHit  = isFree && bankCount >= 50;

  useEffect(() => { load(1); }, [filterSubject, filterType, filterDiff]); // eslint-disable-line

  function load(p = page, searchVal = search) {
    setLoading(true);
    setSelected(new Set());
    const params = new URLSearchParams({ page: p, limit: LIMIT });
    if (searchVal)     params.set('search', searchVal);
    if (filterSubject) params.set('subject', filterSubject);
    if (filterType)    params.set('type', filterType);
    if (filterDiff)    params.set('difficulty', filterDiff);
    api.get(`/questions?${params}`)
      .then(({ questions: qs, total: t }) => {
        setQuestions(qs); setTotal(t); setPage(p);
      })
      .catch(() => toast('Failed to load questions.', 'error'))
      .finally(() => setLoading(false));
  }

  function onSearchChange(val) {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(1, val), 400);
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(selected.size === questions.length
      ? new Set()
      : new Set(questions.map(q => q.id)));
  }

  async function handleSave(payload) {
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await api.post('/questions', payload);
        toast('Question added to bank!', 'success');
      } else {
        await api.put(`/questions/${modal.q.id}`, payload);
        toast('Question updated.', 'success');
      }
      setModal(null);
      await refreshMe();
      load(modal.mode === 'add' ? 1 : page);
    } catch (err) {
      toast(err.message || 'Failed to save question.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this question? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.del(`/questions/${id}`);
      toast('Question deleted.', 'success');
      await refreshMe();
      load(questions.length === 1 && page > 1 ? page - 1 : page);
    } catch (err) {
      toast(err.message || 'Failed to delete.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function handleBulkDelete() {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} question${selected.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setDeleting(true);
    let failed = 0;
    for (const id of selected) {
      try { await api.del(`/questions/${id}`); } catch { failed++; }
    }
    if (failed) toast(`${failed} question${failed !== 1 ? 's' : ''} could not be deleted.`, 'warning');
    else toast(`${selected.size} questions deleted.`, 'success');
    setDeleting(false);
    await refreshMe();
    load(1);
  }

  function openEdit(q) {
    const opts = Array.isArray(q.options)
      ? LETTERS.map(l => q.options.find(o => o.letter === l)?.text || '')
      : ['', '', '', ''];
    setModal({
      mode: 'edit', q,
      initial: {
        type:        q.type        || 'mcq',
        stem:        q.stem        || '',
        opts,
        answer:      q.type === 'mcq' ? (q.answer || 'A') : 'A',
        modelAnswer: q.type === 'short_answer' ? (q.answer || '') : '',
        subject:    q.subject     || '',
        topic:      q.topic       || '',
        gradeLevel: q.grade_level || '',
        difficulty: q.difficulty  || 'medium',
        tags:       (q.tags || []).join(', '),
      },
    });
  }

  function clearFilters() {
    setSearch(''); setFilterSubject(''); setFilterType(''); setFilterDiff('');
    load(1, '');
  }

  const pages = Math.ceil(total / LIMIT);
  const hasFilters = search || filterSubject || filterType || filterDiff;

  return (
    <div>
      {/* Header */}
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Question Bank</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total} question{total !== 1 ? 's' : ''} in your bank
          </p>
        </div>
        <button
          onClick={() => !limitHit && setModal({ mode: 'add', q: null, initial: emptyForm })}
          disabled={limitHit}
          title={limitHit ? 'Question bank limit reached' : undefined}
          className="btn-primary">
          <PlusIcon className="w-4 h-4 mr-1.5" /> Add Question
        </button>
      </div>

      {/* Free plan usage bar */}
      {isFree && (
        <div className={`card p-4 mb-5 flex items-center gap-4 ${limitNear ? 'ring-2 ring-amber-300' : ''}`}>
          <CircleStackIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-slate-700">Bank usage (Free plan)</span>
              <span className={`text-sm font-semibold ${limitNear ? 'text-amber-600' : 'text-slate-600'}`}>
                {bankCount} / {bankLimit}
              </span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${limitHit ? 'bg-red-500' : limitNear ? 'bg-amber-500' : 'bg-primary-500'}`}
                style={{ width: `${Math.min((bankCount / bankLimit) * 100, 100)}%` }} />
            </div>
            {limitHit && <p className="text-xs text-red-600 mt-1.5">Bank limit reached. Upgrade for unlimited questions.</p>}
          </div>
          {(limitNear || limitHit) && (
            <a href="/billing" className="btn-primary btn-sm flex-shrink-0">Upgrade →</a>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" value={search} onChange={e => onSearchChange(e.target.value)}
              placeholder="Search questions…" />
          </div>
          <input className="input w-36" value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)} placeholder="Subject" />
          <select className="input w-36" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All types</option>
            <option value="mcq">MCQ</option>
            <option value="short_answer">Short Answer</option>
          </select>
          <select className="input w-36" value={filterDiff} onChange={e => setFilterDiff(e.target.value)}>
            <option value="">All levels</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="btn-ghost btn-sm">
              <XMarkIcon className="w-4 h-4 mr-1" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-lg px-4 py-2.5 mb-4">
          <span className="text-sm font-medium text-primary-700">
            {selected.size} selected
          </span>
          <button onClick={handleBulkDelete} disabled={deleting} className="btn-danger btn-sm ml-auto">
            {deleting ? <Spinner className="w-4 h-4 mr-1.5" /> : <TrashIcon className="w-4 h-4 mr-1.5" />}
            Delete selected
          </button>
          <button onClick={() => setSelected(new Set())} className="btn-ghost btn-sm">Cancel</button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="w-8 h-8 text-primary-500" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <CircleStackIcon className="w-14 h-14 mx-auto mb-3 text-slate-200" />
          <p className="text-base font-medium text-slate-500">
            {hasFilters ? 'No questions match your filters.' : 'Your question bank is empty.'}
          </p>
          {!hasFilters && (
            <p className="text-sm mt-1">
              Add questions manually above, or save questions from the Exam Builder.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Select-all row */}
          <div className="flex items-center gap-3 px-1 mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded text-primary-600"
                checked={selected.size === questions.length && questions.length > 0}
                onChange={toggleAll} />
              <span className="text-xs text-slate-500">Select all on page</span>
            </label>
            <span className="text-xs text-slate-400 ml-auto">
              {total} question{total !== 1 ? 's' : ''} · page {page} of {pages || 1}
            </span>
          </div>

          <div className="space-y-2">
            {questions.map((q, idx) => (
              <div key={q.id}
                className={`card p-4 flex items-start gap-3 group hover:border-primary-200 transition-colors
                  ${selected.has(q.id) ? 'border-primary-300 bg-primary-50/40' : ''}`}>
                <input type="checkbox" className="mt-1 rounded text-primary-600 flex-shrink-0"
                  checked={selected.has(q.id)} onChange={() => toggleSelect(q.id)} />
                <span className="text-xs text-slate-400 font-bold w-6 flex-shrink-0 mt-0.5 text-right">
                  {(page - 1) * LIMIT + idx + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 line-clamp-2 leading-snug mb-2">{q.stem}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <TypeBadge type={q.type} />
                    <DiffBadge value={q.difficulty} />
                    {q.subject     && <span className="text-xs text-slate-400">{q.subject}</span>}
                    {q.topic       && <span className="text-xs text-slate-400">· {q.topic}</span>}
                    {q.grade_level && <span className="text-xs text-slate-400">· {q.grade_level}</span>}
                    {q.has_passage && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                        Passage
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(q)}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700" title="Edit">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(q.id)} disabled={deleting}
                    className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500" title="Delete">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button disabled={page === 1} onClick={() => load(page - 1)}
                className="btn-secondary btn-sm disabled:opacity-40">← Prev</button>
              <span className="text-sm text-slate-500">Page {page} of {pages}</span>
              <button disabled={page === pages} onClick={() => load(page + 1)}
                className="btn-secondary btn-sm disabled:opacity-40">Next →</button>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {modal && (
        <QuestionModal mode={modal.mode} initial={modal.initial}
          onSave={handleSave} onClose={() => setModal(null)} saving={saving} />
      )}
    </div>
  );
}
