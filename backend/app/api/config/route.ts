import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { checkRequestAuth } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('fbradar_config')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error) {
      return errorResponse(`Lỗi truy vấn config: ${error.message}`, 500);
    }

    if (!data) {
      // Nếu chưa có bản ghi default, trả về default config rỗng
      return jsonResponse({
        success: true,
        data: {
          id: 'default',
          enabled: false,
          keywords: [],
          groups: [],
          reload_minutes: 10,
          jitter_percent: 20,
          scroll_speed: 'medium',
          max_scroll_steps: 10,
          runner_status: 'stopped',
        },
      });
    }

    return jsonResponse({
      success: true,
      data,
    });
  } catch (err: any) {
    return errorResponse(err?.message || 'Lỗi server khi lấy cấu hình', 500);
  }
}

export async function PATCH(request: NextRequest) {
  // Yêu cầu xác thực mã PIN để sửa đổi cấu hình
  if (!checkRequestAuth(request)) {
    return errorResponse('Không có quyền thay đổi cấu hình. Vui lòng cung cấp mã PIN hợp lệ.', 401);
  }

  try {
    const updates = await request.json().catch(() => ({}));

    // Lọc các trường được phép cập nhật
    const allowedFields = [
      'enabled',
      'keywords',
      'groups',
      'reload_minutes',
      'jitter_percent',
      'scroll_speed',
      'max_scroll_steps',
      'runner_status',
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
      .from('fbradar_config')
      .update(payload)
      .eq('id', 'default')
      .select()
      .maybeSingle();

    if (error) {
      return errorResponse(`Lỗi cập nhật config: ${error.message}`, 500);
    }

    return jsonResponse({
      success: true,
      message: 'Cập nhật cấu hình thành công',
      data,
    });
  } catch (err: any) {
    return errorResponse(err?.message || 'Lỗi server khi cập nhật cấu hình', 500);
  }
}

export async function POST(request: NextRequest) {
  return PATCH(request);
}

