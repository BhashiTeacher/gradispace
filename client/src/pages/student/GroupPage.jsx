import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ClockIcon, DocumentTextIcon, ExclamationCircleIcon, AcademicCapIcon } from '@heroicons/react/24/outline';
import Spinner from '../../components/UI/Spinner';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function sGet(path) {
  const res  = await fetch(`${BASE}${path}`);
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'Error'), { code: data.error, status: res.status });
  return data;
}

// ── i18n ─────────────────────────────────────────────────────────────────────
const T = {
  en: {
    exams:      'Exams',
    takeExam:   'Take Exam',
    questions:  (n) => `${n} question${n !== 1 ? 's' : ''}`,
    duration:   (n) => `${n} min`,
    noExams:    'No exams are available yet.',
    noExamsSub: 'Check back with your teacher.',
    powered:    'Powered by Gradispace',
    notFound:   'Classroom not found',
    notFoundSub:'This classroom link is not active.',
  },
  si: {
    exams:      'විභාග',
    takeExam:   'විභාගය ආරම්භ කරන්න',
    questions:  (n) => `ප්‍රශ්න ${n}`,
    duration:   (n) => `මිනිත්තු ${n}`,
    noExams:    'දැනට විභාග නොමැත.',
    noExamsSub: 'ඔබේ ගුරුවරයා සමඟ සම්බන්ධ වන්න.',
    powered:    'Powered by Gradispace',
    notFound:   'කාමරය හමු නොවීය',
    notFoundSub:'මෙම සබැඳිය සක්‍රිය නොවේ.',
  },
};

// ── Brand header ──────────────────────────────────────────────────────────────
function BrandHeader({ branding, groupName }) {
  const colour = branding?.brandColour || '#4F46E5';
  return (
    <div className="w-full">
      <div className="w-full h-28 md:h-36"
        style={{
          background: branding?.bannerImage
            ? `url(${branding.bannerImage}) center/cover no-repeat`
            : `linear-gradient(135deg, ${colour}44 0%, ${colour}88 100%)`,
        }} />
      <div className="max-w-2xl mx-auto px-4 -mt-6 flex items-end gap-3 pb-4">
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
          {groupName && <p className="font-semibold text-slate-900 truncate text-sm">{groupName}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Exam card ─────────────────────────────────────────────────────────────────
function ExamCard({ exam, colour, t }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: colour + '18' }}>
          <AcademicCapIcon className="w-5 h-5" style={{ color: colour }} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900 text-sm leading-snug truncate">{exam.title}</h3>
          {(exam.subject || exam.grade_level) && (
            <p className="text-xs text-slate-400 mt-0.5">
              {[exam.subject, exam.grade_level].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {exam.description && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{exam.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <DocumentTextIcon className="w-3.5 h-3.5" />
          {t.questions(exam.question_count || 0)}
        </span>
        {exam.duration > 0 && (
          <span className="flex items-center gap-1">
            <ClockIcon className="w-3.5 h-3.5" />
            {t.duration(exam.duration)}
          </span>
        )}
      </div>

      <a href={`/e/${exam.access_token}`}
        className="block w-full py-2.5 rounded-xl text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: colour }}>
        {t.takeExam}
      </a>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GroupPage() {
  const { token } = useParams();

  const [phase, setPhase]       = useState('loading'); // loading|error|ready
  const [group, setGroup]       = useState(null);
  const [exams, setExams]       = useState([]);
  const [branding, setBranding] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    sGet(`/student/group/${token}`)
      .then(({ group: g, exams: es, branding: b }) => {
        setGroup(g); setExams(es); setBranding(b);
        setPhase('ready');
      })
      .catch(err => { setErrorMsg(err.message); setPhase('error'); });
  }, [token]);

  const colour = branding?.brandColour || '#4F46E5';
  const locale = branding?.locale || 'en';
  const t      = T[locale] || T.en;

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
          <h1 className="text-xl font-semibold text-slate-800 mb-2">{T.en.notFound}</h1>
          <p className="text-slate-500 text-sm">{errorMsg || T.en.notFoundSub}</p>
        </div>
      </div>
    );
  }

  // ── READY ──
  return (
    <div className="min-h-screen bg-slate-100">
      <BrandHeader branding={branding} groupName={group?.name} />

      <div className="max-w-2xl mx-auto px-4 pb-12">
        {/* Welcome message */}
        {branding?.welcomeMessage && (
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 mb-5 text-sm text-slate-600 leading-relaxed">
            {branding.welcomeMessage}
          </div>
        )}

        {/* Group meta */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-800">{t.exams}</h2>
          {(group?.subject || group?.gradeLevel) && (
            <span className="text-xs text-slate-400">
              {[group.subject, group.gradeLevel].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        {/* Exam grid */}
        {exams.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <AcademicCapIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">{t.noExams}</p>
            <p className="text-xs text-slate-400 mt-1">{t.noExamsSub}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {exams.map(exam => (
              <ExamCard key={exam.id} exam={exam} colour={colour} t={t} />
            ))}
          </div>
        )}

        {/* Footer message */}
        {branding?.footerMessage && (
          <div className="mt-6 bg-white rounded-2xl border border-slate-200 px-5 py-4 text-sm text-slate-600 text-center leading-relaxed">
            {branding.footerMessage}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-6">{t.powered}</p>
      </div>
    </div>
  );
}
