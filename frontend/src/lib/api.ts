import { RadarConfig, RadarPost, UserAccount } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function getStoredToken(): string {
  return localStorage.getItem('fbradar_token') || '';
}

export function getStoredUser(): UserAccount | null {
  const raw = localStorage.getItem('fbradar_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredSession(token: string, user: UserAccount): void {
  localStorage.setItem('fbradar_token', token);
  localStorage.setItem('fbradar_user', JSON.stringify(user));
}

export function clearStoredSession(): void {
  localStorage.removeItem('fbradar_token');
  localStorage.removeItem('fbradar_user');
}

export function isLoggedIn(): boolean {
  return !!getStoredToken();
}

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  const user = getStoredUser();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}`, 'x-account-token': token } : {}),
    ...(user ? { 'x-account-id': user.id } : {}),
  };
}

/**
 * Xử lý an toàn dữ liệu trả về từ server, chống lỗi parse HTML
 */
async function parseResponse<T = any>(res: Response): Promise<{ success: boolean; data?: T; error?: string; [key: string]: any }> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return {
      success: false,
      error: `Máy chủ phản hồi mã ${res.status} (${res.statusText || 'Lỗi dịch vụ'})`,
    };
  }
  try {
    const json = await res.json();
    return json;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Định dạng phản hồi không hợp lệ',
    };
  }
}

export async function login(username: string, password: string): Promise<{ success: boolean; account?: UserAccount; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await parseResponse(res);
    if (data.success && data.token && data.account) {
      setStoredSession(data.token, data.account);
      return { success: true, account: data.account };
    }
    return { success: false, error: data.error || 'Đăng nhập không thành công' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Lỗi mạng khi kết nối đăng nhập' };
  }
}

export async function fetchConfig(): Promise<RadarConfig | null> {
  try {
    const res = await fetch(`${API_BASE}/config`, {
      headers: getAuthHeaders(),
    });
    const json = await parseResponse<RadarConfig>(res);
    if (json.success && json.data) {
      return json.data;
    }
    return null;
  } catch (err) {
    console.error('Fetch config error:', err);
    return null;
  }
}

export async function updateConfig(updates: Partial<RadarConfig>): Promise<{ success: boolean; data?: RadarConfig; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    const json = await parseResponse<RadarConfig>(res);
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Cập nhật thất bại' };
    }
    return { success: true, data: json.data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Lỗi mạng khi cập nhật config' };
  }
}

export async function fetchPosts(params?: {
  limit?: number;
  offset?: number;
  keyword?: string;
  group?: string;
  search?: string;
}): Promise<{ total: number; data: RadarPost[] }> {
  try {
    const user = getStoredUser();
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.group) query.set('group', params.group);
    if (params?.search) query.set('search', params.search);
    if (user?.id) query.set('account_id', user.id);

    const res = await fetch(`${API_BASE}/posts?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    const json = await parseResponse<RadarPost[]>(res);
    if (json.success) {
      return { total: json.total || 0, data: json.data || [] };
    }
    return { total: 0, data: [] };
  } catch (err) {
    console.error('Fetch posts error:', err);
    return { total: 0, data: [] };
  }
}

export async function deletePost(id?: string, deleteAll?: boolean): Promise<boolean> {
  try {
    const query = new URLSearchParams();
    if (deleteAll) query.set('all', 'true');
    else if (id) query.set('id', id);

    const res = await fetch(`${API_BASE}/posts?${query.toString()}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const json = await parseResponse(res);
    return Boolean(json.success);
  } catch (err) {
    console.error('Delete post error:', err);
    return false;
  }
}
