import { UserRole } from './constants';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  backendRole: string;
  firstLogin: boolean;
};

type SessionPayload = {
  role: UserRole;
  user: SessionUser;
};

type LoginClient = 'web' | 'mobile' | 'kiosk';

type ErrorBody = {
  message?: string;
  errors?: Array<{ message?: string }>;
};

type AuthUserBody = {
  id: string;
  name: string;
  email: string;
  role: string;
  first_login?: boolean;
};

type AuthBody = {
  user: AuthUserBody;
  access_token: string;
};

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let loginInFlight: Promise<SessionPayload> | null = null;

const SESSION_KEY = 'gg_session';
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api/v1';

const mapBackendRoleToUserRole = (backendRole: string): UserRole | null => {
  if (backendRole === 'ADMIN') return 'admin';
  if (backendRole === 'WARDEN') return 'warden';
  if (backendRole === 'STUDENT') return 'student';
  return null;
};

const mapUserRoleToClient = (_role: UserRole): LoginClient => 'web';

const buildApiUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return `${API_BASE}${path}`;
  return `${API_BASE}/${path}`;
};

const parseResponseBody = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const parseErrorBody = (value: unknown): ErrorBody | null => {
  if (!isRecord(value)) return null;
  return value as ErrorBody;
};

const parseAuthBody = (value: unknown): AuthBody | null => {
  if (!isRecord(value)) return null;

  const userValue = value.user;
  const tokenValue = value.access_token;
  if (!isRecord(userValue) || typeof tokenValue !== 'string') return null;

  if (
    typeof userValue.id !== 'string' ||
    typeof userValue.name !== 'string' ||
    typeof userValue.email !== 'string' ||
    typeof userValue.role !== 'string'
  ) {
    return null;
  }

  if (userValue.first_login !== undefined && typeof userValue.first_login !== 'boolean') {
    return null;
  }

  return {
    user: {
      id: userValue.id,
      name: userValue.name,
      email: userValue.email,
      role: userValue.role,
    },
    access_token: tokenValue,
  };
};

const toErrorMessage = (body: unknown, fallback: string) => {
  const parsed = parseErrorBody(body);
  if (parsed?.message && typeof parsed.message === 'string') return parsed.message;
  if (Array.isArray(parsed?.errors) && parsed.errors.length > 0) {
    return parsed.errors[0]?.message || fallback;
  }
  return fallback;
};

const persistSession = (payload: SessionPayload) => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
};

const clearPersistedSession = () => {
  sessionStorage.removeItem(SESSION_KEY);
};

const normalizeAuthPayload = (body: unknown): SessionPayload | null => {
  const parsedBody = parseAuthBody(body);
  if (!parsedBody) {
    return null;
  }

  const role = mapBackendRoleToUserRole(parsedBody.user.role);
  if (!role) {
    return null;
  }

  const payload: SessionPayload = {
    role,
    user: {
      id: parsedBody.user.id,
      name: parsedBody.user.name,
      email: parsedBody.user.email,
      backendRole: parsedBody.user.role,
      firstLogin: Boolean(parsedBody.user.first_login),
    },
  };

  accessToken = parsedBody.access_token;
  persistSession(payload);
  return payload;
};

const doRefresh = async (): Promise<boolean> => {
  const response = await fetch(buildApiUrl('/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    accessToken = null;
    clearPersistedSession();
    return false;
  }

  const body = await parseResponseBody(response);
  return normalizeAuthPayload(body) !== null;
};

export async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function authenticatedFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  headers.set('X-Request-Id', requestId);

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers,
    credentials: 'include',
  });

  // Retry once only for authentication expiration; do not retry on 403 authorization failures.
  if (response.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return authenticatedFetch(path, init, false);
    }
  }

  return response;
}

export function getSession() {
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as SessionPayload;
      return { role: parsed.role as UserRole, user: parsed.user as SessionUser | null };
    } catch {
      clearPersistedSession();
    }
  }
  return { role: null, user: null };
}

export function setSession(role: UserRole, user: SessionUser) {
  persistSession({ role, user });
}

export function clearSession() {
  accessToken = null;
  clearPersistedSession();
}

export function getAccessToken() {
  return accessToken;
}

export async function bootstrapSession() {
  const existing = getSession();
  if (existing.role && existing.user && accessToken) {
    return existing;
  }

  await refreshSession();
  return getSession();
}

export async function loginWithCredentials(role: UserRole, email: string, password: string) {
  if (loginInFlight) {
    return loginInFlight;
  }

  loginInFlight = (async () => {
    const response = await fetch(buildApiUrl('/auth/login'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id':
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
      },
      body: JSON.stringify({
        email,
        password,
        client: mapUserRoleToClient(role),
      }),
    });

    const body = await parseResponseBody(response);

    if (!response.ok) {
      throw new Error(toErrorMessage(body, 'Login failed'));
    }

    const payload = normalizeAuthPayload(body);
    if (!payload) {
      throw new Error('Unexpected login response');
    }

    return payload;
  })();

  try {
    return await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}

export async function signupAdmin(fullName: string, email: string, password: string) {
  const response = await fetch(buildApiUrl('/auth/admin/signup'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id':
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
    },
    body: JSON.stringify({
      full_name: fullName,
      email,
      password,
    }),
  });

  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(toErrorMessage(body, 'Admin signup failed'));
  }

  const payload = normalizeAuthPayload(body);
  if (!payload) {
    throw new Error('Unexpected signup response');
  }

  return payload;
}

export function getHomePathForRole(role: UserRole) {
  if (role === 'student') return '/student';
  return '/admin';
}

export function shouldForcePasswordChange(user: SessionUser | null) {
  return Boolean(user?.firstLogin);
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const response = await authenticatedFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });

  await parseJsonOrThrow<{ message: string }>(response, 'Unable to change password');

  const currentSession = getSession();
  if (currentSession.role && currentSession.user) {
    setSession(currentSession.role, {
      ...currentSession.user,
      firstLogin: false,
    });
  }
}

export async function logoutSession() {
  try {
    await fetch(buildApiUrl('/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } finally {
    clearSession();
  }
}

export async function parseJsonOrThrow<T>(response: Response, fallbackError: string): Promise<T> {
  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(toErrorMessage(body, fallbackError));
  }

  return body as T;
}
