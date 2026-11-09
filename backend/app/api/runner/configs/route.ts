import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/runner/configs
 * Tổng hợp thông minh cấu hình từ TẤT CẢ các tài khoản đang BẬT quét:
 * - Tránh quét trùng lặp nhóm (nếu 2 tài khoản cùng nhóm, chỉ quét 1 lần luân phiên)
 * - Gộp các từ khóa của các tài khoản vào nhóm tương ứng
 * - Trả về mapping từ khóa -> danh sách tài khoản để phân chia bài viết chính xác
 */
export async function GET() {
  try {
    // 1. Lấy tất cả tài khoản đang BẬT (enabled = true)
    const { data: activeConfigs, error } = await supabase
      .from('fbradar_account_config')
      .select('account_id, enabled, keywords, groups, reload_minutes, max_scroll_steps, scroll_speed, jitter_percent')
      .eq('enabled', true);

    if (error) {
      return errorResponse(`Lỗi truy vấn cấu hình các tài khoản: ${error.message}`, 500);
    }

    if (!activeConfigs || activeConfigs.length === 0) {
      return jsonResponse({
        success: true,
        enabled: false,
        message: 'Tất cả tài khoản hiện đang tắt quét',
        groups: [],
        allKeywords: [],
        keywordAccountMap: {},
        accounts: [],
      });
    }

    // 2. Chuẩn hóa URL nhóm để phát hiện trùng lặp (bỏ www, query, hash, trailing slash)
    const cleanGroupUrl = (raw: string) => {
      try {
        let u = (raw || '').trim();
        if (!u.startsWith('http')) u = 'https://' + u;
        const obj = new URL(u);
        const host = obj.hostname.replace(/^www\./, '');
        return `https://${host}${obj.pathname}`.toLowerCase().replace(/\/+$/, '');
      } catch {
        return (raw || '').trim().toLowerCase().replace(/\/+$/, '');
      }
    };

    // 3. Hợp nhất các nhóm (Group Merging)
    interface MergedGroup {
      canonicalUrl: string;
      rawUrl: string;
      name: string;
      accounts: string[];
      scrollSteps: number;
      reloadMinutes: number;
      keywords: Set<string>;
    }

    const groupMap = new Map<string, MergedGroup>();
    const keywordAccountMap: Record<string, string[]> = {};
    const globalKeywordsSet = new Set<string>();

    for (const acc of activeConfigs) {
      const accId = acc.account_id;
      const accKeywords: string[] = Array.isArray(acc.keywords) ? acc.keywords : [];
      const accGroups: any[] = Array.isArray(acc.groups) ? acc.groups : [];

      // Đăng ký từ khóa toàn cục của tài khoản
      for (const kw of accKeywords) {
        const cleanKw = kw.trim();
        if (!cleanKw) continue;
        globalKeywordsSet.add(cleanKw);

        if (!keywordAccountMap[cleanKw]) {
          keywordAccountMap[cleanKw] = [];
        }
        if (!keywordAccountMap[cleanKw].includes(accId)) {
          keywordAccountMap[cleanKw].push(accId);
        }
      }

      // Đăng ký các nhóm của tài khoản
      for (const g of accGroups) {
        if (!g || g.enabled === false || !g.url) continue;

        const canonical = cleanGroupUrl(g.url);
        const gSteps = parseInt(g.scrollSteps, 10) || parseInt(acc.max_scroll_steps, 10) || 10;
        const gReload = parseFloat(g.reloadMinutes) || parseFloat(acc.reload_minutes) || 10;

        if (!groupMap.has(canonical)) {
          groupMap.set(canonical, {
            canonicalUrl: canonical,
            rawUrl: g.url,
            name: g.name || 'Nhóm Facebook',
            accounts: [accId],
            scrollSteps: gSteps,
            reloadMinutes: gReload,
            keywords: new Set(accKeywords),
          });
        } else {
          // Nhóm đã có tài khoản khác quét -> HỢP NHẤT (Không quét lặp)
          const existing = groupMap.get(canonical)!;
          if (!existing.accounts.includes(accId)) {
            existing.accounts.push(accId);
          }
          // Chọn số bước cuộn lớn hơn để bảo đảm bắt đủ bài
          existing.scrollSteps = Math.max(existing.scrollSteps, gSteps);
          // Chọn thời gian dừng nhỏ hơn (quét thường xuyên hơn) để đáp ứng cả 2
          existing.reloadMinutes = Math.min(existing.reloadMinutes, gReload);
          // Gộp từ khóa
          accKeywords.forEach((kw) => existing.keywords.add(kw));
        }
      }
    }

    // Chuyển groupMap thành danh sách
    const mergedGroups = Array.from(groupMap.values()).map((mg) => ({
      url: mg.rawUrl,
      canonicalUrl: mg.canonicalUrl,
      name: mg.name,
      accounts: mg.accounts,
      scrollSteps: mg.scrollSteps,
      reloadMinutes: mg.reloadMinutes,
      keywords: Array.from(mg.keywords),
    }));

    return jsonResponse({
      success: true,
      enabled: true,
      totalActiveAccounts: activeConfigs.length,
      accounts: activeConfigs.map((a) => a.account_id),
      groups: mergedGroups,
      allKeywords: Array.from(globalKeywordsSet),
      keywordAccountMap,
      updated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return errorResponse(err?.message || 'Lỗi server khi tổng hợp cấu hình quét', 500);
  }
}

