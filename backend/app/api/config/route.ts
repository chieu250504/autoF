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
        reload_minutes: 5,
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

    // Kiểm tra tính hợp lệ dữ liệu nhóm nếu có gửi lên
    if (updates.groups !== undefined) {
      if (!Array.isArray(updates.groups)) {
        return errorResponse('Dữ liệu nhóm không hợp lệ (phải là danh sách)', 400);
      }
      payload.groups = updates.groups;
    }

    // Kiểm tra tính hợp lệ từ khóa nếu có gửi lên
    if (updates.keywords !== undefined) {
      if (!Array.isArray(updates.keywords)) {
        return errorResponse('Dữ liệu từ khóa không hợp lệ (phải là danh sách)', 400);
      }
      payload.keywords = updates.keywords;
    }

    // Các trường cấu hình khác
    for (const field of allowedFields) {
      if (field !== 'groups' && field !== 'keywords' && updates[field] !== undefined) {
        payload[field] = updates[field];
      }
    }

    // BẢO VỆ DỮ LIỆU: Dùng UPDATE theo account_id để không bao giờ ghi đè các cột khác
    const { data: updated, error: updateError } = await supabase
      .from('fbradar_account_config')
      .update(payload)
      .eq('account_id', account.id)
      .select()
      .maybeSingle();

    if (updateError) {
      return errorResponse(`Lỗi cập nhật cấu hình tài khoản: ${updateError.message}`, 500);
    }

    let finalData = updated;
    // Nếu tài khoản mới tinh chưa có bản ghi, mới tạo mới
    if (!finalData) {
      const { data: inserted, error: insertError } = await supabase
        .from('fbradar_account_config')
        .insert({
          account_id: account.id,
          enabled: true,
          keywords: ['tuyển dụng', 'báo giá'],
          groups: [],
          ...payload,
        })
        .select()
        .maybeSingle();

      if (insertError) {
        return errorResponse(`Lỗi khởi tạo cấu hình: ${insertError.message}`, 500);
      }
      finalData = inserted;
    }

    return jsonResponse({
      success: true,
      message: 'Cập nhật cấu hình tài khoản thành công',
      data: finalData,
    });
  } catch (err: any) {
    return errorResponse(err?.message || 'Lỗi server khi cập nhật cấu hình', 500);
  }
}

export async function POST(request: NextRequest) {
  return PATCH(request);
}
