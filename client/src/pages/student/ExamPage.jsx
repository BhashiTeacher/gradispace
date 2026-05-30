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

// ── Stimulus block ────────────────────────────────────────────────────────────
function StimulusBlock({ stimulus, colour }) {
  if (!stimulus) return null;
  return (
    <div className="rounded-xl border-2 p-4 mb-4 space-y-3"
      style={{ borderColor: colour + '44', background: colour + '08' }}>
      {stimulus.title && (
        <p className="text-sm font-semibold text-slate-800">{stimulus.title}</p>
      )}
      {stimulus.imageUrl && (
        <img src={stimulus.imageUrl} alt="Stimulus"
          className="w-full max-h-64 object-contain rounded-lg border border-slate-100"
          onError={e => { e.currentTarget.style.display = 'none'; }} />
      )}
      {stimulus.text && (
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{stimulus.text}</p>
      )}
    </div>
  );
}

// ── Audio player ──────────────────────────────────────────────────────────────
function AudioPlayer({ questionId, token, sessionToken, playsLimit, colour }) {
  const [playsUsed, setPlaysUsed] = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const audioRef                  = useRef(null);

  const limit     = playsLimit != null ? parseInt(playsLimit) : null;
  const remaining = limit != null ? limit - playsUsed : Infinity;
  const exhausted = remaining <= 0;

  async function handlePlay() {
    if (exhausted || loading) return;
    setLoading(true); setError('');
    try {
      const data = await sPost(`/student/exam/${token}/audio-play`, { sessionToken, questionId });
      setPlaysUsed(data.playsUsed);
      if (audioRef.current) {
        audioRef.current.src = data.audioUrl;
        await audioRef.current.play();
      }
    } catch (err) {
      if (err.code === 'play_limit_reached') {
        setPlaysUsed(limit);
        setError('Maximum plays reached.');
      } else {
        setError('Could not load audio.');
      }
    } finally { setLoading(false); }
  }

  return (
    <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 mb-4 border border-slate-200">
      <button onClick={handlePlay} disabled={exhausted || loading}
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
        style={{ background: exhausted ? '#94a3b8' : colour }}>
        {loading
          ? <Spinner className="w-4 h-4 text-white" />
          : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700">Audio clip</p>
        {limit != null && (
          <p className={`text-xs mt-0.5 ${exhausted ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
            {exhausted ? 'No plays remaining' : `${remaining} play${remaining !== 1 ? 's' : ''} remaining`}
          </p>
        )}
        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      </div>
      <audio ref={audioRef} />
    </div>
  );
}

// ── Single question ────────────────────────────────────────────────────────────
function QuestionCard({ q, index, total, answer, onAnswer, colour, t, token, sessionToken }) {
  const options = Array.isArray(q.options) ? q.options : [];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
      {/* Part label */}
      {q.part && <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{q.part}</p>}
      {q.part_instruction && <p className="text-sm text-slate-500 italic mb-3 border-l-2 pl-3" style={{ borderColor: colour }}>{q.part_instruction}</p>}

      {/* Stimulus block */}
      {q.stimulus && <StimulusBlock stimulus={q.stimulus} colour={colour} />}

      {/* Passage (legacy per-question reading text) */}
      {q.passage && !q.stimulus && (
        <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm text-slate-600 border border-slate-200">
          {q.passage.title && <p className="font-semibold mb-1">{q.passage.title}</p>}
          <p className="leading-relaxed">{q.passage.text}</p>
        </div>
      )}

      {/* Question number + stem */}
      <p className="text-xs text-slate-400 mb-1">{t.qOf(index + 1, total)}</p>
      <p className="text-base font-medium text-slate-900 leading-snug mb-5">{q.stem}</p>

      {/* Audio player */}
      {q.has_audio && (
        <AudioPlayer questionId={q.id} token={token} sessionToken={sessionToken}
          playsLimit={q.audio_play_limit} colour={colour} />
      )}

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
                <span className="flex-1 leading-snug">
                  {opt.imageUrl && (
                    <img src={opt.imageUrl} alt={`Option ${opt.letter}`}
                      className="w-full max-h-40 object-contain rounded-lg mb-2 border border-slate-100"
                      onError={e => { e.currentTarget.style.display = 'none'; }} />
                  )}
                  {opt.text}
                </span>
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
  const [result, setResult]       = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

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
  const paginated  = branding?.examDisplayMode !== 'scrollable';

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
              answer={answers[q.id]} onAnswer={setAnswer} colour={colour} t={t}
              token={token} sessionToken={sessionToken} />
          )}

          {/* Scrollable: all questions */}
          {!paginated && questions.map((q, i) => (
            <div key={q.id} className="mb-4">
              <QuestionCard q={q} index={i} total={questions.length}
                answer={answers[q.id]} onAnswer={setAnswer} colour={colour} t={t}
                token={token} sessionToken={sessionToken} />
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

  async function handleDownloadPdf() {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PW = 210, ML = 15, MR = 15, CW = PW - ML - MR;

      function parseHex(hex) {
        const h = (hex || '').replace('#', '');
        if (h.length !== 6) return [79, 70, 229];
        return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
      }
      const [br, bg, bb] = parseHex(colour);
      const gradeRgb = {
        'Excellent': [22,163,74], 'Good': [37,99,235],
        'Keep Practising': [217,119,6], 'Try Again': [220,38,38],
      }[result.grade] || [79,70,229];

      let y = 0;

      function ensurePage(needed = 20) {
        if (y + needed > 277) { doc.addPage(); y = 15; }
      }

      // Brand bar
      doc.setFillColor(br, bg, bb);
      doc.rect(0, 0, PW, 4, 'F');
      y = 12;

      // Portal name
      if (branding?.portalName) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(branding.portalName.toUpperCase(), PW / 2, y, { align: 'center' });
        y += 5;
      }

      // Exam title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(17, 17, 17);
      const titleLines = doc.splitTextToSize(exam?.title || 'Exam Result', CW);
      doc.text(titleLines, PW / 2, y, { align: 'center' });
      y += titleLines.length * 6 + 2;

      // Divider
      doc.setDrawColor(220, 220, 220);
      doc.line(ML, y, PW - MR, y);
      y += 5;

      // Student info + date
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      const infoParts = [name, cls, email].filter(Boolean);
      if (infoParts.length) doc.text(infoParts.join('  ·  '), ML, y);
      doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), PW - MR, y, { align: 'right' });
      y += 9;

      // Provisional banner
      if (result.requiresReview) {
        doc.setFillColor(255, 251, 235);
        doc.setDrawColor(217, 119, 6);
        doc.rect(ML, y, CW, 10, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(146, 64, 14);
        doc.text('PROVISIONAL RESULT — Pending teacher review', PW / 2, y + 6.5, { align: 'center' });
        y += 15;
      }

      // Score box
      doc.setFillColor(...gradeRgb);
      doc.rect(ML, y, CW, 28, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(255, 255, 255);
      doc.text(`${result.pct}%`, PW / 2, y + 13, { align: 'center' });
      doc.setFontSize(10);
      doc.text(result.grade, PW / 2, y + 20.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`${result.correct} / ${result.total} correct`, PW / 2, y + 26, { align: 'center' });
      y += 33;

      // Part breakdown
      const parts = Object.entries(result.breakdown || {});
      if (parts.length > 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        doc.text('Score Breakdown', ML, y);
        y += 5;
        for (const [part, b] of parts) {
          const pct = b.total ? Math.round((b.correct / b.total) * 100) : 0;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(80, 80, 80);
          doc.text(part, ML, y);
          doc.text(`${b.correct}/${b.total}  ${pct}%`, PW - MR, y, { align: 'right' });
          y += 3.5;
          doc.setFillColor(226, 232, 240);
          doc.rect(ML, y, CW, 2, 'F');
          doc.setFillColor(br, bg, bb);
          doc.rect(ML, y, CW * pct / 100, 2, 'F');
          y += 6;
        }
        y += 2;
      }

      // Question review (detailed mode only)
      if (exam?.resultView === 'detailed' && result.answers && questions.length > 0) {
        ensurePage(20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        doc.text('Question Review', ML, y);
        y += 5;

        questions.forEach((q, i) => {
          const det        = result.answers[q.id];
          if (!det) return;
          const isShort    = q.type === 'short_answer';
          const isCorrect  = det.isCorrect === true;
          const givenOpt   = q.options?.find(o => o.letter === det.given);
          const correctOpt = q.options?.find(o => o.letter === det.correct);
          const stemLines  = doc.splitTextToSize(q.stem, CW - 14);
          const boxH = 6 + stemLines.length * 4.5 + 8 + 3;
          ensurePage(boxH + 3);

          doc.setFillColor(...(isCorrect ? [240,253,244] : [254,242,242]));
          doc.rect(ML, y, CW, boxH, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(160, 160, 160);
          doc.text(`Q${i + 1}`, ML + 2, y + 5);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(...(isCorrect ? [22,163,74] : [220,38,38]));
          doc.text(isCorrect ? '✓' : '✗', PW - MR - 2, y + 5, { align: 'right' });

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(30, 30, 30);
          doc.text(stemLines, ML + 10, y + 5);
          y += 5 + stemLines.length * 4.5 + 1;

          doc.setFontSize(8);
          const givenText = isShort
            ? (det.given || '—')
            : (givenOpt?.text || det.given || '—');
          doc.setTextColor(...(isCorrect ? [21,128,61] : [185,28,28]));
          doc.text(`Your answer: ${givenText}`, ML + 10, y);
          y += 4;
          if (!isCorrect && det.correct) {
            doc.setTextColor(21, 128, 61);
            const label = isShort ? 'Expected' : 'Correct';
            const val   = isShort ? det.correct : (correctOpt?.text || det.correct);
            doc.text(`${label}: ${val}`, ML + 10, y);
            y += 4;
          }
          y += 5;
        });
      }

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(180, 180, 180);
        doc.text('Powered by GradiSpace', PW / 2, 291, { align: 'center' });
      }

      const safeName = (name || 'student').replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_');
      const safeExam = (exam?.title || 'exam').replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_');
      doc.save(`result-${safeName}-${safeExam}-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
      console.error('PDF error', err);
    } finally {
      setDownloadingPdf(false);
    }
  }

  // ── RESULT ──
  if (phase === 'result' && result) {
    const gradeColour = GRADE_COLOUR[result.grade] || '#4F46E5';
    const parts = Object.entries(result.breakdown || {});
    return (
      <div className="min-h-screen bg-slate-100">
        <BrandHeader branding={branding} title={exam?.title} />
        <div className="max-w-lg mx-auto px-4 pb-12 space-y-4">
          {/* Provisional result banner */}
          {result.requiresReview && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
              <p className="text-sm font-semibold text-amber-800">⏳ Provisional Result</p>
              <p className="text-xs text-amber-600 mt-1 leading-relaxed">
                This result includes written answers that will be reviewed by your teacher.
                Your final score may change after review.
              </p>
            </div>
          )}

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
                  const isShort    = q.type === 'short_answer';
                  // null means short-answer not auto-matched — treat as incorrect for display
                  const isCorrect  = detail.isCorrect === true;
                  const givenOpt   = q.options?.find(o => o.letter === detail.given);
                  const correctOpt = q.options?.find(o => o.letter === detail.correct);
                  return (
                    <div key={q.id} className={`rounded-xl border p-3 space-y-2
                      ${isCorrect ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/40'}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-slate-400 shrink-0 mt-0.5">Q{i + 1}</span>
                        <p className="text-sm text-slate-800 leading-snug flex-1">{q.stem}</p>
                        {isCorrect
                          ? <CheckCircleIcon className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          : <span className="text-red-500 shrink-0 mt-0.5 font-bold text-xs">✗</span>
                        }
                      </div>
                      <div className="flex flex-wrap gap-2 pl-5 text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-medium
                          ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          Your answer: {isShort
                            ? (detail.given || '—')
                            : (givenOpt?.text || detail.given || '—')}
                        </span>
                        {!isCorrect && detail.correct && (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            {isShort ? 'Expected' : 'Correct'}: {isShort
                              ? detail.correct
                              : (correctOpt?.text || detail.correct)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Download PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="w-full py-3 rounded-2xl border-2 border-slate-200 text-sm font-semibold text-slate-600 flex items-center justify-center gap-2 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50">
            {downloadingPdf ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            )}
            Download Result PDF
          </button>

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
