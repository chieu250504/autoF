/**
 * FB Group Keyword Radar - Content Script
 * Session 2 & 3 & 4+: Single-Tab Group Rotation, Human Behavior Simulation & Real-time Sync
 */

console.log("%c[FB Radar]%c Khởi tạo Radar theo dõi bài viết Facebook (Cơ chế 1 Tab Luân Phiên).", "color: #1877f2; font-weight: bold;", "color: inherit;");

// ==========================================
// 1. TEXT NORMALIZER & KEYWORD MATCHER (Bộ lọc từ khóa)
// ==========================================
const TextNormalizer = {
  removeAccents(str) {
    if (!str) return "";
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
  },

  cleanText(str) {
    if (!str) return "";
    return str
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
};

const KeywordMatcher = {
  match(content, keywords) {
    if (!content || !keywords || keywords.length === 0) {
      return { matched: false };
    }

    const cleanRaw = TextNormalizer.cleanText(content);
    const rawLower = cleanRaw.toLowerCase();
    const unaccentedContent = TextNormalizer.removeAccents(rawLower);

    const matchedKeywords = [];
    let firstSnippet = "";

    for (const kw of keywords) {
      if (!kw || !kw.trim()) continue;
      const cleanKw = TextNormalizer.cleanText(kw);
      const kwLower = cleanKw.toLowerCase();
      const unaccentedKw = TextNormalizer.removeAccents(kwLower);

      let foundIndex = rawLower.indexOf(kwLower);

      if (foundIndex === -1) {
        foundIndex = unaccentedContent.indexOf(unaccentedKw);
      }

      if (foundIndex === -1 && kwLower.includes(" ")) {
        const tokens = unaccentedKw.split(" ").filter(t => t.length > 1);
        if (tokens.length > 1) {
          const allTokensPresent = tokens.every(token => unaccentedContent.includes(token));
          if (allTokensPresent) {
            foundIndex = unaccentedContent.indexOf(tokens[0]);
          }
        }
      }

      if (foundIndex !== -1) {
        matchedKeywords.push(cleanKw);
        if (!firstSnippet) {
          const start = Math.max(0, foundIndex - 40);
          const end = Math.min(cleanRaw.length, foundIndex + kw.length + 80);
          let snippet = cleanRaw.substring(start, end);
          if (start > 0) snippet = "..." + snippet;
          if (end < cleanRaw.length) snippet = snippet + "...";
          firstSnippet = snippet;
        }
      }
    }

    if (matchedKeywords.length > 0) {
      return {
        matched: true,
        matchedKeyword: matchedKeywords[0],
        allMatchedKeywords: matchedKeywords,
        snippet: firstSnippet
      };
    }

    return { matched: false };
  }
};

// ==========================================
// 2. DEDUPLICATION ENGINE (Chống báo trùng)
// ==========================================
const DeduplicationEngine = {
  maxSize: 500,
  processedIds: new Set(),

  async init() {
    return new Promise(resolve => {
      chrome.storage.local.get(["processedPostIds"], res => {
        const list = res.processedPostIds || [];
        this.processedIds = new Set(list);
        resolve();
      });
    });
  },

  has(id) {
    if (!id) return false;
    return this.processedIds.has(String(id));
  },

  add(id) {
    if (!id) return;
    const strId = String(id);
    this.processedIds.add(strId);

    const arr = Array.from(this.processedIds);
    if (arr.length > this.maxSize) {
      arr.splice(0, arr.length - this.maxSize);
      this.processedIds = new Set(arr);
    }

    chrome.storage.local.set({ processedPostIds: arr });
  }
};

// ==========================================
// 3. POST EXTRACTOR (Bóc tách DOM Facebook)
// ==========================================
const PostExtractor = {
  getFeedContainer() {
    return document.querySelector('[role="feed"]') || 
           document.querySelector('div[aria-label*="Bảng feed"]') ||
           document.querySelector('div[aria-label*="News Feed"]');
  },

  getPostElements() {
    const feed = this.getFeedContainer();
    if (!feed) {
      return Array.from(document.querySelectorAll('[role="article"]'));
    }

    const articles = feed.querySelectorAll('[role="article"]');
    if (articles.length > 0) return Array.from(articles);

    return Array.from(feed.children).filter(el => el.offsetHeight > 100);
  },

  extract(postEl) {
    if (!postEl) return null;

    let postLink = null;
    let postId = null;

    const linkElements = postEl.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"], a[href*="multi_permalinks="], a[href*="story_fbid="]');
    for (const a of linkElements) {
      const href = a.getAttribute("href") || a.href;
      if (!href) continue;

      const matchPost = href.match(/\/posts\/(\d+)/);
      const matchPermalink = href.match(/\/permalink\/(\d+)/);
      const matchMulti = href.match(/multi_permalinks=(\d+)/);
      const matchFbid = href.match(/story_fbid=(\d+)/);

      const foundId = (matchPost && matchPost[1]) ||
                      (matchPermalink && matchPermalink[1]) ||
                      (matchMulti && matchMulti[1]) ||
                      (matchFbid && matchFbid[1]);

      if (foundId) {
        postId = foundId;
        postLink = href.startsWith("http") ? href.split("?")[0] : `https://www.facebook.com${href.split("?")[0]}`;
        break;
      }
    }

    // 2. Trích xuất thời gian đăng bài
    const timeInfo = this.extractPostTime(postEl, linkElements);

    // 3. Tự động bấm "Xem thêm" (See more) nếu bài viết dài bị thu gọn
    this.expandSeeMore(postEl);

    // 4. Trích xuất nội dung văn bản bài viết
    const textNodes = postEl.querySelectorAll('div[dir="auto"], [data-ad-preview="message"]');
    let contentParts = [];

    textNodes.forEach(node => {
      if (node.closest('ul') || node.closest('[role="button"]') || node.closest('form')) {
        return;
      }
      const txt = node.innerText || node.textContent;
      if (txt && txt.trim().length > 3) {
        contentParts.push(txt.trim());
      }
    });

    const fullContent = TextNormalizer.cleanText(contentParts.join("\n"));
    if (!fullContent) return null;

    if (!postId) {
      postId = "hash_" + this.simpleHash(fullContent.substring(0, 80));
      if (!postLink) postLink = window.location.href;
    }

    const groupTitle = this.getGroupTitle();

    return {
      id: postId,
      link: postLink,
      text: fullContent,
      groupTitle: groupTitle,
      postTime: timeInfo.postTimeStr,
      postTimestamp: timeInfo.postTimestamp,
      element: postEl
    };
  },

  /**
   * Trích xuất thời gian đăng bài trên Facebook
   */
  extractPostTime(postEl, linkElements) {
    let timeStr = "";
    let timestamp = Date.now();

    for (const a of linkElements) {
      const aria = a.getAttribute("aria-label");
      if (aria && this.isTimeString(aria)) {
        timeStr = aria.trim();
        break;
      }
      const txt = (a.innerText || "").trim();
      if (txt && this.isTimeString(txt)) {
        timeStr = txt;
        break;
      }
    }

    if (!timeStr) {
      const candidates = postEl.querySelectorAll('abbr, span[id], a[role="link"] span');
      for (const el of candidates) {
        const aria = el.getAttribute("aria-label");
        if (aria && this.isTimeString(aria)) {
          timeStr = aria.trim();
          break;
        }
        const txt = (el.innerText || "").trim();
        if (txt && this.isTimeString(txt) && txt.length < 50) {
          timeStr = txt;
          break;
        }
      }
    }

    if (timeStr) {
      timeStr = timeStr.replace(/^[·\s]+|[·\s]+$/g, "")
                       .replace(/\s*·\s*(Đã chỉnh sửa|Public|Công khai).*$/i, "")
                       .trim();
      timestamp = this.parseRelativeToTimestamp(timeStr);
    } else {
      timeStr = "Vừa phát hiện";
    }

    return { postTimeStr: timeStr, postTimestamp: timestamp };
  },

  isTimeString(str) {
    if (!str) return false;
    const s = str.toLowerCase();
    return /(vừa xong|phút|giờ|ngày|tháng|năm|hôm qua|hôm nay|just now|min|hr|hour|day|yesterday|\b\d+[mhd]\b)/i.test(s);
  },

  parseRelativeToTimestamp(str) {
    const now = Date.now();
    const s = str.toLowerCase();

    if (s.includes("vừa xong") || s.includes("just now")) {
      return now;
    }

    const mMin = s.match(/(\d+)\s*(phút|m|min)/i);
    if (mMin) return now - parseInt(mMin[1], 10) * 60 * 1000;

    const mHour = s.match(/(\d+)\s*(giờ|h|hr|hour)/i);
    if (mHour) return now - parseInt(mHour[1], 10) * 3600 * 1000;

    const mDay = s.match(/(\d+)\s*(ngày|d|day)/i);
    if (mDay) return now - parseInt(mDay[1], 10) * 86400 * 1000;

    if (s.includes("hôm qua") || s.includes("yesterday")) {
      return now - 24 * 3600 * 1000;
    }

    return now;
  },

  expandSeeMore(postEl) {
    try {
      const buttons = postEl.querySelectorAll('[role="button"]');
      for (const btn of buttons) {
        const txt = (btn.innerText || "").toLowerCase().trim();
        if (txt === "xem thêm" || txt === "see more" || txt === "xem thêm...") {
          btn.click();
          break;
        }
      }
    } catch (e) {}
  },

  getGroupTitle() {
    const h1 = document.querySelector('h1');
    if (h1 && h1.innerText) return h1.innerText.trim();
    const title = document.title || "Nhóm Facebook";
    return title.replace(/\s*\|\s*Facebook.*$/i, "").trim();
  },

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
};

// ==========================================
// 4. HUMAN SIMULATOR (Bộ giả lập hành vi)
// ==========================================
const HumanSimulator = {
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  calculateJitterMs(baseMinutes, jitterPercent) {
    const baseMs = Math.max(0.4, baseMinutes) * 60 * 1000;
    const maxDeltaMs = baseMs * (Math.max(0, Math.min(50, jitterPercent)) / 100);

    const u1 = Math.random() || 0.0001;
    const u2 = Math.random() || 0.0001;
    let normalVariance = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    normalVariance = Math.max(-1.5, Math.min(1.5, normalVariance)) / 1.5;

    const actualDelta = normalVariance * maxDeltaMs;
    return Math.max(25000, Math.round(baseMs + actualDelta)); // Tối thiểu 25s cho chế độ test
  },

  async simulateHumanScroll({ steps = 6, speed = "medium", onStep = null }) {
    const delayRanges = {
      slow: { min: 2000, max: 4000 },
      medium: { min: 1000, max: 2200 },
      fast: { min: 500, max: 1100 }
    };
    const pauseConfig = delayRanges[speed] || delayRanges.medium;

    console.log(`[FB Radar] Bắt đầu chuỗi cuộn mô phỏng (${steps} nhịp, tốc độ: ${speed})...`);

    for (let i = 1; i <= steps; i++) {
      if (!RadarEngine.isRunning) break;

      // Khoảng cách cuộn sâu hơn để bắt nhiều bài viết mới hơn
      const scrollDistance = this.randomBetween(480, 920);
      window.scrollBy({ top: scrollDistance, behavior: "smooth" });

      if (typeof onStep === "function") {
        try {
          await onStep(i);
        } catch (err) {
          console.warn("[FB Radar] Lỗi callback onStep:", err);
        }
      }

      if (Math.random() < 0.15 && i > 1) {
        await this.sleep(this.randomBetween(300, 600));
        window.scrollBy({ top: -this.randomBetween(80, 180), behavior: "smooth" });
      }

      const pauseDuration = this.randomBetween(pauseConfig.min, pauseConfig.max);
      await this.sleep(pauseDuration);
    }

    await this.sleep(this.randomBetween(600, 1200));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

// ==========================================
// 5. RADAR ENGINE (Single-Tab Group Rotation)
// ==========================================
const RadarEngine = {
  config: null,
  isRunning: false,
  isRunnerTab: false,
  cycleTimerId: null,
  countdownIntervalId: null,
  nextRunTimestamp: null,
  feedObserver: null,

  async init() {
    await this.checkIfRunnerTab();
    this.createFloatingStatusBadge();
    await DeduplicationEngine.init();
    await this.loadConfig();
    this.bindEvents();

    if (this.isRunnerTab) {
      // Khởi tạo luồng nhịp tim định kỳ lên Cloud
      this.startHeartbeatLoop();
      // Kéo cấu hình mới nhất từ Supabase ngay khi tải trang
      await this.syncWithCloud();

      if (this.shouldRun()) {
        this.start();
      } else {
        this.pauseByRemote("Đang chờ lệnh bật từ Web Dashboard...");
      }
    } else {
      this.updateStatusBadge("Tab thường (Bấm để đặt làm Tab Treo)");
    }
  },

  heartbeatIntervalId: null,
  standbyPollTimerId: null,

  startHeartbeatLoop() {
    if (this.heartbeatIntervalId) clearInterval(this.heartbeatIntervalId);

    const sendPing = () => {
      if (!this.isRunnerTab) return;
      const statusText = document.getElementById("fb-radar-status-text")?.textContent || "Đang trực";
      if (typeof SupabaseClient !== "undefined") {
        SupabaseClient.sendHeartbeat(statusText, window.location.href).catch(() => {});
      }
    };

    sendPing();
    // Gửi nhịp tim đều đặn mỗi 15 giây
    this.heartbeatIntervalId = setInterval(sendPing, 15000);
  },

  async syncWithCloud() {
    if (typeof SupabaseClient === "undefined") return;

    try {
      // 1. Kéo cấu hình đa tài khoản đã được hợp nhất tự động
      const aggregated = await SupabaseClient.pullAggregatedRunnerConfig();
      if (aggregated) {
        const wasEnabled = this.config ? this.config.enabled : false;
        const nowEnabled = Boolean(aggregated.enabled);

        this.config = {
          ...this.config,
          enabled: nowEnabled,
          allKeywords: aggregated.allKeywords || [],
          keywords: aggregated.allKeywords || [],
          groups: aggregated.groups || [],
          keywordAccountMap: aggregated.keywordAccountMap || {},
          activeAccounts: aggregated.accounts || []
        };

        chrome.storage.local.set(this.config);

        if (wasEnabled && !nowEnabled) {
          console.log("%c[FB Radar Remote]%c Nhận lệnh TẮT từ Web Dashboard.", "color: #e11d48; font-weight: bold;", "color: inherit;");
          this.pauseByRemote("Đã tắt từ Web Dashboard (Tất cả tài khoản tắt)");
        } else if (!wasEnabled && nowEnabled && this.isRunnerTab) {
          console.log("%c[FB Radar Remote]%c Nhận lệnh BẬT từ Web Dashboard.", "color: #10b981; font-weight: bold;", "color: inherit;");
          this.resumeByRemote();
        }
        return;
      }

      // Fallback nếu chưa có cấu hình đa tài khoản
      const cloudConfig = await SupabaseClient.pullConfig();
      if (!cloudConfig) return;

      const wasEnabled = this.config ? this.config.enabled : false;
      const nowEnabled = cloudConfig.enabled;

      this.config = {
        ...this.config,
        enabled: nowEnabled,
        keywords: Array.isArray(cloudConfig.keywords) && cloudConfig.keywords.length > 0 ? cloudConfig.keywords : this.config.keywords,
        groups: Array.isArray(cloudConfig.groups) ? cloudConfig.groups : this.config.groups,
        reloadMinutes: cloudConfig.reloadMinutes || this.config.reloadMinutes,
        maxScrollSteps: cloudConfig.maxScrollSteps || this.config.maxScrollSteps,
        jitterPercent: cloudConfig.jitterPercent || this.config.jitterPercent,
        scrollSpeed: cloudConfig.scrollSpeed || this.config.scrollSpeed,
      };

      // Đồng bộ vào chrome storage
      chrome.storage.local.set(this.config);

      // Phản hồi khi trạng thái enabled thay đổi từ xa qua Web Dashboard
      if (wasEnabled && !nowEnabled) {
        console.log("%c[FB Radar Remote]%c Nhận lệnh TẮT từ Web Dashboard.", "color: #e11d48; font-weight: bold;", "color: inherit;");
        this.pauseByRemote("Đã tắt từ Web Dashboard");
      } else if (!wasEnabled && nowEnabled && this.isRunnerTab) {
        console.log("%c[FB Radar Remote]%c Nhận lệnh BẬT từ Web Dashboard.", "color: #10b981; font-weight: bold;", "color: inherit;");
        this.resumeByRemote();
      }
    } catch (e) {
      console.warn("[FB Radar] Lỗi đồng bộ Supabase Cloud:", e);
    }
  },

  pauseByRemote(reason = "Tạm dừng từ Web Dashboard") {
    this.stop();
    this.updateStatusBadge(reason);

    if (typeof SupabaseClient !== "undefined") {
      SupabaseClient.sendHeartbeat(reason, window.location.href).catch(() => {});
    }

    // Bật chế độ thăm dò standby mỗi 10 giây để đón lệnh BẬT từ xa
    if (!this.standbyPollTimerId) {
      this.standbyPollTimerId = setInterval(async () => {
        if (!this.isRunnerTab) return;
        await this.syncWithCloud();
      }, 10000);
    }
  },

  resumeByRemote() {
    if (this.standbyPollTimerId) {
      clearInterval(this.standbyPollTimerId);
      this.standbyPollTimerId = null;
    }
    this.updateStatusBadge("Đang khởi động lại chu trình...");
    this.start();
  },

  async checkIfRunnerTab() {
    // 1. Kiểm tra hash hoặc sessionStorage
    if (window.location.hash.includes("fbradar_runner") || 
        sessionStorage.getItem("fbradar_is_runner") === "true") {
      this.isRunnerTab = true;
      sessionStorage.setItem("fbradar_is_runner", "true");
      return;
    }

    // 2. Hỏi background xem tab này có phải là runnerTabId không
    try {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "CHECK_AM_I_RUNNER" }, resolve);
      });
      if (res && res.isRunner) {
        this.isRunnerTab = true;
        sessionStorage.setItem("fbradar_is_runner", "true");
      }
    } catch (e) {}
  },

  setAsRunnerTab() {
    this.isRunnerTab = true;
    sessionStorage.setItem("fbradar_is_runner", "true");
    if (!window.location.hash.includes("fbradar_runner")) {
      window.location.hash = "fbradar_runner";
    }
    this.updateStatusBadge("Đã đặt làm Tab Treo!");
    if (this.shouldRun()) {
      this.start();
    }
  },

  async loadConfig() {
    return new Promise(resolve => {
      chrome.storage.local.get(null, stored => {
        this.config = {
          enabled: false,
          keywords: [],
          allKeywords: [],
          groups: [],
          reloadMinutes: 5,
          jitterPercent: 20,
          scrollSpeed: "medium",
          maxScrollSteps: 8,
          ...stored
        };
        resolve(this.config);
      });
    });
  },

  getEnabledGroups() {
    if (!this.config || !this.config.groups) return [];
    return this.config.groups
      .map(g => {
        if (typeof g === "string") {
          return { url: g, enabled: true, name: "", scrollSteps: 0, reloadMinutes: 0 };
        }
        return {
          url: g.url || "",
          name: g.name || "",
          enabled: g.enabled !== false,
          scrollSteps: parseInt(g.scrollSteps, 10) || 0,
          reloadMinutes: parseFloat(g.reloadMinutes) || 0
        };
      })
      .filter(g => g.enabled && g.url);
  },

  shouldRun() {
    if (!this.config || !this.config.enabled) return false;
    // Chỉ kích hoạt tự động quét và điều hướng trên Tab Treo!
    if (!this.isRunnerTab) return false;
    return true;
  },

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[FB Radar] Tab Treo bắt đầu chu trình quét và luân phiên nhóm.");

    this.ensureChronologicalSort();
    this.attachFeedObserver();
    await this.executeCycle();
  },

  stop() {
    this.isRunning = false;
    if (this.cycleTimerId) {
      clearTimeout(this.cycleTimerId);
      this.cycleTimerId = null;
    }
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
    if (this.feedObserver) {
      this.feedObserver.disconnect();
      this.feedObserver = null;
    }
    this.updateStatusBadge("Đã tạm dừng");
  },

  ensureChronologicalSort() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("sorting_setting")) {
        url.searchParams.set("sorting_setting", "CHRONOLOGICAL");
        window.history.replaceState({}, "", url.toString());
      }
    } catch (e) {}
  },

  buildRunnerUrl(rawUrl) {
    try {
      let cleanUrl = rawUrl.trim();
      if (!cleanUrl.startsWith("http")) {
        cleanUrl = "https://" + cleanUrl;
      }
      const u = new URL(cleanUrl);
      u.searchParams.set("sorting_setting", "CHRONOLOGICAL");
      u.hash = "fbradar_runner";
      return u.toString();
    } catch (e) {
      return rawUrl + "#fbradar_runner";
    }
  },

  getCurrentGroupIndex(enabledGroups) {
    if (enabledGroups.length === 0) return 0;
    const currentUrl = window.location.href.toLowerCase();

    for (let i = 0; i < enabledGroups.length; i++) {
      const targetUrl = enabledGroups[i].url.toLowerCase();
      const cleanTarget = targetUrl.replace(/^https?:\/\/(www\.)?facebook\.com\/groups\//, "").replace(/[\/?#].*$/, "");
      const cleanCurrent = currentUrl.replace(/^https?:\/\/(www\.)?facebook\.com\/groups\//, "").replace(/[\/?#].*$/, "");
      if (cleanTarget && cleanCurrent && (cleanCurrent === cleanTarget || cleanCurrent.includes(cleanTarget) || cleanTarget.includes(cleanCurrent))) {
        return i;
      }
    }
    return 0;
  },

  scanVisiblePosts() {
    const keywordsToScan = (this.config && this.config.allKeywords && this.config.allKeywords.length > 0)
      ? this.config.allKeywords
      : (this.config ? this.config.keywords : []);

    if (!keywordsToScan || keywordsToScan.length === 0) {
      return;
    }

    const postElements = PostExtractor.getPostElements();
    for (const postEl of postElements) {
      const postData = PostExtractor.extract(postEl);
      if (!postData || !postData.id) continue;

      if (DeduplicationEngine.has(postData.id)) {
        continue;
      }

      const matchResult = KeywordMatcher.match(postData.text, keywordsToScan);
      if (matchResult.matched) {
        DeduplicationEngine.add(postData.id);

        // Phân loại tài khoản sở hữu từ khóa khớp
        const matchedAccountsSet = new Set();
        const matchedDetails = {};
        const matchedKeywordsList = matchResult.allMatchedKeywords || [matchResult.matchedKeyword];

        matchedKeywordsList.forEach(kw => {
          const owners = (this.config && this.config.keywordAccountMap && this.config.keywordAccountMap[kw]) || [];
          owners.forEach(accId => {
            matchedAccountsSet.add(accId);
            matchedDetails[accId] = kw;
          });
        });

        const accountIds = Array.from(matchedAccountsSet);

        console.log(
          `%c[FB Radar MATCHED!]%c Khớp: "${matchResult.matchedKeyword}" cho tài khoản: [${accountIds.join(', ')}]`,
          "background: #1877f2; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px;",
          "color: #2e7d32; font-weight: bold;"
        );

        this.handleMatchedPost({
          id: postData.id,
          text: matchResult.snippet || postData.text.substring(0, 160),
          fullText: postData.text,
          link: postData.link,
          matchedKeyword: matchResult.matchedKeyword,
          groupTitle: postData.groupTitle,
          postTime: postData.postTime || "Vừa xong",
          postTimestamp: postData.postTimestamp || Date.now(),
          timestamp: Date.now(),
          accountIds: accountIds,
          matchedDetails: matchedDetails
        });
      }
    }
  },

  playNotificationSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playTone = (freq, start, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      playTone(587.33, 0, 0.22);
      playTone(880.00, 0.14, 0.35);
    } catch (e) {}
  },

  handleMatchedPost(postPayload) {
    this.updateStatusBadge(`🎯 Khớp: "${postPayload.matchedKeyword}"!`);

    if (this.config && this.config.soundEnabled !== false) {
      this.playNotificationSound();
    }

    chrome.storage.local.get(["logs"], res => {
      const logs = res.logs || [];
      logs.unshift(postPayload);
      if (logs.length > 50) logs.pop();
      chrome.storage.local.set({ logs });
    });

    chrome.runtime.sendMessage({
      action: "NEW_MATCHED_POST",
      post: postPayload
    }).catch(() => {});
  },

  attachFeedObserver() {
    if (this.feedObserver) this.feedObserver.disconnect();

    const feed = PostExtractor.getFeedContainer();
    if (!feed) {
      setTimeout(() => {
        if (this.isRunning) this.attachFeedObserver();
      }, 2000);
      return;
    }

    this.feedObserver = new MutationObserver(() => {
      if (this.isRunning) {
        this.scanVisiblePosts();
      }
    });

    this.feedObserver.observe(feed, { childList: true, subtree: true });
  },

  async executeCycle() {
    if (!this.isRunning) return;

    // Kéo cấu hình mới nhất từ Supabase Cloud trước khi bắt đầu quét
    await this.syncWithCloud();
    if (!this.shouldRun()) {
      this.pauseByRemote("Đã tắt từ Web Dashboard");
      return;
    }

    const enabledGroups = this.getEnabledGroups();
    if (!enabledGroups || enabledGroups.length === 0) {
      this.pauseByRemote("Chưa có nhóm nào được bật");
      return;
    }

    const totalGroups = enabledGroups.length;
    const currentIndex = this.getCurrentGroupIndex(enabledGroups);
    const currentGroup = enabledGroups[currentIndex];
    const isLastGroupInRound = (currentIndex >= totalGroups - 1);
    const groupName = currentGroup ? (currentGroup.name || PostExtractor.getGroupTitle()) : PostExtractor.getGroupTitle();

    // Số bước cuộn riêng của nhóm này (mô phỏng người đọc thật để quét hết bài mới)
    const groupScrollSteps = (currentGroup && currentGroup.scrollSteps > 0)
      ? currentGroup.scrollSteps
      : (this.config.maxScrollSteps || 8);

    const statusText = `Đang quét: ${groupName} (${currentIndex + 1}/${totalGroups}) [${groupScrollSteps} bước cuộn]`;
    this.updateStatusBadge(statusText);

    // Đồng bộ trạng thái và nhịp tim về Supabase Cloud
    if (typeof SupabaseClient !== "undefined") {
      SupabaseClient.sendHeartbeat(statusText, currentGroup ? currentGroup.url : window.location.href).catch(() => {});
    }

    chrome.runtime.sendMessage({
      action: "UPDATE_RUNNER_STATUS",
      status: statusText,
      currentGroup: currentGroup ? currentGroup.url : window.location.href
    }).catch(() => {});

    await HumanSimulator.sleep(HumanSimulator.randomBetween(1500, 2500));

    // 1. Quét đỉnh trang
    this.scanVisiblePosts();

    // 2. Cuộn lướt nhẹ nhàng với số nhịp của riêng nhóm này để đảm bảo quét xong nhóm
    await HumanSimulator.simulateHumanScroll({
      steps: groupScrollSteps,
      speed: this.config.scrollSpeed || "medium",
      onStep: async () => {
        this.scanVisiblePosts();
      }
    });

    // 3. Đã quét xong nhóm này!
    if (!isLastGroupInRound) {
      // CHƯA HẾT VÒNG: Chuyển sang nhóm tiếp theo NGAY LẬP TỨC (chỉ nghỉ 2.5s - 3.5s để đổi trang an toàn)
      const nextIndex = currentIndex + 1;
      const nextGroup = enabledGroups[nextIndex];
      const nextName = nextGroup ? (nextGroup.name || `Nhóm ${nextIndex + 1}`) : "tiếp theo";
      const transText = `Xong (${currentIndex + 1}/${totalGroups}). Chuyển sang ${nextName} ngay...`;

      this.updateStatusBadge(transText);
      console.log(`[FB Radar] Đã quét xong nhóm (${currentIndex + 1}/${totalGroups}). Chuyển ngay sang nhóm kế tiếp.`);

      if (typeof SupabaseClient !== "undefined") {
        SupabaseClient.sendHeartbeat(transText, currentGroup ? currentGroup.url : window.location.href).catch(() => {});
      }

      await HumanSimulator.sleep(HumanSimulator.randomBetween(2500, 3800));
      await this.rotateToNextGroup(enabledGroups, currentIndex);
    } else {
      // ĐÃ QUÉT HẾT TẤT CẢ CÁC NHÓM TRONG VÒNG (hoặc chỉ có 1 nhóm):
      // Nghỉ 5 phút (hoặc theo cấu hình reload_minutes) trước khi quét lại vòng mới!
      const roundIntervalMinutes = (this.config.reloadMinutes && this.config.reloadMinutes > 0)
        ? this.config.reloadMinutes
        : 5;

      console.log(`[FB Radar] 🎉 Đã hoàn thành 1 vòng quét tất cả (${totalGroups}/${totalGroups}) nhóm! Nghỉ ${roundIntervalMinutes} phút trước vòng quét kế tiếp.`);
      this.scheduleNextRound(enabledGroups, roundIntervalMinutes);
    }
  },

  scheduleNextRound(enabledGroups, roundIntervalMinutes) {
    if (!this.isRunning) return;

    const delayMs = HumanSimulator.calculateJitterMs(
      roundIntervalMinutes,
      this.config.jitterPercent || 20
    );

    this.nextRunTimestamp = Date.now() + delayMs;
    console.log(`[FB Radar] Vòng quét mới cho tất cả các nhóm sẽ bắt đầu sau ${Math.round(delayMs / 1000)}s.`);

    this.startRoundCountdown(enabledGroups);

    if (this.cycleTimerId) clearTimeout(this.cycleTimerId);
    this.cycleTimerId = setTimeout(() => {
      this.startNewRound(enabledGroups);
    }, delayMs);
  },

  startRoundCountdown(enabledGroups) {
    if (this.countdownIntervalId) clearInterval(this.countdownIntervalId);

    const updateTimer = async () => {
      if (!this.isRunning || !this.nextRunTimestamp) return;

      const now = Date.now();
      const remainingSec = Math.max(0, Math.round((this.nextRunTimestamp - now) / 1000));
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      const formatted = `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;

      const displayText = `Đã quét xong ${enabledGroups.length}/${enabledGroups.length} nhóm. Vòng tới sau: ${formatted}`;
      this.updateStatusBadge(displayText);

      // Định kỳ mỗi 10 giây: gửi nhịp tim và kiểm tra lệnh tắt từ Web Dashboard
      if (remainingSec % 10 === 0) {
        chrome.storage.local.set({
          runnerStatus: displayText,
          currentRunningGroup: window.location.href
        });

        if (typeof SupabaseClient !== "undefined") {
          SupabaseClient.sendHeartbeat(displayText, window.location.href).catch(() => {});
        }

        // Kiểm tra xem Web Dashboard có tắt công tắc quét không
        await this.syncWithCloud();
        if (!this.shouldRun()) {
          clearInterval(this.countdownIntervalId);
          this.countdownIntervalId = null;
          if (this.cycleTimerId) {
            clearTimeout(this.cycleTimerId);
            this.cycleTimerId = null;
          }
          this.pauseByRemote("Đã tắt từ Web Dashboard");
          return;
        }
      }

      // Khi hết 5 phút -> Tự động bắt đầu vòng quét mới từ nhóm đầu tiên!
      if (now >= this.nextRunTimestamp) {
        clearInterval(this.countdownIntervalId);
        this.countdownIntervalId = null;
        if (this.cycleTimerId) {
          clearTimeout(this.cycleTimerId);
          this.cycleTimerId = null;
        }
        await this.startNewRound(enabledGroups);
      }
    };

    updateTimer();
    this.countdownIntervalId = setInterval(updateTimer, 1000);
  },

  async startNewRound(enabledGroups) {
    if (!this.isRunning) return;

    if (this.cycleTimerId) clearTimeout(this.cycleTimerId);
    if (this.countdownIntervalId) clearInterval(this.countdownIntervalId);

    // Kéo cấu hình mới nhất từ Cloud trước khi khởi động vòng quét mới
    await this.syncWithCloud();
    if (!this.shouldRun()) {
      this.pauseByRemote("Đã tắt từ Web Dashboard");
      return;
    }

    const freshGroups = this.getEnabledGroups();
    if (!freshGroups || freshGroups.length === 0) return;

    const firstGroup = freshGroups[0];
    const targetUrl = this.buildRunnerUrl(firstGroup.url);

    console.log(`[FB Radar] 🚀 Bắt đầu vòng quét mới! Nhóm 1/${freshGroups.length}:`, firstGroup.url);
    this.updateStatusBadge(`Bắt đầu vòng mới: ${firstGroup.name || "Nhóm 1"}...`);

    chrome.runtime.sendMessage({
      action: "UPDATE_RUNNER_STATUS",
      status: `Bắt đầu vòng mới: ${firstGroup.name || "Nhóm 1"}`,
      currentGroup: firstGroup.url
    }).catch(() => {});

    const cleanCurrent = window.location.href.split('#')[0].split('?')[0].toLowerCase();
    const cleanTarget = targetUrl.split('#')[0].split('?')[0].toLowerCase();

    if (cleanCurrent === cleanTarget) {
      // Đang ở đúng nhóm đầu tiên -> reload trang để quét bài mới
      chrome.runtime.sendMessage({ action: "NAVIGATE_OR_RELOAD_RUNNER", isReload: true }, () => {
        setTimeout(() => window.location.reload(), 400);
      });
    } else {
      // Điều hướng về nhóm đầu tiên
      chrome.runtime.sendMessage({ action: "NAVIGATE_OR_RELOAD_RUNNER", url: targetUrl, isReload: false }, () => {
        setTimeout(() => { window.location.href = targetUrl; }, 400);
      });
    }
  },

  async rotateToNextGroup(enabledGroups, currentIndex) {
    if (!this.isRunning) return;

    if (this.cycleTimerId) clearTimeout(this.cycleTimerId);
    if (this.countdownIntervalId) clearInterval(this.countdownIntervalId);

    // Kéo cấu hình mới nhất từ Cloud trước khi chuyển nhóm
    await this.syncWithCloud();
    if (!this.shouldRun()) {
      this.pauseByRemote("Đã tắt từ Web Dashboard");
      return;
    }

    const freshGroups = this.getEnabledGroups();
    if (!freshGroups || freshGroups.length <= 1) {
      chrome.runtime.sendMessage({ action: "NAVIGATE_OR_RELOAD_RUNNER", isReload: true }, () => {
        setTimeout(() => window.location.reload(), 400);
      });
      return;
    }

    // Chuyển sang nhóm kế tiếp
    const nextIndex = (currentIndex + 1) % freshGroups.length;
    const nextGroup = freshGroups[nextIndex];
    const nextUrl = this.buildRunnerUrl(nextGroup.url);

    console.log(`[FB Radar] Chuyển luân phiên sang nhóm (${nextIndex + 1}/${freshGroups.length}):`, nextGroup.url);
    this.updateStatusBadge(`Chuyển sang nhóm ${nextIndex + 1}/${freshGroups.length}...`);

    chrome.runtime.sendMessage({
      action: "UPDATE_RUNNER_STATUS",
      status: `Chuyển sang: ${nextGroup.name || "Nhóm tiếp theo"}`,
      currentGroup: nextGroup.url
    }).catch(() => {});

    const cleanCurrent = window.location.href.split('#')[0].split('?')[0].toLowerCase();
    const cleanNext = nextUrl.split('#')[0].split('?')[0].toLowerCase();

    if (cleanCurrent === cleanNext) {
      chrome.runtime.sendMessage({ action: "NAVIGATE_OR_RELOAD_RUNNER", isReload: true }, () => {
        setTimeout(() => window.location.reload(), 400);
      });
    } else {
      chrome.runtime.sendMessage({ action: "NAVIGATE_OR_RELOAD_RUNNER", url: nextUrl, isReload: false }, () => {
        setTimeout(() => { window.location.href = nextUrl; }, 400);
      });
    }
  },

  createFloatingStatusBadge() {
    if (document.getElementById("fb-radar-badge")) return;

    const badge = document.createElement("div");
    badge.id = "fb-radar-badge";
    badge.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 16px;
      z-index: 999999;
      background: ${this.isRunnerTab ? "rgba(24, 119, 242, 0.94)" : "rgba(80, 80, 80, 0.92)"};
      color: #ffffff;
      padding: 7px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 7px;
      backdrop-filter: blur(4px);
      user-select: none;
      transition: all 0.2s ease;
    `;

    const dotColor = this.isRunnerTab ? "#00e676" : "#ffb300";
    badge.innerHTML = `
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};"></span>
      <span id="fb-radar-status-text">FB Radar: Đang tải...</span>
    `;

    // Click vào badge: nếu tab thường thì cho phép biến thành tab treo
    badge.addEventListener("click", () => {
      if (!this.isRunnerTab) {
        if (confirm("Bạn có muốn đặt tab này làm Tab Treo Giám Sát luân phiên không?")) {
          badge.style.background = "rgba(24, 119, 242, 0.94)";
          this.setAsRunnerTab();
        }
      }
    });

    document.body.appendChild(badge);
  },

  updateStatusBadge(text) {
    const textEl = document.getElementById("fb-radar-status-text");
    if (textEl) {
      const prefix = this.isRunnerTab ? "🎯 Tab Treo" : "FB Radar";
      textEl.textContent = `${prefix}: ${text}`;
    }
  },

  bindEvents() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === "CONFIG_UPDATED") {
        this.config = { ...this.config, ...message.config };
        if (this.shouldRun()) {
          this.stop();
          this.start();
        } else {
          this.stop();
        }
      }
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.enabled) {
        this.config.enabled = changes.enabled.newValue;
        if (this.shouldRun()) {
          this.stop();
          this.start();
        } else {
          this.stop();
        }
      }
    });
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => RadarEngine.init());
} else {
  RadarEngine.init();
}
