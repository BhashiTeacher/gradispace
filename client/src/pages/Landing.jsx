import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  SparklesIcon, BookOpenIcon, ChartBarIcon, PaintBrushIcon,
  UserPlusIcon, PencilSquareIcon, ShareIcon, CheckIcon,
} from '@heroicons/react/24/outline';

const B = { blue: '#2B3FE8', navy: '#1A1A8E', light: '#F0F4FF' };

function go(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen]         = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const links = [
    { label: 'Features',     id: 'features'     },
    { label: 'How it works', id: 'how-it-works'  },
    { label: 'Pricing',      id: 'pricing'       },
  ];

  return (
    <nav className={`fixed inset-x-0 top-0 z-50 bg-white transition-shadow duration-200 ${scrolled ? 'shadow-md' : ''}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center select-none">
          <span className="text-xl font-black tracking-tight" style={{ color: B.blue }}>Gradi</span>
          <span className="text-xl font-black tracking-tight" style={{ color: B.navy }}>Space</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-7">
          {links.map(l => (
            <button key={l.id} onClick={() => go(l.id)}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              {l.label}
            </button>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/login"
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:border-slate-400 transition-colors">
            Sign in
          </Link>
          <Link to="/signup"
            className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: B.blue }}>
            Start free
          </Link>
        </div>

        {/* Hamburger */}
        <button onClick={() => setOpen(o => !o)}
          className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100">
          {open
            ? <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            : <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
          }
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 pb-4 pt-2 space-y-1">
          {links.map(l => (
            <button key={l.id} onClick={() => { go(l.id); setOpen(false); }}
              className="block w-full text-left text-sm font-medium text-slate-700 py-2.5 border-b border-slate-50">
              {l.label}
            </button>
          ))}
          <div className="pt-3 grid grid-cols-2 gap-2">
            <Link to="/login" onClick={() => setOpen(false)}
              className="text-center text-sm font-semibold py-2.5 rounded-lg border border-slate-300 text-slate-700">
              Sign in
            </Link>
            <Link to="/signup" onClick={() => setOpen(false)}
              className="text-center text-sm font-semibold py-2.5 rounded-lg text-white"
              style={{ backgroundColor: B.blue }}>
              Start free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// ── Hero illustration (floating cards) ────────────────────────────────────────
function HeroIllustration() {
  return (
    <div className="relative w-full max-w-md mx-auto lg:mx-0 py-8 px-6">
      {/* Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: B.blue }} />
      </div>

      {/* Main card */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-bold text-slate-900 text-sm">Biology — Term 2</p>
            <p className="text-xs text-slate-400 mt-0.5">34 students · 45 min</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Live</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { v: '78%',  l: 'Avg Score'  },
            { v: '91%',  l: 'Pass Rate'  },
            { v: '34/34',l: 'Completed'  },
          ].map(s => (
            <div key={s.l} className="rounded-xl p-2.5 text-center" style={{ background: B.light }}>
              <p className="text-sm font-bold text-slate-900">{s.v}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Distribution */}
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Score Distribution</p>
        <div className="space-y-1.5">
          {[
            { l: '90–100', w: 38  },
            { l: '75–89',  w: 50  },
            { l: '60–74',  w: 9   },
            { l: '<60',    w: 3   },
          ].map((b, i) => (
            <div key={b.l} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-11 text-right">{b.l}</span>
              <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${b.w}%`, background: B.blue, opacity: 1 - i * 0.22 }} />
              </div>
              <span className="text-xs text-slate-400 w-6">{b.w}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating: AI chip */}
      <div className="absolute -top-2 right-2 bg-white rounded-xl shadow-lg border border-slate-100 px-3 py-2.5 w-44">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: B.light }}>✨</div>
          <div>
            <p className="text-xs font-bold text-slate-800">AI Generated</p>
            <p className="text-xs text-slate-400">12 questions ready</p>
          </div>
        </div>
      </div>

      {/* Floating: student result */}
      <div className="absolute -bottom-2 left-2 bg-white rounded-xl shadow-lg border border-slate-100 px-3 py-2.5 w-44">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: B.blue }}>KP</div>
          <div>
            <p className="text-xs font-bold text-slate-800">Kamal Perera</p>
            <p className="text-xs font-semibold text-green-600">Score: 94% 🎉</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="pt-28 pb-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-14 items-center">

          <div className="max-w-lg">
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6"
              style={{ background: B.light, color: B.blue }}>
              ✦ &nbsp;Free to start · No credit card needed
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 leading-tight mb-5">
              Your exams.<br />Your students.<br />
              <span style={{ color: B.blue }}>Your space.</span>
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed mb-8">
              GradiSpace gives teachers everything they need to create, manage and analyse exams — without the complexity.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/signup"
                className="text-center text-base font-bold text-white px-7 py-3.5 rounded-xl transition-opacity hover:opacity-90 shadow-lg"
                style={{ backgroundColor: B.blue, boxShadow: `0 8px 24px ${B.blue}44` }}>
                Start free today
              </Link>
              <button onClick={() => go('how-it-works')}
                className="text-center text-base font-semibold px-7 py-3.5 rounded-xl border border-slate-200 transition-colors hover:bg-slate-50"
                style={{ color: B.navy }}>
                See how it works →
              </button>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <HeroIllustration />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Social proof ──────────────────────────────────────────────────────────────
function SocialProof() {
  return (
    <section className="py-10 bg-slate-50 border-y border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-sm font-semibold text-slate-500 text-center sm:text-left">
            Trusted by teachers in <span className="text-slate-900">10+ countries</span>
          </p>
          <div className="flex items-center divide-x divide-slate-200">
            {[
              { v: '2,400+',  l: 'Exams created'      },
              { v: '48,000+', l: 'Students assessed'   },
              { v: '4.9 ★',   l: 'Teacher rating'      },
            ].map((s, i) => (
              <div key={i} className="px-6 first:pl-0 last:pr-0 text-center sm:text-left">
                <p className="text-2xl font-black text-slate-900">{s.v}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Problem ───────────────────────────────────────────────────────────────────
function Problem() {
  const pains = [
    {
      icon: '📋',
      title: 'Spending hours creating exam papers from scratch',
      desc: "Every new exam means hours of formatting, copying questions and fiddling with Word. Time you could spend actually teaching.",
    },
    {
      icon: '📊',
      title: 'No easy way to track how your students are really doing',
      desc: "You hand back marked papers and — that's it. No patterns, no trends, no idea who's quietly falling behind.",
    },
    {
      icon: '😩',
      title: 'Juggling spreadsheets, Word docs and email just to share one exam',
      desc: "Copy results into a sheet. Email the PDF. Chase students who didn't submit. Wait for replies. Repeat every time.",
    },
  ];

  return (
    <section className="py-20 bg-white" id="features">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: B.blue }}>Sound familiar?</p>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900">Teaching is hard enough.</h2>
          <p className="text-lg text-slate-500 mt-3 max-w-xl mx-auto">Your assessment tools shouldn't be making it harder.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          {pains.map((p, i) => (
            <div key={i} className="rounded-2xl p-6 border" style={{ background: '#FFF5F5', borderColor: '#FECACA' }}>
              <div className="text-3xl mb-4">{p.icon}</div>
              <h3 className="font-bold text-slate-900 text-sm leading-snug mb-2">"{p.title}"</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Solution ──────────────────────────────────────────────────────────────────
function Solution() {
  const features = [
    {
      icon: <SparklesIcon className="w-5 h-5" />,
      title: 'AI Exam Builder',
      desc: 'Generate MCQs and short answers from any topic in seconds. Powered by Claude AI — platform-side, so your students never see the key.',
    },
    {
      icon: <BookOpenIcon className="w-5 h-5" />,
      title: 'Question Bank',
      desc: 'Save your best questions and reuse them across exams. Build a library over time and stop starting from zero.',
    },
    {
      icon: <ChartBarIcon className="w-5 h-5" />,
      title: 'Student Analytics',
      desc: 'See who passed, who struggled, and which questions tripped everyone up. Real insight — not just a column of scores.',
    },
    {
      icon: <PaintBrushIcon className="w-5 h-5" />,
      title: 'Your Branded Space',
      desc: 'Students see your name, your colours, your welcome message. It feels like yours — because it is.',
    },
  ];

  return (
    <section className="py-20" style={{ background: B.light }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: B.blue }}>GradiSpace changes that</p>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900">Everything you need.</h2>
          <p className="text-lg text-slate-500 mt-3 max-w-xl mx-auto">One platform that handles the whole assessment cycle.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          {features.map((f, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: B.light, color: B.blue }}>
                {f.icon}
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      icon: <UserPlusIcon className="w-6 h-6" />,
      title: 'Create your account',
      desc: 'Sign up free in 30 seconds. No credit card. No commitment. Just your email and a password.',
      colour: B.blue,
    },
    {
      icon: <PencilSquareIcon className="w-6 h-6" />,
      title: 'Build your first exam',
      desc: 'Type your questions, use AI to generate them, or pull from your question bank. Set a time limit and you\'re done.',
      colour: B.navy,
    },
    {
      icon: <ShareIcon className="w-6 h-6" />,
      title: 'Share the link',
      desc: 'One link. Students tap it, enter their name, and start. Results appear in your dashboard the moment they submit.',
      colour: '#7C3AED',
    },
  ];

  return (
    <section className="py-20 bg-white" id="how-it-works">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: B.blue }}>Simple by design</p>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900">Up and running in 3 steps.</h2>
          <p className="text-lg text-slate-500 mt-3">Most teachers send their first exam within 15 minutes of signing up.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-10">
          {steps.map((s, i) => (
            <div key={i} className="text-center">
              <div className="relative inline-flex mb-5">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg"
                  style={{ background: s.colour }}>
                  {s.icon}
                </div>
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border-2 text-xs font-black flex items-center justify-center shadow-sm"
                  style={{ borderColor: s.colour, color: s.colour }}>
                  {i + 1}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">{s.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link to="/signup"
            className="inline-flex items-center gap-2 text-sm font-bold text-white px-6 py-3 rounded-xl transition-opacity hover:opacity-90"
            style={{ backgroundColor: B.blue }}>
            Get started free →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'free', name: 'Free', monthly: 0, annual: 0,
    tagline: 'Get started at no cost',
    cta: 'Start for free', ctaTo: '/signup',
    features: ['3 exams', '50 questions in bank', '10 AI generations / month', 'Open exams only'],
    excluded: ['Analytics & reports', 'Custom branding', 'Classrooms & rosters'],
  },
  {
    id: 'pro', name: 'Pro', monthly: 12, annual: 9,
    tagline: 'For individual teachers',
    cta: 'Start Pro free', ctaTo: '/signup',
    highlight: true,
    features: [
      'Unlimited exams', 'Unlimited question bank', '200 AI generations / month',
      'Open & closed exams', 'Analytics & reports', 'Custom branding',
      'Classrooms & rosters', 'PDF reports + XLSX export', 'Priority email support',
    ],
  },
  {
    id: 'school', name: 'School', monthly: 35, annual: 28,
    tagline: 'For departments & schools',
    cta: 'Contact us', ctaHref: 'mailto:hello@gradispace.com',
    features: [
      'Everything in Pro', 'Unlimited AI generations', 'School-wide analytics',
      'Bulk student import', 'Multiple teachers (soon)', 'Dedicated onboarding', 'Priority support & SLA',
    ],
  },
];

function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className="py-20 bg-slate-50" id="pricing">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        <div className="text-center mb-10">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: B.blue }}>Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900">Simple, honest pricing.</h2>
          <p className="text-lg text-slate-500 mt-3">Start free. Upgrade when you're ready.</p>

          {/* Toggle */}
          <div className="inline-flex items-center mt-6 bg-white rounded-full p-1 border border-slate-200 shadow-sm">
            <button onClick={() => setAnnual(false)}
              className={`text-sm font-semibold px-5 py-1.5 rounded-full transition-all ${!annual ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}>
              Monthly
            </button>
            <button onClick={() => setAnnual(true)}
              className={`flex items-center gap-2 text-sm font-semibold px-5 py-1.5 rounded-full transition-all ${annual ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}>
              Annual
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Save 25%</span>
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-5 items-start">
          {PLANS.map(plan => {
            const price = annual ? plan.annual : plan.monthly;
            return (
              <div key={plan.id}
                className={`bg-white rounded-2xl p-6 flex flex-col border-2 ${plan.highlight ? 'shadow-2xl -mt-3' : 'shadow-sm border-slate-200'}`}
                style={plan.highlight ? { borderColor: B.blue } : {}}>

                {plan.highlight && (
                  <div className="text-center mb-4">
                    <span className="text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full text-white"
                      style={{ backgroundColor: B.blue }}>Most Popular</span>
                  </div>
                )}

                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">{plan.name}</p>
                <div className="mb-1 flex items-end gap-1">
                  {price === 0
                    ? <span className="text-4xl font-black text-slate-900">Free</span>
                    : <>
                        <span className="text-4xl font-black text-slate-900">${price}</span>
                        <span className="text-slate-400 text-sm mb-1.5"> / mo</span>
                      </>}
                </div>
                {annual && price > 0 && (
                  <p className="text-xs text-slate-400 -mt-0.5 mb-1">billed annually</p>
                )}
                <p className="text-sm text-slate-500 mb-5 leading-snug">{plan.tagline}</p>

                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckIcon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: B.blue }} />
                      <span className="text-slate-700">{f}</span>
                    </li>
                  ))}
                  {plan.excluded?.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm opacity-40">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                      <span className="text-slate-500">{f}</span>
                    </li>
                  ))}
                </ul>

                {plan.ctaHref
                  ? <a href={plan.ctaHref}
                      className="block text-center text-sm font-bold py-3 rounded-xl border-2 transition-colors hover:bg-slate-50"
                      style={{ borderColor: B.blue, color: B.blue }}>
                      {plan.cta}
                    </a>
                  : plan.highlight
                    ? <Link to={plan.ctaTo}
                        className="block text-center text-sm font-bold py-3 rounded-xl text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: B.blue }}>
                        {plan.cta}
                      </Link>
                    : <Link to={plan.ctaTo}
                        className="block text-center text-sm font-bold py-3 rounded-xl border-2 border-slate-300 text-slate-700 transition-colors hover:bg-slate-50">
                        {plan.cta}
                      </Link>
                }
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ──────────────────────────────────────────────────────────────
function Testimonials() {
  const quotes = [
    {
      text: "I used to spend my Sunday evenings making exam papers. Now I do it in 10 minutes during lunch. GradiSpace has genuinely changed how I work.",
      name: 'Mrs. Samanthi Perera',
      role: 'Science Teacher, Colombo',
      init: 'SP',
    },
    {
      text: "The analytics showed me that my whole class was struggling with the same concept. I would never have caught that from paper exams. Now I know exactly where to reteach.",
      name: 'Mr. Rajan Kumar',
      role: 'Mathematics Teacher, Kandy',
      init: 'RK',
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: B.blue }}>What teachers say</p>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900">Real teachers. Real results.</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {quotes.map((q, i) => (
            <div key={i} className="rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
              style={{ background: i === 0 ? B.light : 'white' }}>
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, j) => (
                  <svg key={j} className="w-4 h-4" viewBox="0 0 20 20" fill="#FACC15">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                ))}
              </div>
              <p className="text-slate-700 text-sm leading-relaxed mb-5">"{q.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: B.blue }}>{q.init}</div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{q.name}</p>
                  <p className="text-xs text-slate-400">{q.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Final CTA ─────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="py-24" style={{ background: `linear-gradient(135deg, ${B.blue} 0%, ${B.navy} 100%)` }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
          Ready to give your students the<br className="hidden sm:block" /> assessment they deserve?
        </h2>
        <p className="text-lg mb-8" style={{ color: '#A5B4FC' }}>
          Free forever — no credit card, no commitment. Join in 30 seconds.
        </p>
        <Link to="/signup"
          className="inline-flex items-center gap-2 text-base font-bold px-8 py-4 rounded-xl bg-white transition-opacity hover:opacity-90 shadow-2xl"
          style={{ color: B.blue }}>
          Create your free account →
        </Link>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-slate-900 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center">
            <span className="text-base font-black text-white">Gradi</span>
            <span className="text-base font-black" style={{ color: '#818CF8' }}>Space</span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {[
              { label: 'Features',       action: () => go('features') },
              { label: 'Pricing',        action: () => go('pricing') },
              { label: 'Privacy Policy', href: '#' },
              { label: 'Terms',          href: '#' },
              { label: 'Contact',        href: 'mailto:hello@gradispace.com' },
            ].map((item, i) =>
              item.href
                ? <a key={i} href={item.href} className="text-sm text-slate-400 hover:text-white transition-colors">{item.label}</a>
                : <button key={i} onClick={item.action} className="text-sm text-slate-400 hover:text-white transition-colors">{item.label}</button>
            )}
          </div>
          <p className="text-sm text-slate-500">© 2026 GradiSpace</p>
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Landing() {
  return (
    <div className="font-sans bg-white">
      <Navbar />
      <main>
        <Hero />
        <SocialProof />
        <Problem />
        <Solution />
        <HowItWorks />
        <Pricing />
        <Testimonials />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
