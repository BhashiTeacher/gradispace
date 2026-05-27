import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon,
  SparklesIcon, DocumentArrowUpIcon, CircleStackIcon,
  PencilSquareIcon, CheckIcon, XMarkIcon, ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api';
import Spinner from '../../components/UI/Spinner';
import { ProBadge } from '../../components/UI/ProGate';

let _lid = 0;
const makeId = () => `q_${++_lid}_${Date.now()}`;

const toApiOptions = (arr) =>
  ['A', 'B', 'C', 'D'].map((letter, i) => ({ letter, text: arr[i] || '' }));

// ─── Small presentational components ─────────────────────────────────────────

function SourceBadge({ source }) {
  const styles = {
    manual: 'bg-slate-100 text-slate-600',
    ai:     'bg-purple-100 text-purple-700',
    pdf:    'bg-blue-100 text-blue-700',
    bank:   'bg-green-100 text-green-700',
  };
  return (
    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${styles[source] || styles.manual}`}>
      {source || 'manual'}
    </span>
  );
}

function DiffBadge({ value }) {
  const styles = {
    easy:   'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    hard:   'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${styles[value] || styles.medium}`}>
      {value || 'medium'}
    </span>
  );
}

function QuestionItem({ q, index, total, onMoveUp, onMoveDown, onEdit, onRemove, justSaved }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-white border border-slate-200 rounded-lg hover:border-primary-200 transition-colors group">
      <div className="flex flex-col gap-0.5 mt-0.5 shrink-0">
        <button onClick={onMoveUp} disabled={index === 0}
          className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-20 text-slate-400">
          <ArrowUpIcon className="w-3.5 h-3.5" />
        </button>
        <button onClick={onMoveDown} disabled={index === total - 1}
          className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-20 text-slate-400">
          <ArrowDownIcon className="w-3.5 h-3.5" />
        </button>
      </div>
      <span className="text-xs font-bold text-slate-400 shrink-0 w-5 pt-0.5 text-right">{index + 1}.</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 line-clamp-2 leading-snug mb-1">{q.stem}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <SourceBadge source={q._source} />
          <DiffBadge value={q.difficulty} />
          {q.type === 'short_answer'
            ? <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-semibold">Short Answer</span>
            : q.answer && <span className="text-[10px] text-slate-400">Ans: <b>{q.answer}</b></span>}
          {justSaved && (
            <span className="text-[10px] font-semibold text-green-600 flex items-center gap-0.5 animate-pulse">
              <CheckIcon className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit}
          className="p-1 rounded hover:bg-primary-50 text-slate-300 hover:text-primary-500">
          <PencilSquareIcon className="w-4 h-4" />
        </button>
        <button onClick={onRemove}
          className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500">
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function QuestionEditForm({ q, index, total, onMoveUp, onMoveDown, onSave, onCancel }) {
  const { isPro } = useAuth();
  const navigate  = useNavigate();
  const [type, setType]     = useState(q.type || 'mcq');
  const [stem, setStem]     = useState(q.stem || '');
  const [opts, setOpts]     = useState(() =>
    ['A', 'B', 'C', 'D'].map(l => q.options?.find(o => o.letter === l)?.text || '')
  );
  const [answer, setAnswer] = useState(
    q.type === 'short_answer' ? (q.answer || '') : (q.answer || 'A')
  );
  const [diff, setDiff]     = useState(q.difficulty || 'medium');
  const [errors, setErrors] = useState({});

  function handleSave() {
    const e = {};
    if (!stem.trim()) e.stem = 'Question text is required.';
    if (type === 'mcq' && (!opts[0].trim() || !opts[1].trim())) e.opts = 'At least options A and B are required.';
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave({
      ...q,
      type,
      stem:       stem.trim(),
      options:    type === 'mcq' ? ['A', 'B', 'C', 'D'].map((letter, i) => ({ letter, text: opts[i] || '' })) : [],
      answer:     type === 'mcq' ? answer : (answer.trim() || null),
      difficulty: diff,
    });
  }

  return (
    <div className="p-4 bg-white border-2 border-primary-300 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-primary-600">Editing Q{index + 1}</span>
        <div className="flex gap-0.5">
          <button onClick={onMoveUp} disabled={index === 0}
            className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-20 text-slate-400">
            <ArrowUpIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1}
            className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-20 text-slate-400">
            <ArrowDownIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Type selector */}
      <div className="flex gap-2">
        <label className={`flex-1 flex items-center justify-center py-2 rounded-lg border-2 cursor-pointer text-sm font-medium transition-colors
          ${type === 'mcq' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
          <input type="radio" className="sr-only" checked={type === 'mcq'}
            onChange={() => { setType('mcq'); setAnswer('A'); }} />
          Multiple Choice
        </label>
        <label
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 text-sm font-medium transition-colors cursor-pointer
            ${!isPro ? 'opacity-80' : ''}
            ${type === 'short_answer' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
          onClick={() => { if (!isPro) { navigate('/billing'); return; } setType('short_answer'); setAnswer(''); }}>
          Short Answer <ProBadge />
        </label>
      </div>

      <div>
        <label className="label">Question text</label>
        <textarea className={`input resize-none ${errors.stem ? 'border-red-400' : ''}`}
          rows={3} value={stem} onChange={e => setStem(e.target.value)} />
        {errors.stem && <p className="text-xs text-red-500 mt-1">{errors.stem}</p>}
      </div>

      {type === 'mcq' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {['A', 'B', 'C', 'D'].map((letter, i) => (
              <div key={letter}>
                <label className="label text-xs">Option {letter}{i < 2 && <span className="text-red-400"> *</span>}</label>
                <input className={`input ${errors.opts && i < 2 ? 'border-red-400' : ''}`}
                  value={opts[i]}
                  onChange={e => { const n = [...opts]; n[i] = e.target.value; setOpts(n); }} />
              </div>
            ))}
          </div>
          {errors.opts && <p className="text-xs text-red-500">{errors.opts}</p>}
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="label">Correct Answer</label>
              <div className="flex gap-1.5">
                {['A', 'B', 'C', 'D'].map(letter => (
                  <label key={letter}
                    className={`flex items-center justify-center w-9 h-9 rounded-lg border-2 cursor-pointer font-semibold text-sm transition-colors
                      ${answer === letter ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    <input type="radio" name={`editAnswer_${q._lid}`} value={letter}
                      checked={answer === letter} onChange={() => setAnswer(letter)} className="sr-only" />
                    {letter}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="label">Difficulty</label>
              <select className="input" value={diff} onChange={e => setDiff(e.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
        </>
      )}

      {type === 'short_answer' && (
        <div className="space-y-3">
          <div>
            <label className="label">Model Answer <span className="text-xs text-slate-400">(optional — not shown to students)</span></label>
            <textarea className="input resize-none" rows={2}
              value={answer} onChange={e => setAnswer(e.target.value)}
              placeholder="Model answer for teacher reference only..." />
          </div>
          <div>
            <label className="label">Difficulty</label>
            <select className="input" value={diff} onChange={e => setDiff(e.target.value)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} className="btn-primary btn-sm">Save Changes</button>
        <button onClick={onCancel} className="btn-ghost btn-sm">Cancel</button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExamBuilder() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { isPro } = useAuth();
  const toast = useToast();

  // Exam details
  const [title, setTitle]             = useState('');
  const [subject, setSubject]         = useState('');
  const [topic, setTopic]             = useState('');
  const [gradeLevel, setGradeLevel]   = useState('');
  const [duration, setDuration]       = useState(45);
  const [description, setDescription] = useState('');
  const [examType, setExamType]       = useState('open');

  // Exam meta
  const [examId, setExamId]           = useState(routeId || null);
  const [isPublished, setIsPublished] = useState(false);
  const [loadingExam, setLoadingExam] = useState(!!routeId);
  const skipNextLoad                  = useRef(false);

  // Questions in this exam (ordered)
  const [questions, setQuestions]     = useState([]);

  // Tab & save
  const [activeTab, setActiveTab]     = useState('manual');
  const [saving, setSaving]           = useState(false);
  const [editingIdx, setEditingIdx]   = useState(null);
  const [justSavedId, setJustSavedId] = useState(null);

  // Publish modal
  const [publishModal, setPublishModal] = useState({ open: false, link: '', token: '' });
  const [copied, setCopied]             = useState(false);

  // ── Manual tab state ──────────────────────────────────────────────────────
  const [mStem, setMStem]     = useState('');
  const [mOpts, setMOpts]     = useState(['', '', '', '']);
  const [mAnswer, setMAnswer] = useState('A');
  const [mDiff, setMDiff]     = useState('medium');
  const [mType, setMType]     = useState('mcq');
  const [mErrors, setMErrors] = useState({});

  // ── AI tab state ──────────────────────────────────────────────────────────
  const [aiPrompt, setAiPrompt]     = useState('');
  const [aiSubject, setAiSubject]   = useState('');
  const [aiCount, setAiCount]       = useState(10);
  const [aiDiff, setAiDiff]         = useState('medium');
  const [aiPassage, setAiPassage]   = useState(false);
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiResults, setAiResults]   = useState([]);
  const [aiSel, setAiSel]           = useState(new Set());

  // ── PDF tab state ─────────────────────────────────────────────────────────
  const pdfInputRef                     = useRef(null);
  const [pdfFileName, setPdfFileName]   = useState('');
  const [pdfLoading, setPdfLoading]     = useState(false);
  const [pdfResults, setPdfResults]     = useState([]);
  const [pdfSel, setPdfSel]             = useState(new Set());

  // ── Bank tab state ────────────────────────────────────────────────────────
  const [bankSearch, setBankSearch]       = useState('');
  const [bankSubj, setBankSubj]           = useState('');
  const [bankQuestions, setBankQuestions] = useState([]);
  const [bankLoading, setBankLoading]     = useState(false);
  const [bankPage, setBankPage]           = useState(1);
  const [bankTotal, setBankTotal]         = useState(0);
  const bankTimer                         = useRef(null);

  // ── Load exam when editing ────────────────────────────────────────────────
  useEffect(() => {
    if (!routeId) return;
    if (skipNextLoad.current) { skipNextLoad.current = false; return; }
    setLoadingExam(true);
    api.get(`/exams/${routeId}`)
      .then(({ exam, questions: qs }) => {
        setTitle(exam.title || '');
        setSubject(exam.subject || '');
        setTopic(exam.topic || '');
        setGradeLevel(exam.grade_level || '');
        setDuration(exam.duration || 45);
        setDescription(exam.description || '');
        setExamType(exam.exam_type || 'open');
        setIsPublished(!!exam.published);
        setExamId(exam.id);
        if (exam.published && exam.access_token) {
          const link = `${window.location.origin}/e/${exam.access_token}`;
          setPublishModal({ open: false, link, token: exam.access_token });
        }
        setQuestions((qs || []).map(q => ({
          id:         q.id,
          stem:       q.stem,
          options:    q.options || [],
          answer:     q.answer  || '',
          type:       q.type    || 'mcq',
          difficulty: q.difficulty || 'medium',
          subject:    q.subject,
          topic:      q.topic,
          _lid:       makeId(),
          _source:    q.in_bank ? 'bank' : 'manual',
        })));
      })
      .catch(() => toast('Could not load exam.', 'error'))
      .finally(() => setLoadingExam(false));
  }, [routeId]); // eslint-disable-line

  // ── Bank tab: fetch on tab open or subject change ─────────────────────────
  useEffect(() => {
    if (activeTab !== 'bank') return;
    fetchBank(1, bankSearch);
  }, [activeTab, bankSubj]); // eslint-disable-line

  function fetchBank(page = 1, search = bankSearch) {
    setBankLoading(true);
    const p = new URLSearchParams({ page, limit: 15 });
    if (search)   p.set('search', search);
    if (bankSubj) p.set('subject', bankSubj);
    api.get(`/questions?${p}`)
      .then(({ questions: qs, total }) => {
        setBankQuestions(qs);
        setBankTotal(total);
        setBankPage(page);
      })
      .catch(() => {})
      .finally(() => setBankLoading(false));
  }

  function onBankSearchChange(val) {
    setBankSearch(val);
    clearTimeout(bankTimer.current);
    bankTimer.current = setTimeout(() => fetchBank(1, val), 400);
  }

  // ── Question helpers ──────────────────────────────────────────────────────
  function addToExam(q) {
    setQuestions(prev => [...prev, { ...q, _lid: makeId() }]);
  }

  function addManyToExam(qs) {
    setQuestions(prev => [...prev, ...qs.map(q => ({ ...q, _lid: makeId() }))]);
  }

  function moveUp(i) {
    setQuestions(prev => {
      if (i === 0) return prev;
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  }

  function moveDown(i) {
    setQuestions(prev => {
      if (i === prev.length - 1) return prev;
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  }

  // ── Manual: add ──────────────────────────────────────────────────────────
  function handleAddManual() {
    const errs = {};
    if (!mStem.trim()) errs.stem = 'Question text is required.';
    if (mType === 'mcq' && (!mOpts[0].trim() || !mOpts[1].trim())) errs.opts = 'At least options A and B are required.';
    if (Object.keys(errs).length) { setMErrors(errs); return; }
    setMErrors({});
    addToExam({
      id: null, stem: mStem.trim(),
      options: mType === 'mcq' ? toApiOptions(mOpts) : [],
      answer: mType === 'mcq' ? mAnswer : (mAnswer.trim() || null),
      type: mType, difficulty: mDiff,
      subject, topic, _source: 'manual',
    });
    setMStem(''); setMOpts(['', '', '', '']);
    setMAnswer(mType === 'mcq' ? 'A' : '');
    setMDiff('medium');
  }

  // ── AI: generate ─────────────────────────────────────────────────────────
  async function handleAiGenerate() {
    if (!aiPrompt.trim()) { toast('Describe what the questions should be about.', 'error'); return; }
    setAiLoading(true);
    setAiResults([]);
    try {
      const { questions: qs } = await api.post('/ai/generate', {
        content:        aiPrompt,
        subject:        aiSubject || subject,
        topic,
        gradeLevel,
        difficulty:     aiDiff,
        count:          Math.min(Math.max(parseInt(aiCount) || 10, 1), 50),
        types:          ['mcq'],
        includePassage: aiPassage,
      });
      const normalized = qs.map(q => ({
        id: null, stem: q.stem,
        options: q.options || toApiOptions(['', '', '', '']),
        answer: q.answer || 'A',
        type: q.type || 'mcq',
        difficulty: q.difficulty || aiDiff,
        passage: q.passage,
        subject: q.subject || aiSubject || subject,
        topic: q.topic || topic,
        _source: 'ai',
      }));
      setAiResults(normalized);
      setAiSel(new Set(normalized.map((_, i) => i)));
      toast(`${normalized.length} questions generated.`, 'success');
    } catch (err) {
      toast(err.message || 'AI generation failed.', 'error');
    } finally {
      setAiLoading(false);
    }
  }

  function addAiSelected() {
    const sel = aiResults.filter((_, i) => aiSel.has(i));
    if (!sel.length) return;
    addManyToExam(sel);
    setAiResults([]); setAiSel(new Set());
    toast(`${sel.length} questions added to exam.`, 'success');
  }

  // ── PDF: extract ─────────────────────────────────────────────────────────
  async function handlePdfExtract() {
    const file = pdfInputRef.current?.files?.[0];
    if (!file) { toast('Select a PDF file first.', 'error'); return; }
    setPdfLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { questions: qs } = await api.upload('/ai/import-pdf', fd);
      const normalized = qs.map(q => ({
        id: null, stem: q.stem,
        options: q.options || [],
        answer: q.answer || '',
        type: q.type || 'mcq',
        difficulty: 'medium',
        passage: q.passage,
        _source: 'pdf',
      }));
      setPdfResults(normalized);
      setPdfSel(new Set(normalized.map((_, i) => i)));
      toast(`${normalized.length} questions extracted.`, 'success');
    } catch (err) {
      toast(err.message || 'PDF extraction failed.', 'error');
    } finally {
      setPdfLoading(false);
    }
  }

  function addPdfSelected() {
    const sel = pdfResults.filter((_, i) => pdfSel.has(i));
    if (!sel.length) return;
    addManyToExam(sel);
    setPdfResults([]); setPdfSel(new Set());
    toast(`${sel.length} questions added.`, 'success');
  }

  // ── Bank: add ────────────────────────────────────────────────────────────
  const examQIds = new Set(questions.filter(q => q.id).map(q => q.id));

  function addFromBank(q) {
    if (examQIds.has(q.id)) { toast('Already in this exam.', 'warning'); return; }
    addToExam({
      id: q.id, stem: q.stem,
      options: q.options || [], answer: q.answer || '',
      type: q.type || 'mcq', difficulty: q.difficulty || 'medium',
      subject: q.subject, topic: q.topic,
      _source: 'bank',
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  async function saveExam({ addToBank = false, publish = false } = {}) {
    if (!title.trim()) { toast('Exam title is required.', 'error'); return; }
    setSaving(true);
    try {
      // Create or update exam record
      let currentId = examId;
      if (!currentId) {
        const { exam } = await api.post('/exams', {
          title, subject, topic, gradeLevel,
          duration: parseInt(duration) || 45,
          description, examType,
        });
        currentId = exam.id;
        setExamId(exam.id);
        skipNextLoad.current = true;
        navigate(`/exams/${exam.id}`, { replace: true });
      } else {
        await api.put(`/exams/${currentId}`, {
          title, subject, topic, gradeLevel,
          duration: parseInt(duration) || 45,
          description, examType,
        });
      }

      // Persist unsaved questions; promote existing draft questions to bank if requested
      const saved = [...questions];
      for (let i = 0; i < saved.length; i++) {
        if (!saved[i].id) {
          const { question } = await api.post('/questions', {
            stem:       saved[i].stem,
            options:    saved[i].options,
            answer:     saved[i].answer,
            type:       saved[i].type || 'mcq',
            difficulty: saved[i].difficulty || 'medium',
            subject:    saved[i].subject || subject,
            topic:      saved[i].topic   || topic,
            gradeLevel: saved[i].gradeLevel || gradeLevel,
            inBank:     addToBank,
            passage:    saved[i].passage || null,
          });
          saved[i] = { ...saved[i], id: question.id };
        } else if (addToBank && saved[i]._source !== 'bank') {
          await api.put(`/questions/${saved[i].id}`, { inBank: true });
          saved[i] = { ...saved[i], _source: 'bank' };
        }
      }
      setQuestions(saved);

      // Set ordered question list on exam — include full snapshot data so bank and paper are independent
      await api.put(`/exams/${currentId}/questions`, {
        questions: saved.map(q => ({
          questionId:  q.id,
          part:        'Part 1',
          stem:        q.stem        || null,
          options:     q.options     || [],
          answer:      q.answer      || null,
          type:        q.type        || 'mcq',
          passage:     q.passage     || null,
          imageUrl:    q.imageUrl    || null,
          audioUrl:    q.audioUrl    || null,
          videoUrl:    q.videoUrl    || null,
          stimulus:    q.stimulus    || null,
        })),
      });

      if (publish) {
        const { exam, studentLink } = await api.post(`/exams/${currentId}/publish`);
        setIsPublished(true);
        const link = studentLink || `${window.location.origin}/e/${exam.access_token}`;
        setPublishModal({ open: true, link, token: exam.access_token });
      } else {
        toast(addToBank ? 'Saved & questions added to bank!' : 'Draft saved!', 'success');
      }
    } catch (err) {
      toast(err.message || 'Failed to save.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleQuestionSave(idx, updated) {
    setQuestions(prev => prev.map((q, i) => i === idx ? updated : q));
    setEditingIdx(null);

    // If exam and question are already persisted, write the snapshot immediately
    // so the edit survives a refresh without requiring a full Save Draft
    if (examId && updated.id) {
      try {
        await api.put(`/exams/${examId}/questions/${updated.id}`, {
          stem:    updated.stem,
          options: updated.options,
          answer:  updated.answer,
          type:    updated.type,
        });
        setJustSavedId(updated.id);
        setTimeout(() => setJustSavedId(null), 2000);
      } catch {
        toast('Edit shown locally. Click Save Draft to persist.', 'warning');
      }
    }
  }

  async function handleUnpublish() {
    if (!examId) return;
    setSaving(true);
    try {
      await api.post(`/exams/${examId}/unpublish`);
      setIsPublished(false);
      toast('Exam returned to draft.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(publishModal.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loadingExam) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8 text-primary-600" />
      </div>
    );
  }

  const LETTERS = ['A', 'B', 'C', 'D'];

  return (
    <div className="pb-24">

      {/* Breadcrumb */}
      <nav className="text-sm text-slate-400 mb-4">
        <Link to="/dashboard" className="hover:text-slate-600">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-600">{examId ? 'Edit Exam' : 'New Exam'}</span>
      </nav>

      <h1 className="page-title mb-6">{examId ? (title || 'Edit Exam') : 'New Exam'}</h1>

      {/* ── Section A — Exam Details ── */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <PencilSquareIcon className="w-4 h-4 text-primary-500" /> Exam Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <label className="label">Title <span className="text-red-400">*</span></label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Grade 10 Science Mid-Term" />
          </div>

          <div>
            <label className="label">Duration (minutes)</label>
            <input className="input" type="number" min="0" max="360"
              value={duration} onChange={e => setDuration(e.target.value)} placeholder="45" />
          </div>

          <div>
            <label className="label">Subject</label>
            <input className="input" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Science" />
          </div>

          <div>
            <label className="label">Topic</label>
            <input className="input" value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Human Body" />
          </div>

          <div>
            <label className="label">Grade Level</label>
            <input className="input" value={gradeLevel} onChange={e => setGradeLevel(e.target.value)}
              placeholder="e.g. Grade 10" />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label">Description / Instructions</label>
            <textarea className="input resize-none" rows={2} value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Instructions shown to students before the exam starts..." />
          </div>

          {/* Exam type */}
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label">Exam Type</label>
            <div className="flex gap-3 mt-1">
              {[
                { val: 'open',   label: 'Open',   desc: 'Anyone with the link can take this exam.' },
                { val: 'closed', label: 'Closed', desc: 'Students must enter their email to begin.' },
              ].map(opt => (
                <label key={opt.val}
                  className={`flex-1 flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors
                    ${examType === opt.val ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}
                    ${opt.val === 'closed' && !isPro ? 'opacity-70' : ''}`}>
                  <input type="radio" name="examType" value={opt.val}
                    checked={examType === opt.val}
                    onChange={() => {
                      if (opt.val === 'closed' && !isPro) { navigate('/billing'); return; }
                      setExamType(opt.val);
                    }}
                    className="mt-0.5 text-primary-600" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-800">{opt.label}</span>
                      {opt.val === 'closed' && <ProBadge />}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main body: 2 columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Section B — Question Sources ── */}
        <div className="lg:col-span-3">
          <div className="card overflow-hidden">

            {/* Tab bar */}
            <div className="flex border-b border-slate-200 overflow-x-auto">
              {[
                { key: 'manual', label: 'Manual',        icon: PencilSquareIcon },
                { key: 'ai',     label: 'AI Generate',   icon: SparklesIcon },
                { key: 'pdf',    label: 'Import PDF',    icon: DocumentArrowUpIcon },
                { key: 'bank',   label: 'Question Bank', icon: CircleStackIcon },
              ].map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex-shrink-0
                    ${activeTab === key
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            <div className="p-5">

              {/* ── Manual tab ── */}
              {activeTab === 'manual' && (
                <div className="space-y-4">
                  {/* Question type selector */}
                  <div className="flex gap-2">
                    <label className={`flex-1 flex items-center justify-center py-2.5 rounded-lg border-2 cursor-pointer text-sm font-medium transition-colors
                      ${mType === 'mcq' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      <input type="radio" className="sr-only" checked={mType === 'mcq'}
                        onChange={() => { setMType('mcq'); setMAnswer('A'); }} />
                      Multiple Choice
                    </label>
                    <label
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors cursor-pointer
                        ${!isPro ? 'opacity-80' : ''}
                        ${mType === 'short_answer' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      onClick={() => { if (!isPro) { navigate('/billing'); return; } setMType('short_answer'); setMAnswer(''); }}>
                      Short Answer <ProBadge />
                    </label>
                  </div>

                  <div>
                    <label className="label">Question text</label>
                    <textarea
                      className={`input resize-none ${mErrors.stem ? 'border-red-400' : ''}`}
                      rows={3} value={mStem} onChange={e => setMStem(e.target.value)}
                      placeholder="Enter the question here..." />
                    {mErrors.stem && <p className="text-xs text-red-500 mt-1">{mErrors.stem}</p>}
                  </div>

                  {mType === 'mcq' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {LETTERS.map((letter, i) => (
                          <div key={letter}>
                            <label className="label text-xs">
                              Option {letter} {i < 2 && <span className="text-red-400">*</span>}
                            </label>
                            <input
                              className={`input ${mErrors.opts && i < 2 ? 'border-red-400' : ''}`}
                              value={mOpts[i]}
                              onChange={e => {
                                const n = [...mOpts]; n[i] = e.target.value; setMOpts(n);
                              }}
                              placeholder={`Option ${letter}`} />
                          </div>
                        ))}
                      </div>
                      {mErrors.opts && <p className="text-xs text-red-500 -mt-2">{mErrors.opts}</p>}

                      <div className="flex gap-4 items-end flex-wrap">
                        <div>
                          <label className="label">Correct Answer</label>
                          <div className="flex gap-2">
                            {LETTERS.map(letter => (
                              <label key={letter}
                                className={`flex items-center justify-center w-10 h-10 rounded-lg border-2 cursor-pointer font-semibold text-sm transition-colors
                                  ${mAnswer === letter
                                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                                    : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                <input type="radio" name="mAnswer" value={letter}
                                  checked={mAnswer === letter} onChange={() => setMAnswer(letter)}
                                  className="sr-only" />
                                {letter}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <label className="label">Difficulty</label>
                          <select className="input" value={mDiff} onChange={e => setMDiff(e.target.value)}>
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {mType === 'short_answer' && (
                    <div className="space-y-3">
                      <div>
                        <label className="label">Model Answer <span className="text-xs text-slate-400">(optional — not shown to students)</span></label>
                        <textarea className="input resize-none" rows={2}
                          value={mAnswer} onChange={e => setMAnswer(e.target.value)}
                          placeholder="Model answer for teacher reference only..." />
                      </div>
                      <div>
                        <label className="label">Difficulty</label>
                        <select className="input" value={mDiff} onChange={e => setMDiff(e.target.value)}>
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <button onClick={handleAddManual} className="btn-primary w-full">
                    <PlusIcon className="w-4 h-4 mr-1.5" /> Add to Exam
                  </button>
                </div>
              )}

              {/* ── AI tab ── */}
              {activeTab === 'ai' && (
                <div className="space-y-4">
                  <div>
                    <label className="label">What should the questions be about?</label>
                    <textarea className="input resize-none" rows={4}
                      value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                      placeholder="Describe the topic, paste a passage, or give specific instructions — e.g. 'Generate 10 questions about the water cycle for Grade 8.'" />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="label">Count</label>
                      <input className="input" type="number" min="1" max="50"
                        value={aiCount} onChange={e => setAiCount(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Difficulty</label>
                      <select className="input" value={aiDiff} onChange={e => setAiDiff(e.target.value)}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Subject override</label>
                      <input className="input" value={aiSubject} onChange={e => setAiSubject(e.target.value)}
                        placeholder={subject || 'Uses exam subject'} />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" className="rounded text-primary-600"
                      checked={aiPassage} onChange={e => setAiPassage(e.target.checked)} />
                    <span className="text-sm text-slate-600">Include a reading passage with each question</span>
                  </label>

                  <button onClick={handleAiGenerate} disabled={aiLoading} className="btn-primary w-full">
                    {aiLoading
                      ? <><Spinner className="w-4 h-4 mr-2" /> Generating…</>
                      : <><SparklesIcon className="w-4 h-4 mr-1.5" /> Generate Questions</>}
                  </button>

                  {aiResults.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">
                          {aiResults.length} questions generated
                        </span>
                        <div className="flex gap-3">
                          <button onClick={() => setAiSel(new Set(aiResults.map((_, i) => i)))}
                            className="text-xs text-primary-600 hover:underline">All</button>
                          <button onClick={() => setAiSel(new Set())}
                            className="text-xs text-slate-400 hover:underline">None</button>
                        </div>
                      </div>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {aiResults.map((q, i) => (
                          <label key={i}
                            className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-200 hover:border-primary-200 cursor-pointer">
                            <input type="checkbox" className="mt-0.5 text-primary-600 rounded flex-shrink-0"
                              checked={aiSel.has(i)}
                              onChange={e => {
                                const next = new Set(aiSel);
                                e.target.checked ? next.add(i) : next.delete(i);
                                setAiSel(next);
                              }} />
                            <div className="min-w-0">
                              <p className="text-sm text-slate-800 line-clamp-2">{q.stem}</p>
                              {q.answer && <p className="text-xs text-slate-400 mt-0.5">Ans: {q.answer}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                      <button onClick={addAiSelected} disabled={aiSel.size === 0} className="btn-primary w-full">
                        Add {aiSel.size} Selected to Exam
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── PDF tab ── */}
              {activeTab === 'pdf' && (
                <div className="space-y-4">
                  <div>
                    <label className="label">Upload Exam PDF</label>
                    <div
                      className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
                      onClick={() => pdfInputRef.current?.click()}>
                      <DocumentArrowUpIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      {pdfFileName
                        ? <p className="text-sm font-medium text-slate-700">{pdfFileName}</p>
                        : <p className="text-sm text-slate-500">Drop a PDF or click to browse</p>}
                      <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={e => {
                          setPdfFileName(e.target.files?.[0]?.name || '');
                          setPdfResults([]); setPdfSel(new Set());
                        }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Max 20 MB. AI extracts all questions from the paper.</p>
                  </div>

                  <button onClick={handlePdfExtract} disabled={pdfLoading || !pdfFileName}
                    className="btn-primary w-full">
                    {pdfLoading
                      ? <><Spinner className="w-4 h-4 mr-2" /> Extracting…</>
                      : <><SparklesIcon className="w-4 h-4 mr-1.5" /> Extract Questions</>}
                  </button>

                  {pdfResults.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">
                          {pdfResults.length} questions found
                        </span>
                        <div className="flex gap-3">
                          <button onClick={() => setPdfSel(new Set(pdfResults.map((_, i) => i)))}
                            className="text-xs text-primary-600 hover:underline">All</button>
                          <button onClick={() => setPdfSel(new Set())}
                            className="text-xs text-slate-400 hover:underline">None</button>
                        </div>
                      </div>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {pdfResults.map((q, i) => (
                          <label key={i}
                            className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-200 hover:border-primary-200 cursor-pointer">
                            <input type="checkbox" className="mt-0.5 text-primary-600 rounded flex-shrink-0"
                              checked={pdfSel.has(i)}
                              onChange={e => {
                                const next = new Set(pdfSel);
                                e.target.checked ? next.add(i) : next.delete(i);
                                setPdfSel(next);
                              }} />
                            <div className="min-w-0">
                              <p className="text-sm text-slate-800 line-clamp-2">{q.stem}</p>
                              {q.answer && <p className="text-xs text-slate-400 mt-0.5">Ans: {q.answer}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                      <button onClick={addPdfSelected} disabled={pdfSel.size === 0}
                        className="btn-primary w-full">
                        Add {pdfSel.size} Selected to Exam
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Bank tab ── */}
              {activeTab === 'bank' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input className="input flex-1" value={bankSearch}
                      onChange={e => onBankSearchChange(e.target.value)}
                      placeholder="Search questions…" />
                    <input className="input w-32" value={bankSubj}
                      onChange={e => setBankSubj(e.target.value)}
                      placeholder="Subject" />
                  </div>

                  {bankLoading ? (
                    <div className="flex justify-center py-10">
                      <Spinner className="w-6 h-6 text-primary-500" />
                    </div>
                  ) : bankQuestions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <CircleStackIcon className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                      <p className="text-sm">No questions in your bank yet.</p>
                      <p className="text-xs mt-1">Add questions manually or via AI, then save to bank.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-slate-400">{bankTotal} question{bankTotal !== 1 ? 's' : ''} in bank</p>
                      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                        {bankQuestions.map(q => {
                          const inExam = examQIds.has(q.id);
                          return (
                            <div key={q.id}
                              className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-primary-200">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-800 line-clamp-2">{q.stem}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <DiffBadge value={q.difficulty} />
                                  {q.subject && <span className="text-[10px] text-slate-400">{q.subject}</span>}
                                </div>
                              </div>
                              <button
                                onClick={() => !inExam && addFromBank(q)}
                                disabled={inExam}
                                className={`shrink-0 btn-sm ${inExam ? 'btn-ghost text-green-600 cursor-default' : 'btn-primary'}`}>
                                {inExam
                                  ? <><CheckIcon className="w-3.5 h-3.5 mr-1" /> Added</>
                                  : <><PlusIcon className="w-3.5 h-3.5 mr-1" /> Add</>}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {bankTotal > 15 && (
                        <div className="flex justify-between items-center pt-1">
                          <button disabled={bankPage === 1}
                            onClick={() => fetchBank(bankPage - 1)}
                            className="btn-ghost btn-sm disabled:opacity-40">← Prev</button>
                          <span className="text-xs text-slate-400">Page {bankPage}</span>
                          <button disabled={bankPage * 15 >= bankTotal}
                            onClick={() => fetchBank(bankPage + 1)}
                            className="btn-ghost btn-sm disabled:opacity-40">Next →</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── Section C — Current Questions ── */}
        <div className="lg:col-span-2">
          <div className="card p-4 sticky top-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700">
                Exam Questions
                <span className="ml-2 text-xs font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  {questions.length}
                </span>
              </h2>
              {questions.length > 0 && (
                <button onClick={() => setQuestions([])}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                  Clear all
                </button>
              )}
            </div>

            {questions.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <PlusIcon className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm">Add questions using the panel on the left.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {questions.map((q, i) =>
                  editingIdx === i ? (
                    <QuestionEditForm key={q._lid} q={q} index={i} total={questions.length}
                      onMoveUp={() => moveUp(i)}
                      onMoveDown={() => moveDown(i)}
                      onSave={updated => handleQuestionSave(i, updated)}
                      onCancel={() => setEditingIdx(null)} />
                  ) : (
                    <QuestionItem key={q._lid} q={q} index={i} total={questions.length}
                      onMoveUp={() => moveUp(i)}
                      onMoveDown={() => moveDown(i)}
                      onEdit={() => setEditingIdx(i)}
                      onRemove={() => setQuestions(prev => prev.filter((_, idx) => idx !== i))}
                      justSaved={justSavedId === q.id} />
                  )
                )}
              </div>
            )}
          </div>
        </div>

      </div>{/* end grid */}

      {/* ── Section D — Sticky Save bar ── */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-30 bg-white border-t border-slate-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm text-slate-500 font-medium whitespace-nowrap">
              {questions.length} question{questions.length !== 1 ? 's' : ''}
            </span>
            {isPublished && (
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                Published
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isPublished && publishModal.link && (
              <button onClick={() => setPublishModal(m => ({ ...m, open: true }))}
                className="btn-ghost btn-sm text-primary-600 hidden sm:inline-flex">
                <ClipboardDocumentIcon className="w-4 h-4 mr-1" /> Share Link
              </button>
            )}
            {isPublished && (
              <button onClick={handleUnpublish} disabled={saving}
                className="btn-ghost btn-sm text-slate-500 hidden sm:inline-flex">
                Unpublish
              </button>
            )}
            <button onClick={() => saveExam()} disabled={saving} className="btn-secondary btn-sm">
              {saving && <Spinner className="w-4 h-4 mr-1.5" />}
              Save Draft
            </button>
            <button onClick={() => saveExam({ addToBank: true })} disabled={saving}
              className="btn-ghost btn-sm hidden sm:inline-flex">
              Save &amp; Add to Bank
            </button>
            <button onClick={() => saveExam({ publish: true })} disabled={saving}
              className="btn-primary">
              {saving && <Spinner className="w-4 h-4 mr-1.5" />}
              {isPublished ? 'Republish →' : 'Publish →'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Publish modal ── */}
      {publishModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setPublishModal(m => ({ ...m, open: false })); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-bold text-slate-900 text-lg">Exam Published!</h2>
                <p className="text-sm text-slate-500 mt-0.5">Share the link or QR code with your students.</p>
              </div>
              <button onClick={() => setPublishModal(m => ({ ...m, open: false }))}
                className="p-1 rounded hover:bg-slate-100 text-slate-400">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-center mb-5">
              <div className="p-3 bg-white border-2 border-slate-200 rounded-xl">
                <QRCodeSVG value={publishModal.link} size={160} />
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2.5 mb-4">
              <span className="text-sm text-slate-600 flex-1 break-all select-all min-w-0">
                {publishModal.link}
              </span>
              <button onClick={copyLink} className="shrink-0 text-primary-600 hover:text-primary-700">
                {copied
                  ? <CheckIcon className="w-5 h-5 text-green-500" />
                  : <ClipboardDocumentIcon className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex gap-2">
              <a href={publishModal.link} target="_blank" rel="noreferrer"
                className="btn-secondary btn-sm flex-1 text-center">
                Preview as Student
              </a>
              <button onClick={() => { setPublishModal(m => ({ ...m, open: false })); navigate('/results'); }}
                className="btn-ghost btn-sm flex-1">
                View Results
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
