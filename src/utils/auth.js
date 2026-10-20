const TOKEN_KEY = 'examcraft_token';
const USER_KEY = 'examcraft_current_user';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    window.dispatchEvent(new CustomEvent('examcraft-auth-changed'));
  } catch {}
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new CustomEvent('examcraft-auth-changed'));
  } catch {}
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {}
}

export async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    clearToken();
  }

  return response;
}

export async function apiLogin(username, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '登录失败');
  }
  setToken(data.token);
  setStoredUser(data.user);
  return data.user;
}

export async function apiRegister(username, password, roleType = 'teacher', email = '') {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, roleType, email })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '注册失败');
  }
  setToken(data.token);
  setStoredUser(data.user);
  return data.user;
}

export async function apiForgotPassword(identity) {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '申请重置密码失败');
  }
  return data;
}

export async function apiVerifyResetToken(token) {
  const res = await fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '重置链接无效或已过期');
  }
  return data;
}

export async function apiResetPassword(token, newPassword) {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '重置密码失败');
  }
  return data;
}

export async function apiGetCurrentUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await authFetch('/api/auth/me');
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.user) {
      setStoredUser(data.user);
      return data.user;
    }
  } catch {
    return null;
  }
  return null;
}

export async function apiSyncUserData() {
  const res = await authFetch('/api/user/sync');
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '获取用户云端数据失败');
  }
  return data.data;
}

export async function apiSavePaper(paper) {
  const res = await authFetch('/api/user/papers', {
    method: 'POST',
    body: { paper }
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '保存试卷到云端失败');
  }
  return data.paper;
}

export async function apiDeletePaper(paperId) {
  const res = await authFetch(`/api/user/papers/${paperId}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '删除云端试卷失败');
  }
  return true;
}

export async function apiSaveSubmission(submission) {
  const res = await authFetch('/api/user/submissions', {
    method: 'POST',
    body: { submission }
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '同步考试记录到云端失败');
  }
  return data.submission;
}

export async function apiSaveNotebook(notebook) {
  const res = await authFetch('/api/user/notebook', {
    method: 'POST',
    body: { notebook }
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '同步错题本到云端失败');
  }
  return data.notebook;
}

export async function apiSaveSubjects(subjects) {
  const res = await authFetch('/api/user/subjects', {
    method: 'POST',
    body: { subjects }
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '同步学科分类到云端失败');
  }
  return data.subjects;
}

export async function apiMigrateLocalData(localData) {
  const res = await authFetch('/api/user/migrate-local', {
    method: 'POST',
    body: localData
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '本地数据迁移上云失败');
  }
  return data.summary;
}

const GUEST_PROFILE_KEY = 'examcraft_guest_profile';

export function getGuestProfile() {
  try {
    const raw = localStorage.getItem(GUEST_PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    nickname: '考研学神 (游客模式)',
    avatar: 'scholar',
    targetExam: '2026 考研数学 + 408 统考',
    motto: '日拱一卒，功不唐捐，高分上岸！'
  };
}

export function setGuestProfile(profile) {
  try {
    const current = getGuestProfile();
    const updated = { ...current, ...profile };
    localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('examcraft-profile-updated'));
    return updated;
  } catch {
    return profile;
  }
}

export async function apiUpdateProfile(profileData) {
  const res = await authFetch('/api/auth/profile', {
    method: 'POST',
    body: profileData
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '保存个人信息失败');
  }
  setStoredUser(data.user);
  window.dispatchEvent(new CustomEvent('examcraft-profile-updated'));
  return data.user;
}

export async function apiGetExamSessions() {
  const res = await authFetch('/api/user/exam-sessions');
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '获取考试会话失败');
  }
  return data.sessions || {};
}

export async function apiGetExamSession(paperId) {
  if (!paperId) return null;
  const res = await authFetch(`/api/user/exam-session/${paperId}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '获取考试进度失败');
  }
  return data.session || null;
}

export async function apiSaveExamSession(session) {
  if (!session || !session.paperId) return null;
  const res = await authFetch('/api/user/exam-session', {
    method: 'POST',
    body: { session }
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '同步考试进度失败');
  }
  return data.session;
}

export async function apiDeleteExamSession(paperId) {
  if (!paperId) return true;
  const res = await authFetch(`/api/user/exam-session/${paperId}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '清除考试进度失败');
  }
  return true;
}
