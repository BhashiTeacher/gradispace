// Central API client — all requests go through here.
// JWT is read from localStorage on every call so it's always fresh.

// Normalise: strip trailing slash + any accidental /api/v1 suffix, then re-add it.
// This makes VITE_API_URL tolerant of both "https://host" and "https://host/api/v1".
const _apiHost = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '').replace(/\/api\/v1$/, '');
const BASE = _apiHost ? `${_apiHost}/api/v1` : '/api/v1';

function getToken() {
  return localStorage.getItem('gs_token');
}

async function request(method, path, body, isFormData = false) {
  const token = getToken();
  const headers = {};

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  // 401 with an active token = session expired → clear and redirect.
  // 401 without a token = credential failure on /auth/login → let json() throw.
  if (res.status === 401 && getToken()) {
    localStorage.removeItem('gs_token');
    window.location.href = '/login';
    return null;
  }

  return res;
}

async function json(method, path, body) {
  const res = await request(method, path, body);
  if (!res) return null;
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.message || 'An unexpected error occurred.');
    err.code    = data?.error;
    err.status  = res.status;
    err.data    = data;
    throw err;
  }
  return data;
}

// Download a file from an authenticated endpoint.
async function download(path, defaultFilename = 'download') {
  const res = await request('GET', path);
  if (!res || !res.ok) {
    const data = await res?.json().catch(() => ({}));
    throw new Error(data?.message || 'Download failed.');
  }
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] || defaultFilename;
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Upload a file (FormData). Returns parsed JSON.
async function upload(path, formData) {
  const res = await request('POST', path, formData, true);
  if (!res) return null;
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.message || 'Upload failed.');
    err.code   = data?.error;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get:      (path)        => json('GET',    path),
  post:     (path, body)  => json('POST',   path, body),
  put:      (path, body)  => json('PUT',    path, body),
  patch:    (path, body)  => json('PATCH',  path, body),
  del:      (path)        => json('DELETE', path),
  upload:   (path, fd)    => upload(path, fd),
  download: (path, name)  => download(path, name),

  // Auth helpers
  setToken: (token) => localStorage.setItem('gs_token', token),
  clearToken: ()    => localStorage.removeItem('gs_token'),
  hasToken: ()      => Boolean(localStorage.getItem('gs_token')),
};
