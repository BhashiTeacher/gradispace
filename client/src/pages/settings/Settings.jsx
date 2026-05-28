import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PhotoIcon, UserCircleIcon, TrashIcon, KeyIcon,
  ExclamationTriangleIcon, SparklesIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api';
import Spinner from '../../components/UI/Spinner';
import { ProBadge } from '../../components/UI/ProGate';

// ── Live branding preview ────────────────────────────────────────────────────
function BrandingPreview({ form, teacher }) {
  const colour = /^#[0-9a-fA-F]{6}$/.test(form.brandColour) ? form.brandColour : '#4F46E5';
  const name   = form.portalName || teacher?.name + "'s Portal" || 'Your Portal';

  return (
    <div className="rounded-xl overflow-hidden border-2 border-slate-200 shadow-md bg-slate-100 text-[11px] select-none">
      {/* Label */}
      <div className="px-3 py-1.5 bg-slate-200 text-slate-500 font-medium text-[10px] uppercase tracking-wide">
        Live Preview — Student View
      </div>

      {/* Banner */}
      <div className="h-20 w-full relative overflow-hidden"
        style={{
          background: form.bannerImage
            ? `url(${form.bannerImage}) center/cover no-repeat`
            : `linear-gradient(135deg, ${colour}33 0%, ${colour}66 100%)`,
        }}>
        {!form.bannerImage && (
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <SparklesIcon className="w-8 h-8" style={{ color: colour }} />
          </div>
        )}
      </div>

      {/* Portal header */}
      <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center gap-2.5">
        {form.profilePhoto ? (
          <img src={form.profilePhoto} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 border-2"
            style={{ borderColor: colour }} />
        ) : (
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
            style={{ background: colour }}>
            {teacher?.name?.[0]?.toUpperCase() || 'T'}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{name}</p>
        </div>
      </div>

      {/* Welcome message */}
      {form.welcomeMessage && (
        <div className="px-4 py-2.5 bg-white border-b border-slate-100">
          <p className="text-slate-500 leading-relaxed line-clamp-3">{form.welcomeMessage}</p>
        </div>
      )}

      {/* Sample exam card */}
      <div className="p-3 space-y-2">
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
          <p className="font-semibold text-slate-800 mb-0.5">Grade 10 Science — Sample Exam</p>
          <p className="text-slate-400 mb-2.5">15 questions · 30 minutes</p>
          <div className="space-y-1.5 mb-3">
            <div className="h-6 bg-slate-100 rounded border border-slate-200 px-2 flex items-center text-slate-400">
              {form.locale === 'si' ? 'ඔබගේ නම' : 'Your name'}
            </div>
            <div className="h-6 bg-slate-100 rounded border border-slate-200 px-2 flex items-center text-slate-400">
              {form.locale === 'si' ? 'ශ්‍රේණිය' : 'Class / Grade'}
            </div>
          </div>
          <div className="h-7 rounded-lg flex items-center justify-center font-semibold text-white"
            style={{ background: colour }}>
            {form.locale === 'si' ? 'විභාගය ආරම්භ කරන්න' : 'Start Exam'}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-400 text-[9px] pt-1">
          {form.footerMessage
            ? <span className="block mb-0.5 truncate">{form.footerMessage}</span>
            : null}
          Powered by Gradispace
        </p>
      </div>
    </div>
  );
}

// ── Image upload field ────────────────────────────────────────────────────────
function ImageUploadField({ label, value, endpoint, accept, hint, isPro, onUploaded, navigate }) {
  const toast = useToast();
  const inputRef  = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file) {
    if (!file) return;
    if (!isPro) { navigate('/billing'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { url } = await api.upload(endpoint, fd);
      onUploaded(url);
      toast('Image uploaded!', 'success');
    } catch (err) {
      toast(err.message || 'Upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="label flex items-center gap-1">
        {label} <ProBadge />
      </label>
      <div
        className="relative border-2 border-dashed border-slate-300 rounded-xl overflow-hidden cursor-pointer hover:border-primary-400 transition-colors"
        style={{ minHeight: 72 }}
        onClick={() => isPro && inputRef.current?.click()}>
        {value ? (
          <img src={value} alt={label} className="w-full h-24 object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center py-5 text-slate-400">
            <PhotoIcon className="w-7 h-7 mb-1" />
            <span className="text-xs">{isPro ? 'Click to upload' : 'Requires Pro'}</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <Spinner className="w-6 h-6 text-primary-500" />
          </div>
        )}
        <input ref={inputRef} type="file" accept={accept} className="hidden"
          onChange={e => handleFile(e.target.files?.[0])} />
      </div>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

// ── Change password form ──────────────────────────────────────────────────────
function ChangePasswordForm() {
  const toast = useToast();
  const [current, setCurrent]   = useState('');
  const [next, setNext]         = useState('');
  const [confirm, setConfirm]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState({});

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!current) errs.current = 'Current password is required.';
    if (next.length < 8) errs.next = 'New password must be at least 8 characters.';
    if (next !== confirm) errs.confirm = 'Passwords do not match.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await api.put('/auth/password', { currentPassword: current, newPassword: next });
      toast('Password updated.', 'success');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      if (err.code === 'wrong_password') setErrors({ current: 'Current password is incorrect.' });
      else toast(err.message || 'Failed to update password.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="label">Current Password</label>
        <input type="password" className={`input ${errors.current ? 'border-red-400' : ''}`}
          value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" />
        {errors.current && <p className="text-xs text-red-500 mt-1">{errors.current}</p>}
      </div>
      <div>
        <label className="label">New Password</label>
        <input type="password" className={`input ${errors.next ? 'border-red-400' : ''}`}
          value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" />
        {errors.next && <p className="text-xs text-red-500 mt-1">{errors.next}</p>}
      </div>
      <div>
        <label className="label">Confirm New Password</label>
        <input type="password" className={`input ${errors.confirm ? 'border-red-400' : ''}`}
          value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
        {errors.confirm && <p className="text-xs text-red-500 mt-1">{errors.confirm}</p>}
      </div>
      <button type="submit" disabled={saving} className="btn-secondary btn-sm">
        {saving && <Spinner className="w-4 h-4 mr-1.5" />}
        <KeyIcon className="w-4 h-4 mr-1.5" /> Update Password
      </button>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Settings() {
  const { teacher, isPro, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState({
    portalName: '', bannerImage: '', profilePhoto: '',
    brandColour: '#4F46E5', welcomeMessage: '', footerMessage: '',
    examDisplayMode: 'paginated', locale: 'en',
  });

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting]           = useState(false);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.get('/settings')
      .then(({ settings: s }) => {
        setForm({
          portalName:      s.portalName      || '',
          bannerImage:     s.bannerImage     || '',
          profilePhoto:    s.profilePhoto    || '',
          brandColour:     s.brandColour     || '#4F46E5',
          welcomeMessage:  s.welcomeMessage  || '',
          footerMessage:   s.footerMessage   || '',
          examDisplayMode: s.examDisplayMode || 'paginated',
          locale:          s.locale          || 'en',
        });
      })
      .catch(() => toast('Failed to load settings.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        portalName:      form.portalName      || null,
        brandColour:     form.brandColour,
        welcomeMessage:  form.welcomeMessage  || null,
        footerMessage:   form.footerMessage   || null,
        examDisplayMode: form.examDisplayMode,
        locale:          form.locale,
      };
      // Only send images if Pro (backend will reject otherwise)
      if (isPro) {
        if (form.bannerImage)  payload.bannerImage  = form.bannerImage;
        if (form.profilePhoto) payload.profilePhoto = form.profilePhoto;
      }
      await api.put('/settings', payload);
      toast('Settings saved!', 'success');
    } catch (err) {
      toast(err.message || 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE') { toast('Type DELETE to confirm.', 'error'); return; }
    setDeleting(true);
    try {
      await api.del('/auth/account', { confirmation: 'DELETE' });
      logout();
      navigate('/login');
    } catch (err) {
      toast(err.message || 'Failed to delete account.', 'error');
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-primary-500" /></div>;
  }

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">Settings</h1>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving && <Spinner className="w-4 h-4 mr-1.5" />}
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* ── Left: Editor ── */}
        <div className="lg:col-span-3 space-y-6">

          {/* Portal Identity */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">
              Portal Identity
            </h2>

            <div>
              <label className="label">Portal Name</label>
              <input className="input" value={form.portalName}
                onChange={e => setF('portalName', e.target.value)}
                placeholder={`${teacher?.name || 'Your'}'s Portal`} />
              <p className="text-xs text-slate-400 mt-1">Shown to students on your exam pages.</p>
            </div>

            <div>
              <label className="label">Brand Colour</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.brandColour}
                  onChange={e => setF('brandColour', e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 p-0.5 flex-shrink-0" />
                <input className="input flex-1" value={form.brandColour}
                  onChange={e => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setF('brandColour', v);
                  }}
                  placeholder="#4F46E5" maxLength={7} />
              </div>
              <p className="text-xs text-slate-400 mt-1">Applied to buttons, accents, and highlights on student pages.</p>
            </div>
          </div>

          {/* Images */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              Images <ProBadge />
            </h2>

            <ImageUploadField
              label="Banner Image"
              value={form.bannerImage}
              endpoint="/upload/image?type=banner"
              accept="image/jpeg,image/png,image/webp"
              hint="Recommended: 1400 × 300 px. Max 5 MB."
              isPro={isPro}
              onUploaded={url => setF('bannerImage', url)}
              navigate={navigate}
            />

            <div className="flex gap-4 items-start">
              <div className="flex-1">
                <ImageUploadField
                  label="Profile Photo"
                  value={form.profilePhoto}
                  endpoint="/upload/image?type=avatar"
                  accept="image/jpeg,image/png,image/webp"
                  hint="Square image. 200 × 200 px cropped."
                  isPro={isPro}
                  onUploaded={url => setF('profilePhoto', url)}
                  navigate={navigate}
                />
              </div>
              {form.profilePhoto && (
                <div className="flex-shrink-0 mt-5">
                  <img src={form.profilePhoto} alt="Profile" className="w-16 h-16 rounded-full object-cover border-2 border-slate-200" />
                </div>
              )}
            </div>

            {!isPro && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                Custom images require a Pro or School plan.
                <button onClick={() => navigate('/billing')} className="ml-auto font-semibold underline underline-offset-2">
                  Upgrade
                </button>
              </div>
            )}
          </div>

          {/* Student experience */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">
              Student Experience
            </h2>

            <div>
              <label className="label">Welcome Message</label>
              <textarea className="input resize-none" rows={3}
                value={form.welcomeMessage}
                onChange={e => setF('welcomeMessage', e.target.value)}
                placeholder="Shown to students before they start an exam. e.g. Good luck! Read each question carefully." />
            </div>

            <div>
              <label className="label">Footer Message</label>
              <textarea className="input resize-none" rows={2}
                value={form.footerMessage}
                onChange={e => setF('footerMessage', e.target.value)}
                placeholder="Shown on the results page. e.g. Thank you for completing this exam." />
            </div>

            <div>
              <label className="label">Exam Display Mode</label>
              <div className="flex gap-3 mt-1">
                {[
                  { val: 'paginated', label: 'Paginated', desc: 'One question at a time' },
                  { val: 'scrollable', label: 'Scrollable', desc: 'All questions on one page' },
                ].map(opt => (
                  <label key={opt.val}
                    className={`flex-1 flex items-start gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors text-sm
                      ${form.examDisplayMode === opt.val ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" name="displayMode" value={opt.val}
                      checked={form.examDisplayMode === opt.val}
                      onChange={() => setF('examDisplayMode', opt.val)}
                      className="mt-0.5 text-primary-600" />
                    <div>
                      <p className="font-medium text-slate-800">{opt.label}</p>
                      <p className="text-xs text-slate-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Student Page Language</label>
              <div className="flex gap-3 mt-1">
                {[
                  { val: 'en', label: 'English',  desc: 'All student UI in English' },
                  { val: 'si', label: 'සිංහල',   desc: 'Student UI in Sinhala' },
                ].map(opt => (
                  <label key={opt.val}
                    className={`flex-1 flex items-start gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors text-sm
                      ${form.locale === opt.val ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" name="locale" value={opt.val}
                      checked={form.locale === opt.val}
                      onChange={() => setF('locale', opt.val)}
                      className="mt-0.5 text-primary-600" />
                    <div>
                      <p className="font-medium text-slate-800">{opt.label}</p>
                      <p className="text-xs text-slate-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Account security */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <KeyIcon className="w-4 h-4" /> Change Password
            </h2>
            <ChangePasswordForm />
          </div>

          {/* Danger zone */}
          <div className="card p-5 border-red-200 space-y-3">
            <h2 className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
              <ExclamationTriangleIcon className="w-4 h-4" /> Danger Zone
            </h2>
            <p className="text-xs text-slate-500">
              Permanently deletes your account, all exams, questions, student submissions, and settings.
              This action cannot be undone.
            </p>
            <div className="flex gap-2 items-center flex-wrap">
              <input className="input flex-1 min-w-[140px] border-red-300 focus:ring-red-400"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder='Type DELETE to confirm' />
              <button onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                className="btn-danger btn-sm flex-shrink-0">
                {deleting ? <Spinner className="w-4 h-4 mr-1.5" /> : <TrashIcon className="w-4 h-4 mr-1.5" />}
                Delete Account
              </button>
            </div>
          </div>

        </div>

        {/* ── Right: Live Preview ── */}
        <div className="lg:col-span-2">
          <div className="sticky top-4">
            <BrandingPreview form={form} teacher={teacher} />
            <p className="text-xs text-slate-400 text-center mt-3">
              Preview updates as you edit. Click <strong>Save Changes</strong> to apply.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
