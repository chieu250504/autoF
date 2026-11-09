import { RadarConfig, RadarPost } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function getStoredPin(): string {
  return sessionStorage.getItem('fbradar_pin') || '';
}

export function setStoredPin(pin: string): void {
  sessionStorage.setItem('fbradar_pin', pin);
}

export function clearStoredPin(): void {
  sessionStorage.removeItem('fbradar_pin');
}

export function hasStoredPin(): boolean {
  return !!sessionStorage.getItem('fbradar_pin');
}

function getAuthHeaders(): HeadersInit {
  const pin = getStoredPin();
  return {
    'Content-Type': 'application/json',
    ...(pin ? { 'x-dashboard-pin': pin } : {}),
  };
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    return Boolean(data.success && data.valid);
  } catch (err) {
    console.error('Verify PIN error:', err);
    return false;
  }
}

export async function fetchConfig(): Promise<RadarConfig | null> {
  try {
    const res = await fetch(`${API_BASE}/config`);
    const json = await res.json();
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
    const json = await res.json();
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
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.group) query.set('group', params.group);
    if (params?.search) query.set('search', params.search);

    const res = await fetch(`${API_BASE}/posts?${query.toString()}`);
    const json = await res.json();
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
    const json = await res.json();
    return Boolean(json.success);
  } catch (err) {
    console.error('Delete post error:', err);
    return false;
  }
}

