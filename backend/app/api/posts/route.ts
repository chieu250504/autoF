import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { checkRequestAuth } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const limitParam = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.min(Math.max(limitParam, 1), 200);

    const offsetParam = parseInt(searchParams.get('offset') || '0', 10);
    const offset = Math.max(offsetParam, 0);

    const keyword = searchParams.get('keyword');
    const group = searchParams.get('group');
    const search = searchParams.get('search');

    let query = supabase
      .from('fbradar_posts')
      .select('*', { count: 'exact' })
      .order('post_timestamp', { ascending: false, nullsFirst: false })
      .order('detected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (keyword && keyword.trim() !== '') {
      query = query.ilike('matched_keyword', `%${keyword.trim()}%`);
    }

    if (group && group.trim() !== '') {
      query = query.ilike('group_title', `%${group.trim()}%`);
    }

    if (search && search.trim() !== '') {
      query = query.ilike('post_text', `%${search.trim()}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      return errorResponse(`Lỗi truy vấn bài viết: ${error.message}`, 500);
    }

    return jsonResponse({
      success: true,
      total: count || 0,
      limit,
      offset,
      data: data || [],
    });
  } catch (err: any) {
    return errorResponse(err?.message || 'Lỗi server khi lấy danh sách bài viết', 500);
  }
}

export async function DELETE(request: NextRequest) {
  // Yêu cầu xác thực mã PIN để xóa bài viết
  if (!checkRequestAuth(request)) {
    return errorResponse('Không có quyền xóa bài viết. Vui lòng cung cấp mã PIN hợp lệ.', 401);
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const deleteAll = searchParams.get('all') === 'true';

    if (deleteAll) {
      const { error } = await supabase
        .from('fbradar_posts')
        .delete()
        .neq('id', '___non_existent___'); // match all

      if (error) {
        return errorResponse(`Lỗi xóa tất cả bài viết: ${error.message}`, 500);
      }

      return jsonResponse({
        success: true,
        message: 'Đã xóa toàn bộ bài viết thành công',
      });
    }

    if (!id) {
      return errorResponse('Vui lòng cung cấp id bài viết cần xóa hoặc tham số all=true', 400);
    }

    const { error } = await supabase
      .from('fbradar_posts')
      .delete()
      .eq('id', id);

    if (error) {
      return errorResponse(`Lỗi xóa bài viết: ${error.message}`, 500);
    }

    return jsonResponse({
      success: true,
      message: `Đã xóa bài viết ${id}`,
    });
  } catch (err: any) {
    return errorResponse(err?.message || 'Lỗi server khi xóa bài viết', 500);
  }
}

