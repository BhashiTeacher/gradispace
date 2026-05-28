import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api';
import Spinner from './Spinner';

export function ImageUploadButton({ value, onChange, uploadType = 'question', label, className }) {
  const { isPro } = useAuth();
  const navigate  = useNavigate();
  const toast     = useToast();
  const inputRef  = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5 MB.', 'error'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { url } = await api.upload(`/upload/image?type=${uploadType}`, fd);
      onChange(url);
    } catch (err) {
      toast(err.message || 'Upload failed.', 'error');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleClick() {
    if (!isPro) { navigate('/billing'); return; }
    inputRef.current?.click();
  }

  return (
    <div className={className}>
      {value ? (
        <div className="relative">
          <img src={value} alt="Preview"
            className="w-full max-h-32 object-contain rounded-lg border border-slate-200 bg-slate-50" />
          <button type="button" onClick={() => onChange('')}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow-sm">
            <XMarkIcon className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button type="button" disabled={uploading} onClick={handleClick}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-lg hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-50">
          {uploading
            ? <><Spinner className="w-3.5 h-3.5" /> Uploading…</>
            : <span>📎 {label || 'Upload Image'}</span>}
        </button>
      )}
      <input ref={inputRef} type="file"
        accept=".jpg,.jpeg,.png,.webp,.gif"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])} />
    </div>
  );
}

export function AudioUploadButton({ value, onChange, className }) {
  const { isPro } = useAuth();
  const navigate  = useNavigate();
  const toast     = useToast();
  const inputRef  = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName]   = useState('');

  async function handleFile(file) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('Audio must be under 20 MB.', 'error'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { url } = await api.upload('/upload/audio', fd);
      onChange(url);
      setFileName(file.name);
    } catch (err) {
      toast(err.message || 'Upload failed.', 'error');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleClick() {
    if (!isPro) { navigate('/billing'); return; }
    inputRef.current?.click();
  }

  function handleRemove() {
    onChange('');
    setFileName('');
  }

  return (
    <div className={className}>
      {value ? (
        <div className="space-y-1.5">
          <audio controls src={value} className="w-full" style={{ height: 36 }} />
          {fileName && <p className="text-[11px] text-slate-400 truncate">{fileName}</p>}
          <button type="button" onClick={handleRemove}
            className="text-xs text-red-400 hover:text-red-500">Remove audio</button>
        </div>
      ) : (
        <button type="button" disabled={uploading} onClick={handleClick}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-lg hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-50">
          {uploading
            ? <><Spinner className="w-3.5 h-3.5" /> Uploading…</>
            : <span>🎵 Upload Audio</span>}
        </button>
      )}
      <input ref={inputRef} type="file"
        accept=".mp3,.wav,.m4a,.ogg"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])} />
    </div>
  );
}
