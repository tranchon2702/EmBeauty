export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api';

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export const getAccessToken = (): string | null => localStorage.getItem('embeauty_token');
export const getRefreshToken = (): string | null => localStorage.getItem('embeauty_refresh');

export const setTokens = (access: string, refresh: string) => {
  localStorage.setItem('embeauty_token', access);
  localStorage.setItem('embeauty_refresh', refresh);
};

export const clearSession = () => {
  localStorage.removeItem('embeauty_token');
  localStorage.removeItem('embeauty_refresh');
  localStorage.removeItem('embeauty_session');
};

export const getSession = () => {
  const raw = localStorage.getItem('embeauty_session');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

export const authHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(getAccessToken() ? { 'Authorization': `Bearer ${getAccessToken()}` } : {}),
});

// ─── Auto-refresh fetch wrapper ───────────────────────────────────────────────
// Automatically retries with a new access token when 401 TOKEN_EXPIRED is received.

const tryRefreshToken = async (): Promise<boolean> => {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_BASE}/employees/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem('embeauty_token', data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

export const authFetch = async (url: string, options?: RequestInit): Promise<Response> => {
  const makeHeaders = () => ({
    ...authHeaders(),
    ...(options?.headers || {}),
  });

  let res = await fetch(url, { ...options, headers: makeHeaders() });

  // If token expired, try to refresh
  if (res.status === 401) {
    try {
      const body = await res.clone().json();
      if (body.code === 'TOKEN_EXPIRED') {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          // Retry original request with new token
          res = await fetch(url, { ...options, headers: makeHeaders() });
        } else {
          // Refresh failed — session expired
          clearSession();
          window.location.href = '/staff';
          throw new Error('Phiên đăng nhập đã hết hạn');
        }
      }
    } catch (e) {
      if ((e as Error).message === 'Phiên đăng nhập đã hết hạn') throw e;
      // If parsing json failed, just return original response
    }
  }

  return res;
};
