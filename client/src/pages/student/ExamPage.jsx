import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ExclamationCircleIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import Spinner from '../../components/UI/Spinner';

const _apiHost = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '').replace(/\/api\/v1$/, '');
const BASE = _apiHost ? `${_apiHost}/api/v1` : '/api/v1';

async function sGet(path) {
  const res  = await fetch(`${BASE}${path}`);
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'Error'), { code: data.error, status: res.status });
  return data;
}
async function sPost(path, body) {
  const res  = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'Error'), { code: data.error, status: res.status });
  return data;
}

// ── i18n ─────────────────────────────────────────────────────────────────────
const T = {
  en: {
    start: 'Start Exam', name: 'Your name', nameP: 'e.g. Kamal Perera',
    cls: 'Class / Grade', clsP: 'e.g. 10A',
    email: 'Email address', emailP: 'your@email.com',
    next: 'Next', prev: 'Previous', submit: 'Submit Exam',
    qOf: (n, t) => `Question ${n} of ${t}`,
    yourScore: 'Your Score', correct: 'Correct', timeTaken: 'Time taken',
    powered: 'Powered by Gradispace',
    submitQ: 'Ready to submit?',
    submitNote: "You can't change your answers after submitting.",
    cancel: 'Go back',
    unanswered: (n) => `${n} question${n !== 1 ? 's' : ''} unanswered`,
    timeUp: "Time's up! Submitting…",
  },
  si: {
    start: 'විභාගය ආරම්භ කරන්න', name: 'ඔබගේ නම', nameP: 'උදා: කමල් පෙරේරා',
    cls: 'ශ්‍රේණිය', clsP: 'උදා: 10A',
    email: 'විද්‍යුත් තැපෑල', emailP: 'your@email.com',
    next: 'ඊළඟ', prev: 'පෙර', submit: 'ඉදිරිපත් කරන්න',
    qOf: (n, t) => `ප්‍රශ්නය ${n}/${t}`,
    yourScore: 'ඔබේ ලකුණු', correct: 'නිවැරදි', timeTaken: 'ගතවූ කාලය',
    powered: 'Powered by Gradispace',
    submitQ: 'ඉදිරිපත් කිරීමට සූදානම්ද?',
    submitNote: 'ඉදිරිපත් කිරීමෙන් පසු වෙනස් කළ නොහැක.',
    cancel: 'ආපසු',
    unanswered: (n) => `ප්‍රශ්න ${n}කට පිළිතුරු නොමැත`,
    timeUp: 'කාලය ශේෂ නොමැත! ඉදිරිපත් කෙරේ…',
  },
};

const GRADE_COLOUR = {
  'Excellent':       '#16a34a',
  'Good':            '#2563eb',
  'Keep Practising': '#d97706',
  'Try Again':       '#dc2626',
};

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── Brand header ──────────────────────────────────────────────────────────────
function BrandHeader({ branding, title }) {
  const colour = branding?.brandColour || '#4F46E5';
  return (
    <div className="w-full">
      {/* Banner */}
      <div className="w-full h-28 md:h-36"
        style={{
          background: branding?.bannerImage
            ? `url(${branding.bannerImage}) center/cover no-repeat`
            : `linear-gradient(135deg, ${colour}44 0%, ${colour}88 100%)`,
        }} />
      {/* Identity row */}
      <div className="max-w-lg mx-auto px-4 -mt-6 flex items-end gap-3 pb-4">
        {branding?.profilePhoto ? (
          <img src={branding.profilePhoto} alt=""
            className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md flex-shrink-0"
            style={{ borderColor: colour }} />
        ) : (
          <div className="w-12 h-12 rounded-full border-2 border-white shadow-md flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
            style={{ background: colour }}>
            G
          </div>
        )}
        <div className="min-w-0">
          {branding?.portalName && (
            <p className="text-xs text-slate-500 leading-none mb-0.5">{branding.portalName}</p>
          )}
          {title && <p className="font-semibold text-slate-900 truncate text-sm">{title}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Single question ────────────────────────────────────────────────────────────
function QuestionCard({ q, index, total, answer, onAnswer, colour, t }) {
  const options = Array.isArray(q.options) ? q.options : [];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
      {/* Part label */}
      {q.part && <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{q.part}</p>}
      {q.part_instruction && <p className="text-sm text-slate-500 italic mb-3 border-l-2 pl-3" style={{ borderColor: colour }}>{q.part_instruction}</p>}

      {/* Passage */}
      {q.passage && (
        <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm text-slate-600 border border-slate-200">
          {q.passage.title && <p className="font-semibold mb-1">{q.passage.title}</p>}
          <p className="leading-relaxed">{q.passage.text}</p>
        </div>
      )}

      {/* Question number + stem */}
      <p className="text-xs text-slate-400 mb-1">{t.qOf(index + 1, total)}</p>
      <p className="text-base font-medium text-slate-900 leading-snug mb-5">{q.stem}</p>

      {/* MCQ options */}
      {q.type === 'mcq' && (
        <div className="space-y-2.5">
          {options.map(opt => {
            const selected = answer === opt.letter;
            return (
              <button key={opt.letter} onClick={() => onAnswer(q.id, opt.letter)}
                className="w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border-2 transition-all font-normal text-sm"
                style={selected
                  ? { background: colour + '18', borderColor: colour, color: colour }
                  : { background: 'white', borderColor: '#E2E8F0', color: '#374151' }}>
                <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                  style={selected ? { background: colour, borderColor: colour, color: 'white' } : { borderColor: '#CBD5E1' }}>
                  {opt.letter}
                </span>
                <span className="flex-1 leading-snug">{opt.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Short answer */}
      {q.type === 'short_answer' && (
        <textarea
          className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-primary-400"
          rows={4}
          placeholder="Write your answer here…"
          value={answer || ''}
          onChange={e => onAnswer(q.id, e.target.value)}
          style={{ '--tw-ring-color': colour }}
        />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExamPage() {
  const { token } = useParams();

  const [phase, setPhase]   = useState('loading'); // loading|error|entry|exam|result
  const [exam, setExam]     = useState(null);
  const [questions, setQuestions] = useState([]);
  const [branding, setBranding]   = useState(null);
  const [errorMsg, setErrorMsg]   = useState('');

  // Entry form
  const [name, setName]   = useState('');
  const [cls, setCls]     = useState('');
  const [email, setEmail] = useState('');
  const [starting, setStarting] = useState(false);
  const [entryError, setEntryError] = useState('');

  // Exam session
  const [sessionToken, setSessionToken] = useState('');
  const [answers, setAnswers]           = useState({});
  const [currentQ, setCurrentQ]         = useState(0);
  const [timeLeft, setTimeLeft]         = useState(0);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [timeUpMsg, setTimeUpMsg]       = useState('');

  // Result
  const [result, setResult] = useState(null);

  const submitRef = useRef(null);
  const colour    = branding?.brandColour || '#4F46E5';
  const locale    = branding?.locale || 'en';
  const t         = T[locale] || T.en;

  // Load exam
  useEffect(() => {
    sGet(`/student/exam/${token}`)
      .then(({ exam: e, questions: qs, branding: b }) => {
        setExam(e); setQuestions(qs); setBranding(b);
        setPhase('entry');
      })
      .catch(err => { setErrorMsg(err.message); setPhase('error'); });
  }, [token]);

  // Timer
  useEffect(() => {
    if (phase !== 'exam' || !exam?.duration) return;
    const secs = exam.duration * 60;
    setTimeLeft(secs);
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(id);
          setTimeUpMsg(T[locale]?.timeUp || T.en.timeUp);
          submitRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]); // eslint-disable-line

  async function handleStart(e) {
    e.preventDefault();
    if (!name.trim()) { setEntryError(locale === 'si' ? 'නම අවශ්‍යයි.' : 'Name is required.'); return; }
    if (exam?.examType === 'closed' && !email.trim()) {
      setEntryError(locale === 'si' ? 'ඊමේල් ලිපිනය අවශ්‍යයි.' : 'Email is required for this exam.');
      return;
    }
    setStarting(true); setEntryError('');
    try {
      const { sessionToken: tok } = await sPost(`/student/exam/${token}/start`, {
        studentName: name.trim(), studentClass: cls.trim() || null,
        email: email.trim() || null,
      });
      setSessionToken(tok);
      setPhase('exam');
    } catch (err) {
      if (err.code === 'already_submitted')
        setEntryError(err.message);
      else
        setEntryError(err.message || 'Failed to start exam.');
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true); setShowConfirm(false);
    try {
      const { result: r, branding: b } = await sPost(`/student/exam/${token}/submit`, { sessionToken, answers });
      setResult(r); setBranding(b); setPhase('result');
    } catch (err) {
      setSubmitting(false);
      setErrorMsg(err.message || 'Submission failed. Please try again.');
    }
  }
  submitRef.current = handleSubmit;

  function setAnswer(qId, val) {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  }

  const unanswered = questions.filter(q => !answers[q.id]).length;
  const paginated  = exam?.examDisplayMode !== 'scrollable';

  // ── LOADING ──
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner className="w-8 h-8 text-primary-500" />
      </div>
    );
  }

  // ── ERROR ──
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <ExclamationCircleIcon className="w-14 h-14 text-slate-300 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-slate-800 mb-2">Exam not available</h1>
          <p className="text-slate-500 text-sm">{errorMsg || 'This exam link is not active.'}</p>
        </div>
      </div>
    );
  }

  // ── ENTRY ──
  if (phase === 'entry') {
    return (
      <div className="min-h-screen bg-slate-100">
        <BrandHeader branding={branding} title={exam?.title} />
        <div className="max-w-lg mx-auto px-4 pb-12">
          {branding?.welcomeMessage && (
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 mb-4 text-sm text-slate-600 leading-relaxed">
              {branding.welcomeMessage}
            </div>
          )}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="mb-5 text-sm text-slate-500 flex gap-4 flex-wrap">
              {exam?.duration > 0 && <span className="flex items-center gap-1"><ClockIcon className="w-4 h-4" />{exam.duration} min</span>}
              <span>{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
              {exam?.subject && <span>{exam.subject}</span>}
            </div>
            <form onSubmit={handleStart} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.name} <span className="text-red-400">*</span></label>
                <input className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-400"
                  value={name} onChange={e => setName(e.target.value)} placeholder={t.nameP} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.cls}</label>
                <input className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-400"
                  value={cls} onChange={e => setCls(e.target.value)} placeholder={t.clsP} />
              </div>
              {exam?.examType === 'closed' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.email} <span className="text-red-400">*</span></label>
                  <input type="email" className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-400"
                    value={email} onChange={e => setEmail(e.target.value)} placeholder={t.emailP} />
                </div>
              )}
              {entryError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{entryError}</p>
              )}
              <button type="submit" disabled={starting}
                className="w-full py-3 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                style={{ background: colour }}>
                {starting ? <Spinner className="w-5 h-5" /> : t.start}
              </button>
            </form>
          </div>
          <p className="text-center text-xs text-slate-400 mt-6">{t.powered}</p>
        </div>
      </div>
    );
  }

  // ── EXAM ──
  if (phase === 'exam') {
    const q = questions[currentQ];
    return (
      <div className="min-h-screen bg-slate-100">
        {/* Sticky top bar */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
            {paginated ? (
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500 font-medium">{t.qOf(currentQ + 1, questions.length)}</span>
                  <span className="text-xs text-slate-400">{questions.length - unanswered}/{questions.length}</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${((currentQ + 1) / questions.length) * 100}%`, background: colour }} />
                </div>
              </div>
            ) : (
              <span className="text-sm font-medium text-slate-700">{exam?.title}</span>
            )}
            {exam?.duration > 0 && (
              <div className={`flex items-center gap-1 text-sm font-mono font-semibold flex-shrink-0 px-2.5 py-1 rounded-lg
                ${timeLeft < 120 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700'}`}>
                <ClockIcon className="w-4 h-4" />
                {formatTime(timeLeft)}
              </div>
            )}
          </div>
        </div>

        {timeUpMsg && (
          <div className="max-w-lg mx-auto px-4 pt-3">
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700 text-center">{timeUpMsg}</div>
          </div>
        )}

        <div className="max-w-lg mx-auto px-4 py-5 pb-28">
          {/* Paginated: single question */}
          {paginated && q && (
            <QuestionCard q={q} index={currentQ} total={questions.length}
              answer={answers[q.id]} onAnswer={setAnswer} colour={colour} t={t} />
          )}

          {/* Scrollable: all questions */}
          {!paginated && questions.map((q, i) => (
            <div key={q.id} className="mb-4">
              <QuestionCard q={q} index={i} total={questions.length}
                answer={answers[q.id]} onAnswer={setAnswer} colour={colour} t={t} />
            </div>
          ))}
        </div>

        {/* Navigation / submit bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-10">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
            {paginated ? (
              <>
                <button onClick={() => setCurrentQ(i => Math.max(0, i - 1))} disabled={currentQ === 0}
                  className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600 disabled:opacity-30">
                  {t.prev}
                </button>
                {currentQ < questions.length - 1 ? (
                  <button onClick={() => setCurrentQ(i => i + 1)}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                    style={{ background: colour }}>
                    {t.next}
                  </button>
                ) : (
                  <button onClick={() => setShowConfirm(true)} disabled={submitting}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                    style={{ background: colour }}>
                    {submitting ? <Spinner className="w-5 h-5 inline" /> : t.submit}
                  </button>
                )}
              </>
            ) : (
              <button onClick={() => setShowConfirm(true)} disabled={submitting}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: colour }}>
                {submitting ? <Spinner className="w-5 h-5 inline" /> : t.submit}
              </button>
            )}
          </div>
        </div>

        {/* Submit confirmation modal */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <h2 className="font-bold text-slate-900 text-lg mb-1">{t.submitQ}</h2>
              <p className="text-sm text-slate-500 mb-3">{t.submitNote}</p>
              {unanswered > 0 && (
                <p className="text-sm font-semibold text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
                  ⚠ {t.unanswered(unanswered)}
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600">
                  {t.cancel}
                </button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center"
                  style={{ background: colour }}>
                  {submitting ? <Spinner className="w-5 h-5" /> : t.submit}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── RESULT ──
  if (phase === 'result' && result) {
    const gradeColour = GRADE_COLOUR[result.grade] || '#4F46E5';
    const parts = Object.entries(result.breakdown || {});
    return (
      <div className="min-h-screen bg-slate-100">
        <BrandHeader branding={branding} title={exam?.title} />
        <div className="max-w-lg mx-auto px-4 pb-12 space-y-4">
          {/* Score card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="text-6xl font-black mb-1" style={{ color: gradeColour }}>{result.pct}%</div>
            <div className="text-base font-bold mb-5" style={{ color: gradeColour }}>{result.grade}</div>
            <div className="flex justify-center gap-6 text-sm">
              <div>
                <p className="text-2xl font-bold text-slate-900">{result.correct}/{result.total}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t.correct}</p>
              </div>
              {result.timeTaken && (
                <div>
                  <p className="text-2xl font-bold text-slate-900">{result.timeTaken}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.timeTaken}</p>
                </div>
              )}
            </div>
          </div>

          {/* Part breakdown */}
          {parts.length > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">Breakdown</p>
              <div className="space-y-3">
                {parts.map(([part, b]) => {
                  const pct = b.total ? Math.round((b.correct / b.total) * 100) : 0;
                  return (
                    <div key={part}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 font-medium">{part}</span>
                        <span className="text-slate-500">{b.correct}/{b.total} · {pct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colour }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-question review (detailed view) */}
          {exam?.resultView === 'detailed' && result.answers && questions.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">Question Review</p>
              <div className="space-y-3">
                {questions.map((q, i) => {
                  const detail = result.answers[q.id];
                  if (!detail) return null;
                  const isShort = q.type === 'short_answer';
                  const givenOpt   = q.options?.find(o => o.letter === detail.given);
                  const correctOpt = q.options?.find(o => o.letter === detail.correct);
                  return (
                    <div key={q.id} className={`rounded-xl border p-3 space-y-2
                      ${isShort ? 'border-slate-200' : detail.isCorrect ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/40'}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-slate-400 shrink-0 mt-0.5">Q{i + 1}</span>
                        <p className="text-sm text-slate-800 leading-snug flex-1">{q.stem}</p>
                        {!isShort && (
                          detail.isCorrect
                            ? <CheckCircleIcon className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                            : <span className="text-red-500 shrink-0 mt-0.5 font-bold text-xs">✗</span>
                        )}
                      </div>
                      {!isShort && (
                        <div className="flex flex-wrap gap-2 pl-5 text-xs">
                          <span className={`px-2 py-0.5 rounded-full font-medium
                            ${detail.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            Your answer: {givenOpt?.text || detail.given || '—'}
                          </span>
                          {!detail.isCorrect && detail.correct && (
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              Correct: {correctOpt?.text || detail.correct}
                            </span>
                          )}
                        </div>
                      )}
                      {isShort && detail.given && (
                        <p className="text-xs text-slate-600 bg-slate-100 rounded-lg px-2.5 py-1.5 pl-5 ml-5">
                          {detail.given}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer message */}
          {branding?.footerMessage && (
            <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 text-sm text-slate-600 text-center leading-relaxed">
              {branding.footerMessage}
            </div>
          )}

          <p className="text-center text-xs text-slate-400">{t.powered}</p>
        </div>
      </div>
    );
  }

  return null;
}
