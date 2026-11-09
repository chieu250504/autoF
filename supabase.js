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
   * Lưu bài viết mới phát hiện vào bảng fbradar_posts trên Supabase
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
        detected_at: new Date(post.timestamp || Date.now()).toISOString()
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
        console.log("[Supabase] Đã lưu bài viết lên cloud thành công:", post.id);
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
        { headers: this.getHeaders() }
      );

      if (res.ok) {
        const data = await res.json();
        // Chuyển đổi định dạng để tương thích với popup
        return data.map(item => ({
          id: item.id,
          groupTitle: item.group_title,
          groupUrl: item.group_url,
          matchedKeyword: item.matched_keyword,
          text: item.post_text,
          link: item.post_link,
          postTime: item.post_time,
          postTimestamp: parseInt(item.post_timestamp, 10) || Date.now(),
          timestamp: new Date(item.detected_at).getTime()
        }));
      }
    } catch (err) {
      console.warn("[Supabase] Lỗi tải bài viết từ cloud:", err);
    }
    return [];
  },

  /**
   * Đồng bộ cấu hình từ Extension lên Supabase
   */
  async pushConfig(config) {
    try {
      const payload = {
        enabled: !!config.enabled,
        keywords: config.keywords || [],
        groups: config.groups || [],
        reload_minutes: config.reloadMinutes || 0.75,
        jitter_percent: config.jitterPercent || 30,
        scroll_speed: config.scrollSpeed || "medium",
        max_scroll_steps: config.maxScrollSteps || 4,
        updated_at: new Date().toISOString()
      };

      const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/fbradar_config?id=eq.default`, {
        method: "PATCH",
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      return res.ok;
    } catch (err) {
      console.warn("[Supabase] Lỗi đẩy cấu hình lên cloud:", err);
      return false;
    }
  },

  /**
   * Kéo cấu hình từ Supabase về Extension (Để điều khiển từ xa qua web sau này)
   */
  async pullConfig() {
    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/fbradar_config?id=eq.default&select=*`, {
        headers: this.getHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const row = data[0];
          return {
            enabled: row.enabled,
            keywords: row.keywords,
            groups: row.groups,
            reloadMinutes: parseFloat(row.reload_minutes) || 0.75,
            jitterPercent: row.jitter_percent,
            scrollSpeed: row.scroll_speed,
            maxScrollSteps: row.max_scroll_steps
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
  }
};

// Xuất nếu chạy trong môi trường node hoặc importScripts
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SupabaseClient, SUPABASE_CONFIG };
}
