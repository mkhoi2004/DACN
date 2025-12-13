// src/api.js
// 👉 FIX cho Vercel + ngrok + backend local
// 👉 Giữ nguyên API usage của project

// LẤY BASE URL TỪ ENV (Vercel / Vite)
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const WS_URL = API_BASE
  ? API_BASE.replace(/^http/, 'ws')
  : 'ws://localhost:3000';

// ===== USER / TOKEN =====
export function getStoredUser() {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getToken() {
  return localStorage.getItem('token') || '';
}

// ===== CORE REQUEST =====
async function request(path, options = {}) {
  if (!API_BASE) {
    throw new Error('VITE_API_BASE_URL is not set');
  }

  const headers = {
    'Content-Type': 'application/json',

    // ✅ BẮT BUỘC KHI GỌI QUA NGROK (nếu không sẽ Failed to fetch)
    'ngrok-skip-browser-warning': 'true',

    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const res = await fetch(API_BASE + path, {
    ...options,
    headers,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    // backend không trả json
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

// ===== EXPORT API (GIỮ NGUYÊN CÁCH DÙNG) =====
export const api = {
  get: (path) => request(path),

  post: (path, body) =>
    request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  put: (path, body) =>
    request(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: (path, body) =>
    request(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: (path) =>
    request(path, {
      method: 'DELETE',
    }),
};
