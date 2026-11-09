import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { generateAuthToken } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = (body.username || '').trim().toLowerCase();
    const password = (body.password || '').trim();

    if (!username || !password) {
      return errorResponse('Vui lòng nhập tên đăng nhập và mật khẩu', 400);
    }

    // Tra cứu tài khoản trong cơ sở dữ liệu
    const { data: account, error } = await supabase
      .from('fbradar_accounts')
      .select('id, username, password, display_name')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      return errorResponse(`Lỗi tra cứu tài khoản: ${error.message}`, 500);
    }

    if (!account) {
      return errorResponse('Tài khoản không tồn tại trong hệ thống', 401);
    }

    if (account.password !== password) {
      return errorResponse('Mật khẩu không chính xác. Vui lòng thử lại!', 401);
    }

    const authAccount = {
      id: account.id,
      username: account.username,
      displayName: account.display_name,
    };

    const token = generateAuthToken(authAccount);

    return jsonResponse({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      account: authAccount,
    });
  } catch (err: any) {
    return errorResponse(err?.message || 'Lỗi server khi đăng nhập', 500);
  }
}

