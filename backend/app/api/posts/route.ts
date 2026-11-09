import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAccountFromRequest } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/posts
 * Lấy danh sách bài viết thuộc về tài khoản đang đăng nhập
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const account = getAccountFromRequest(request);

    // Lọc theo account: lấy từ token đăng nhập hoặc query param
    const targetAccountId = searchParams.get('account_id') || account?.id || 'user1';
    const viewAll = searchParams.get('all_accounts') === 'true';

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

    // Lọc theo tài khoản: nếu không phải xem toàn bộ, chỉ hiển thị bài có gắn account_id tương ứng
    if (!viewAll && targetAccountId) {
      // Dùng PostgREST cs (contains) cho jsonb column
      query = query.contains('account_ids', [targetAccountId]);
    }

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
      account_id: targetAccountId,
      total: count || 0,
      limit,
      offset,
      data: data || [],
    });
  } catch (err: any) {
    return errorResponse(err?.message || 'Lỗi server khi lấy danh sách bài viết', 500);
  }
}

/**
 * DELETE /api/posts
 * Xóa bài viết
 */
export async function DELETE(request: NextRequest) {
  const account = getAccountFromRequest(request);
  if (!account) {
    return errorResponse('Vui lòng đăng nhập để thực hiện xóa bài viết', 401);
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const deleteAll = searchParams.get('all') === 'true';

    if (deleteAll) {
      // Xóa tất cả bài viết của tài khoản này
      const { error } = await supabase
        .from('fbradar_posts')
        .delete()
        .neq('id', '___non_existent___');

      if (error) {
        return errorResponse(`Lỗi xóa tất cả bài viết: ${error.message}`, 500);
      }

      return jsonResponse({
        success: true,
        message: 'Đã xóa toàn bộ bài viết thành công',
      });
    }

    if (!id) {
      return errorResponse('Vui lòng cung cấp id bài viết cần xóa', 400);
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
