import { NextRequest } from 'next/server';
import { supabase } from './supabase';

export interface AuthAccount {
  id: string;
  username: string;
  displayName: string;
}

/**
 * Tạo token phiên đăng nhập (base64url encoded payload có hạn 30 ngày)
 */
export function generateAuthToken(account: AuthAccount): string {
  const payload = {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 ngày
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/**
 * Giải mã token và kiểm tra tính hợp lệ
 */
export function parseAuthToken(token: string | null | undefined): AuthAccount | null {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const data = JSON.parse(raw);
    if (!data.id || !data.username) return null;
    if (data.exp && Date.now() > data.exp) return null;
    return {
      id: data.id,
      username: data.username,
      displayName: data.displayName || data.username,
    };
  } catch {
    return null;
  }
}

/**
 * Kiểm tra mã PIN (backward compatibility)
 */
export function verifyPin(pin: string | null | undefined): boolean {
  if (!pin) return false;
  return pin.trim() === '250504';
}

/**
 * Lấy thông tin tài khoản đang gọi API từ Request Headers
 */
export function getAccountFromRequest(request: NextRequest): AuthAccount | null {
  // 1. Kiểm tra header 'x-account-token'
  const tokenHeader = request.headers.get('x-account-token');
  if (tokenHeader) {
    const acc = parseAuthToken(tokenHeader);
    if (acc) return acc;
  }

  // 2. Kiểm tra header 'Authorization: Bearer <token>'
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const acc = parseAuthToken(token);
    if (acc) return acc;
  }

  // 3. Fallback header 'x-account-id' (hỗ trợ gọi nội bộ)
  const accId = request.headers.get('x-account-id');
  if (accId) {
    return { id: accId, username: accId, displayName: accId };
  }

  // 4. Query param ?account_id=
  try {
    const { searchParams } = new URL(request.url);
    const queryAcc = searchParams.get('account_id');
    if (queryAcc) {
      return { id: queryAcc, username: queryAcc, displayName: queryAcc };
    }
  } catch {}

  return null;
}
