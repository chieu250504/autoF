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
        const start = Math.max(0, foundIndex - 40);
        const end = Math.min(cleanRaw.length, foundIndex + kw.length + 80);
        let snippet = cleanRaw.substring(start, end);
        if (start > 0) snippet = "..." + snippet;
        if (end < cleanRaw.length) snippet = snippet + "...";

        return {
          matched: true,
          matchedKeyword: cleanKw,
          snippet: snippet
        };
      }
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
    const baseMs = Math.max(0.5, baseMinutes) * 60 * 1000;
    const maxDeltaMs = baseMs * (Math.max(0, Math.min(50, jitterPercent)) / 100);

    const u1 = Math.random() || 0.0001;
    const u2 = Math.random() || 0.0001;
    let normalVariance = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    normalVariance = Math.max(-1.5, Math.min(1.5, normalVariance)) / 1.5;

    const actualDelta = normalVariance * maxDeltaMs;
    return Math.max(30000, Math.round(baseMs + actualDelta)); // Tối thiểu 30s
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

    if (this.shouldRun()) {
      this.start();
    } else {
      if (!this.isRunnerTab) {
        this.updateStatusBadge("Tab thường (Bấm để đặt làm Tab Treo)");
      } else {
        this.updateStatusBadge("Đã tạm dừng (Vui lòng bật công tắc trong Extension)");
      }
    }
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
          keywords: ["tuyển dụng", "báo giá", "cần tìm"],
          groups: [],
          reloadMinutes: 5,
          jitterPercent: 30,
          scrollSpeed: "medium",
          maxScrollSteps: 6,
          ...stored
        };
        resolve(this.config);
      });
    });
  },

  getEnabledGroups() {
    if (!this.config || !this.config.groups) return [];
    return this.config.groups
      .map(g => (typeof g === "string" ? { url: g, enabled: true, name: "" } : g))
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
    if (!this.config || !this.config.keywords || this.config.keywords.length === 0) {
      return;
    }

    const postElements = PostExtractor.getPostElements();
    for (const postEl of postElements) {
      const postData = PostExtractor.extract(postEl);
      if (!postData || !postData.id) continue;

      if (DeduplicationEngine.has(postData.id)) {
        continue;
      }

      const matchResult = KeywordMatcher.match(postData.text, this.config.keywords);
      if (matchResult.matched) {
        DeduplicationEngine.add(postData.id);

        console.log(
          `%c[FB Radar MATCHED!]%c Khớp: "${matchResult.matchedKeyword}"`,
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
          timestamp: Date.now()
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

    const enabledGroups = this.getEnabledGroups();
    const currentIndex = this.getCurrentGroupIndex(enabledGroups);
    const currentGroup = enabledGroups[currentIndex];
    const groupName = currentGroup ? (currentGroup.name || PostExtractor.getGroupTitle()) : PostExtractor.getGroupTitle();

    // Lấy cài đặt cuộn & thời gian dừng riêng cho nhóm này (nếu có)
    const groupScrollSteps = (currentGroup && currentGroup.scrollSteps > 0)
      ? currentGroup.scrollSteps
      : (this.config.maxScrollSteps || 6);

    const groupReloadMinutes = (currentGroup && currentGroup.reloadMinutes > 0)
      ? currentGroup.reloadMinutes
      : (this.config.reloadMinutes || 3);

    const statusText = `Đang quét: ${groupName} (${currentIndex + 1}/${Math.max(1, enabledGroups.length)}) [${groupScrollSteps} nhịp cuộn]`;
    this.updateStatusBadge(statusText);

    // Đồng bộ trạng thái về background và storage
    chrome.runtime.sendMessage({
      action: "UPDATE_RUNNER_STATUS",
      status: statusText,
      currentGroup: currentGroup ? currentGroup.url : window.location.href
    }).catch(() => {});

    await HumanSimulator.sleep(HumanSimulator.randomBetween(2000, 3500));

    // Quét đỉnh trang
    this.scanVisiblePosts();

    // Cuộn lướt nhẹ nhàng với số nhịp của riêng nhóm này
    await HumanSimulator.simulateHumanScroll({
      steps: groupScrollSteps,
      speed: this.config.scrollSpeed || "medium",
      onStep: async () => {
        this.scanVisiblePosts();
      }
    });

    // Lập lịch luân phiên chuyển nhóm tiếp theo theo thời gian dừng của nhóm này
    this.scheduleNextRotation(enabledGroups, currentIndex, groupReloadMinutes);
  },

  scheduleNextRotation(enabledGroups, currentIndex, customReloadMinutes = null) {
    if (!this.isRunning) return;

    const stayMinutes = (customReloadMinutes && customReloadMinutes > 0)
      ? customReloadMinutes
      : (this.config.reloadMinutes || 3);

    const delayMs = HumanSimulator.calculateJitterMs(
      stayMinutes,
      this.config.jitterPercent || 30
    );

    this.nextRunTimestamp = Date.now() + delayMs;
    console.log(`[FB Radar] Chu kỳ kế tiếp được lập lịch sau ${Math.round(delayMs / 1000)}s (thời gian dừng nhóm này: ${stayMinutes} phút).`);

    this.startCountdown(enabledGroups, currentIndex);

    if (this.cycleTimerId) clearTimeout(this.cycleTimerId);
    this.cycleTimerId = setTimeout(() => {
      this.rotateToNextGroup(enabledGroups, currentIndex);
    }, delayMs);
  },

  startCountdown(enabledGroups, currentIndex) {
    if (this.countdownIntervalId) clearInterval(this.countdownIntervalId);

    const updateTimer = () => {
      if (!this.isRunning || !this.nextRunTimestamp) return;

      const now = Date.now();
      const remainingSec = Math.max(0, Math.round((this.nextRunTimestamp - now) / 1000));
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      const formatted = `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;

      const nextIndex = enabledGroups.length > 1 ? (currentIndex + 1) % enabledGroups.length : currentIndex;
      const nextName = enabledGroups[nextIndex] ? (enabledGroups[nextIndex].name || `Nhóm ${nextIndex + 1}`) : "tiếp theo";

      const displayText = enabledGroups.length > 1 
        ? `Đổi sang ${nextName} sau: ${formatted}`
        : `Lượt quét tới: ${formatted}`;

      this.updateStatusBadge(displayText);

      // Cập nhật trạng thái vào storage định kỳ mỗi 3s để Popup ở các tab khác luôn thấy
      if (remainingSec % 3 === 0) {
        chrome.storage.local.set({
          runnerStatus: displayText,
          currentRunningGroup: enabledGroups[currentIndex] ? enabledGroups[currentIndex].url : window.location.href
        });
      }

      // Khi hết thời gian: Tự động kích hoạt ngay lập tức
      if (now >= this.nextRunTimestamp) {
        clearInterval(this.countdownIntervalId);
        this.countdownIntervalId = null;
        if (this.cycleTimerId) {
          clearTimeout(this.cycleTimerId);
          this.cycleTimerId = null;
        }
        this.rotateToNextGroup(enabledGroups, currentIndex);
      }
    };

    updateTimer();
    this.countdownIntervalId = setInterval(updateTimer, 1000);
  },

  rotateToNextGroup(enabledGroups, currentIndex) {
    if (!this.isRunning) return;

    if (this.cycleTimerId) clearTimeout(this.cycleTimerId);
    if (this.countdownIntervalId) clearInterval(this.countdownIntervalId);

    if (!enabledGroups || enabledGroups.length <= 1) {
      // Chỉ có 1 nhóm hoặc 0 nhóm -> reload lại trang để quét tiếp bài mới
      console.log("[FB Radar] Tiến hành tải lại trang an toàn theo chu kỳ.");
      this.updateStatusBadge("Đang làm mới trang...");

      chrome.runtime.sendMessage({ action: "NAVIGATE_OR_RELOAD_RUNNER", isReload: true }, () => {
        setTimeout(() => {
          window.location.reload();
        }, 400);
      });
      return;
    }

    // Chuyển sang nhóm kế tiếp trong danh sách luân phiên (Round-Robin)
    const nextIndex = (currentIndex + 1) % enabledGroups.length;
    const nextGroup = enabledGroups[nextIndex];
    const nextUrl = this.buildRunnerUrl(nextGroup.url);

    console.log(`[FB Radar] Chuyển luân phiên sang nhóm (${nextIndex + 1}/${enabledGroups.length}):`, nextGroup.url);
    this.updateStatusBadge(`Đang chuyển sang nhóm ${nextIndex + 1}/${enabledGroups.length}...`);

    chrome.runtime.sendMessage({
      action: "UPDATE_RUNNER_STATUS",
      status: `Đang chuyển sang: ${nextGroup.name || "Nhóm tiếp theo"}`,
      currentGroup: nextGroup.url
    }).catch(() => {});

    // Kiểm tra xem có trùng URL nhóm hiện tại không
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
