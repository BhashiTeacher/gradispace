// Central API client — used by all teacher dashboard pages
const API = (() => {
  const BASE = '/api/v1';

  function getToken() { return localStorage.getItem('gs_token'); }
  function setToken(t) { localStorage.setItem('gs_token', t); }
  function clearToken() { localStorage.removeItem('gs_token'); }

  async function request(method, path, body, isFormData = false) {
    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const res = await fetch(BASE + path, {
      method,
      headers,
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
    });

    if (res.status === 401) { clearToken(); window.location.href = '/teacher/login.html'; return; }

    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.message || 'Request failed'), { code: data.error, status: res.status });
    return data;
  }

  return {
    getToken, setToken, clearToken,
    get:    (path)        => request('GET',    path),
    post:   (path, body)  => request('POST',   path, body),
    put:    (path, body)  => request('PUT',    path, body),
    del:    (path)        => request('DELETE', path),
    upload: (path, form)  => request('POST',   path, form, true),
  };
})();
