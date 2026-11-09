import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAccountFromRequest } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/config
 * Lấy cấu hình của tài khoản đang đăng nhập kèm trạng thái Tab Treo toàn cục
 */
export async function GET(request: NextRequest) {
  try {
    const account = getAccountFromRequest(request);
    const accountId = account ? account.id : 'user1'; // Mặc định user1 nếu chưa truyền token

    // 1. Lấy trạng thái Tab Treo toàn cục (runner_status, heartbeat) từ fbradar_config
    const { data: globalState } = await supabase
      .from('fbradar_config')
      .select('runner_status, current_running_group, last_heartbeat, updated_at')
      .eq('id', 'default')
      .maybeSingle();

    // 2. Lấy cấu hình riêng của tài khoản từ fbradar_account_config
    const { data: accountConfig, error } = await supabase
      .from('fbradar_account_config')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      return errorResponse(`Lỗi truy vấn cấu hình tài khoản: ${error.message}`, 500);
    }

    // Nếu tài khoản mới chưa có cấu hình, tạo bản ghi mặc định
    let configData = accountConfig;
    if (!configData) {
      const defaultData = {
        account_id: accountId,
        enabled: true,
        keywords: ['tuyển dụng', 'báo giá'],
        groups: [],
        reload_minutes: 10,
        jitter_percent: 20,
        scroll_speed: 'medium',
        max_scroll_steps: 10,
        updated_at: new Date().toISOString(),
      };

      const { data: inserted } = await supabase
        .from('fbradar_account_config')
        .insert(defaultData)
        .select()
        .maybeSingle();

      configData = inserted || defaultData;
    }

    return jsonResponse({
      success: true,
      account_id: accountId,
      data: {
        ...configData,
        // Kèm trạng thái Tab Treo chung của toàn hệ thống
        runner_status: globalState?.runner_status || 'Chưa chạy',
        current_running_group: globalState?.current_running_group || null,
        last_heartbeat: globalState?.last_heartbeat || null,
      },
    });
  } catch (err: any) {
    return errorResponse(err?.message || 'Lỗi server khi lấy cấu hình', 500);
  }
}

/**
 * PATCH /api/config
 * Cập nhật cấu hình riêng của tài khoản đang đăng nhập
 */
export async function PATCH(request: NextRequest) {
  const account = getAccountFromRequest(request);
  if (!account) {
    return errorResponse('Vui lòng đăng nhập để thay đổi cấu hình', 401);
  }

  try {
    const updates = await request.json().catch(() => ({}));

    const allowedFields = [
      'enabled',
      'keywords',
      'groups',
      'reload_minutes',
      'jitter_percent',
      'scroll_speed',
      'max_scroll_steps',
    ];

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        payload[field] = updates[field];
      }
    }

    const { data, error } = await supabase
      .from('fbradar_account_config')
      .update(payload)
      .eq('account_id', account.id)
      .select()
      .maybeSingle();

    if (error) {
      return errorResponse(`Lỗi cập nhật cấu hình tài khoản: ${error.message}`, 500);
    }

    return jsonResponse({
      success: true,
      message: 'Cập nhật cấu hình tài khoản thành công',
      data,
    });
  } catch (err: any) {
    return errorResponse(err?.message || 'Lỗi server khi cập nhật cấu hình', 500);
  }
}

export async function POST(request: NextRequest) {
  return PATCH(request);
}
