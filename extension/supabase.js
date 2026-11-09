/**
 * Supabase Client Helper for FB Group Keyword Radar
 * Direct REST API client using publishable key (No external SDK needed)
 */

const SUPABASE_CONFIG = {
  url: "https://mugaogyqtqgwhrfkfdgm.supabase.co",
  key: "sb_publishable_bqawiRtLOW9NFC3eJrWM-g_u6VeoKzL"
};

const SupabaseClient = {
  getHeaders() {
    return {
      "apikey": SUPABASE_CONFIG.key,
      "Authorization": `Bearer ${SUPABASE_CONFIG.key}`,
      "Content-Type": "application/json"
    };
  },

  /**
   * Lưu bài viết mới phát hiện vào bảng fbradar_posts trên Supabase kèm phân loại tài khoản
   */
  async savePost(post) {
    if (!post || !post.id) return { success: false };

    try {
      const payload = {
        id: String(post.id),
        group_title: post.groupTitle || "Nhóm Facebook",
        group_url: post.groupUrl || "",
        matched_keyword: post.matchedKeyword || "",
        post_text: post.fullText || post.text || "",
        post_link: post.link || "",
        post_time: post.postTime || "Vừa xong",
        post_timestamp: post.postTimestamp || Date.now(),
        detected_at: new Date(post.timestamp || Date.now()).toISOString(),
        account_ids: Array.isArray(post.accountIds) ? post.accountIds : [],
        matched_details: post.matchedDetails || {}
      };

      const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/fbradar_posts`, {
        method: "POST",
        headers: {
          ...this.getHeaders(),
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        console.log("[Supabase] Đã lưu bài viết lên cloud thành công:", post.id, "cho tài khoản:", payload.account_ids);
        return { success: true };
      } else {
        const errText = await res.text();
        console.warn("[Supabase] Lưu bài viết thất bại:", errText);
        return { success: false, error: errText };
      }
    } catch (err) {
      console.warn("[Supabase] Lỗi kết nối khi lưu bài viết:", err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Lấy danh sách bài viết mới nhất từ Supabase
   */
  async fetchPosts(limit = 50) {
    try {
      const res = await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/fbradar_posts?select=*&order=post_timestamp.desc&limit=${limit}`,
        {
          headers: {
            ...this.getHeaders(),
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache"
          }
        }
      );

      if (res.ok) {
        const data = await res.json();
        return data.map(item => ({
          id: item.id,
          groupTitle: item.group_title,
          groupUrl: item.group_url,
          matchedKeyword: item.matched_keyword,
          text: item.post_text,
          link: item.post_link,
          postTime: item.post_time,
          postTimestamp: parseInt(item.post_timestamp, 10) || Date.now(),
          timestamp: new Date(item.detected_at).getTime(),
          accountIds: Array.isArray(item.account_ids) ? item.account_ids : []
        }));
      }
    } catch (err) {
      console.warn("[Supabase] Lỗi tải bài viết từ cloud:", err);
    }
    return [];
  },

  /**
   * Lấy toàn bộ danh sách tài khoản từ bảng fbradar_accounts
   */
  async fetchAccounts() {
    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/fbradar_accounts?select=id,username,display_name`, {
        headers: {
          ...this.getHeaders(),
          "Cache-Control": "no-cache, no-store, must-revalidate"
        }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("[Supabase] Lỗi lấy danh sách tài khoản:", e);
    }
    return [];
  },

  /**
   * Lấy toàn bộ cấu hình tài khoản (kể cả bật và tắt) để hiển thị tổng quan trên popup
   */
  async fetchAllAccountConfigs() {
    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/fbradar_account_config?select=*`, {
        headers: {
          ...this.getHeaders(),
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("[Supabase] Lỗi lấy cấu hình tài khoản:", e);
    }
    return [];
  },

  /**
   * Kéo và hợp nhất cấu hình từ TẤT CẢ các tài khoản đang BẬT quét:
   * - Tự động phát hiện các nhóm trùng lặp giữa các tài khoản và gộp lại (chỉ quét 1 lần)
   * - Gom tất cả từ khóa của các tài khoản và tạo keywordAccountMap: { [keyword]: [account_ids] }
   * - Giúp Extension vừa tối ưu tài nguyên quét, vừa phân phối đúng bài viết cho từng tài khoản
   */
  async pullAggregatedRunnerConfig() {
    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/fbradar_account_config?enabled=eq.true&select=*`, {
        headers: {
          ...this.getHeaders(),
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        }
      });

      let activeConfigs = [];
      if (res.ok) {
        activeConfigs = await res.json();
      }

      // Chuẩn hóa canonical URL nhóm để chống quét trùng (bỏ www, trailing slash)
      const cleanGroupUrl = (raw) => {
        try {
          let u = (raw || "").trim();
          if (!u.startsWith("http")) u = "https://" + u;
          const obj = new URL(u);
          const host = obj.hostname.replace(/^www\./, "");
          return `https://${host}${obj.pathname}`.toLowerCase().replace(/\/+$/, "");
        } catch {
          return (raw || "").trim().toLowerCase().replace(/\/+$/, "");
        }
      };

      const groupMap = new Map();
      const keywordAccountMap = {};
      const globalKeywordsSet = new Set();

      if (Array.isArray(activeConfigs) && activeConfigs.length > 0) {
        activeConfigs.forEach(acc => {
          const accId = acc.account_id;
          const accKeywords = Array.isArray(acc.keywords) ? acc.keywords : [];
          const accGroups = Array.isArray(acc.groups) ? acc.groups : [];

          // Đăng ký từ khóa và mapping tài khoản
          accKeywords.forEach(kw => {
            const cleanKw = (kw || "").trim();
            if (!cleanKw) return;
            globalKeywordsSet.add(cleanKw);

            if (!keywordAccountMap[cleanKw]) {
              keywordAccountMap[cleanKw] = [];
            }
            if (!keywordAccountMap[cleanKw].includes(accId)) {
              keywordAccountMap[cleanKw].push(accId);
            }
          });

          // Hợp nhất các nhóm (Group Merging)
          accGroups.forEach(g => {
            if (!g || g.enabled === false || !g.url) return;

            const canonical = cleanGroupUrl(g.url);
            const gSteps = parseInt(g.scrollSteps, 10) || parseInt(acc.max_scroll_steps, 10) || 10;
            const gReload = parseFloat(g.reloadMinutes) || parseFloat(acc.reload_minutes) || 10;

            if (!groupMap.has(canonical)) {
              groupMap.set(canonical, {
                canonicalUrl: canonical,
                rawUrl: g.url,
                name: g.name || "Nhóm Facebook",
                accounts: [accId],
                scrollSteps: gSteps,
                reloadMinutes: gReload,
                keywords: new Set(accKeywords)
              });
            } else {
              // Nhóm đã có tài khoản khác quét -> HỢP NHẤT, KHÔNG QUÉT LẶP
              const existing = groupMap.get(canonical);
              if (!existing.accounts.includes(accId)) {
                existing.accounts.push(accId);
              }
              // Lấy số bước cuộn lớn hơn để bắt đủ bài
              existing.scrollSteps = Math.max(existing.scrollSteps, gSteps);
              // Lấy chu kỳ dừng nhỏ hơn để đáp ứng cả 2 tài khoản
              existing.reloadMinutes = Math.min(existing.reloadMinutes, gReload);
              accKeywords.forEach(kw => existing.keywords.add(kw));
            }
          });
        });
      }

      // Nếu không có cấu hình tài khoản nào bật, thử đọc cấu hình đơn bảng fbradar_config
      if (groupMap.size === 0 && globalKeywordsSet.size === 0) {
        const fallbackConfig = await this.pullConfig();
        if (fallbackConfig && fallbackConfig.enabled && fallbackConfig.groups && fallbackConfig.groups.length > 0) {
          return {
            enabled: true,
            accounts: ["default"],
            groups: fallbackConfig.groups,
            allKeywords: fallbackConfig.keywords || [],
            keywordAccountMap: {},
            reloadMinutes: fallbackConfig.reloadMinutes || 10,
            maxScrollSteps: fallbackConfig.maxScrollSteps || 10
          };
        }
      }

      const mergedGroups = Array.from(groupMap.values()).map(mg => ({
        url: mg.rawUrl,
        canonicalUrl: mg.canonicalUrl,
        name: mg.name,
        accounts: mg.accounts,
        scrollSteps: mg.scrollSteps,
        reloadMinutes: mg.reloadMinutes,
        keywords: Array.from(mg.keywords)
      }));

      const hasActiveTargets = mergedGroups.length > 0;

      // Khoảng nghỉ giữa các vòng quét toàn bộ
      let minRoundInterval = 5;
      if (activeConfigs.length > 0) {
        const intervals = activeConfigs
          .map(a => parseFloat(a.reload_minutes))
          .filter(n => !isNaN(n) && n > 0);
        if (intervals.length > 0) {
          minRoundInterval = Math.min(...intervals);
        }
      }

      return {
        enabled: hasActiveTargets && activeConfigs.length > 0,
        accounts: activeConfigs.map(a => a.account_id),
        groups: mergedGroups,
        allKeywords: Array.from(globalKeywordsSet),
        keywordAccountMap,
        reloadMinutes: minRoundInterval
      };
    } catch (err) {
      console.warn("[Supabase] Lỗi hợp nhất cấu hình đa tài khoản:", err);
      return null;
    }
  },

  /**
   * Kéo cấu hình bảng fbradar_config (dự phòng)
   */
  async pullConfig() {
    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/fbradar_config?id=eq.default&select=*`, {
        headers: {
          ...this.getHeaders(),
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const row = data[0];
          return {
            enabled: Boolean(row.enabled),
            keywords: Array.isArray(row.keywords) ? row.keywords : [],
            groups: Array.isArray(row.groups) ? row.groups : [],
            reloadMinutes: parseFloat(row.reload_minutes) || 10,
            jitterPercent: typeof row.jitter_percent === "number" ? row.jitter_percent : 20,
            scrollSpeed: row.scroll_speed || "medium",
            maxScrollSteps: parseInt(row.max_scroll_steps, 10) || 10,
            updatedAt: row.updated_at
          };
        }
      }
    } catch (err) {
      console.warn("[Supabase] Lỗi kéo cấu hình từ cloud:", err);
    }
    return null;
  },

  /**
   * Báo cáo nhịp tim (Heartbeat) và trạng thái Tab Treo lên Cloud
   */
  async sendHeartbeat(status, currentGroup) {
    try {
      await fetch(`${SUPABASE_CONFIG.url}/rest/v1/fbradar_config?id=eq.default`, {
        method: "PATCH",
        headers: this.getHeaders(),
        body: JSON.stringify({
          runner_status: status || "Đang chạy",
          current_running_group: currentGroup || null,
          last_heartbeat: new Date().toISOString()
        })
      });
    } catch (e) {}
  },

  /**
   * Cập nhật trạng thái Bật / Tắt quét toàn cục lên Database
   */
  async setMasterEnabled(enabled) {
    try {
      const now = new Date().toISOString();
      await fetch(`${SUPABASE_CONFIG.url}/rest/v1/fbradar_config?id=eq.default`, {
        method: "PATCH",
        headers: this.getHeaders(),
        body: JSON.stringify({
          enabled: !!enabled,
          updated_at: now
        })
      });

      await fetch(`${SUPABASE_CONFIG.url}/rest/v1/fbradar_account_config`, {
        method: "PATCH",
        headers: this.getHeaders(),
        body: JSON.stringify({
          enabled: !!enabled,
          updated_at: now
        })
      });
      return true;
    } catch (e) {
      return false;
    }
  }
};

// Xuất nếu chạy trong môi trường node hoặc importScripts
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SupabaseClient, SUPABASE_CONFIG };
}
