const TOKEN_KEY = 'relay_partner_token';

export function getPartnerToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setPartnerToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearPartnerToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function partnerFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = getPartnerToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...init, headers });

  if (res.status === 401) {
    clearPartnerToken();
    window.location.href = '/portal/signup';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
