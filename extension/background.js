/**
 * FB Group Keyword Radar - Background Service Worker (Manifest V3)
 * Orchestrates Single Tab Runner, Notifications, Telegram, and Direct Supabase Cloud Sync
 */

importScripts("supabase.js");

console.log("%c[FB Radar Background]%c Service worker initialized with Direct Database Sync.", "color: #1877f2; font-weight: bold;", "color: inherit;");

// Map notificationId to postUrl
const notificationUrls = new Map();

// Hàm đồng bộ cấu hình mới nhất từ Supabase vào extension
async function syncLatestConfigFromDatabase() {
  try {
    const aggregated = await SupabaseClient.pullAggregatedRunnerConfig();
    if (!aggregated) return null;

    const stored = {
      enabled: aggregated.enabled,
      keywords: aggregated.allKeywords || [],
      allKeywords: aggregated.allKeywords || [],
      groups: aggregated.groups || [],
      keywordAccountMap: aggregated.keywordAccountMap || {},
      activeAccounts: aggregated.accounts || []
    };

    chrome.storage.local.set(stored, () => {
      broadcastConfig(stored);
    });

    return aggregated;
  } catch (err) {
    console.warn("[FB Radar Background] Lỗi kéo cấu hình từ Database:", err);
    return null;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log("[FB Radar Background] Extension installed/updated. Đang nạp cấu hình từ Supabase Database...");

  // Thiết lập Alarm định kỳ 1 phút để đồng bộ cập nhật từ Database
  chrome.alarms.create("sync_supabase_config", { periodInMinutes: 1 });

  // Tự động kéo cấu hình mới nhất từ Database khi vừa khởi động
  await syncLatestConfigFromDatabase();
});

// Lắng nghe alarm để kéo cấu hình từ Database (Hỗ trợ điều khiển bật/tắt từ xa qua Web Dashboard)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "sync_supabase_config") {
    await syncLatestConfigFromDatabase();
  }
});

// Broadcast config updates to all open Facebook tabs
function broadcastConfig(config) {
  chrome.tabs.query({ url: "*://*.facebook.com/*" }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, {
        action: "CONFIG_UPDATED",
        config: config
      }).catch(() => {
        // Tab might be inactive or not loaded yet
      });
    });
  });
}

// Send alert to Telegram Bot
async function sendTelegramAlert(config, post) {
  if (!config.tgBotToken || !config.tgChatId) return;

  const botToken = config.tgBotToken.trim();
  const chatId = config.tgChatId.trim();
  if (!botToken || !chatId) return;

  const cleanGroup = escapeHtml(post.groupTitle || "Nhóm Facebook");
  const cleanKeyword = escapeHtml(post.matchedKeyword || "");
  const cleanSnippet = escapeHtml(post.text || "");
  const postTime = escapeHtml(post.postTime || "Vừa phát hiện");
  const postUrl = post.link || "https://www.facebook.com";

  const messageText = 
`🎯 <b>[FB RADAR] PHÁT HIỆN BÀI VIẾT MỚI!</b>
👥 <b>Nhóm:</b> ${cleanGroup}
🕒 <b>Đăng lúc:</b> ${postTime}
🔑 <b>Từ khóa khớp:</b> <code>${cleanKeyword}</code>
📝 <b>Nội dung trích đoạn:</b>
<i>${cleanSnippet}</i>

👉 <a href="${postUrl}">Bấm vào đây để mở bài viết</a>`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: "HTML",
        disable_web_page_preview: false
      })
    });

    const data = await res.json();
    if (data.ok) {
      console.log("[FB Radar Background] Đã gửi thông báo đến Telegram thành công.");
    } else {
      console.warn("[FB Radar Background] Gửi Telegram thất bại:", data.description);
    }
  } catch (err) {
    console.warn("[FB Radar Background] Lỗi mạng khi gửi Telegram:", err);
  }
}

// Display Desktop Chrome Notification
function showDesktopNotification(post) {
  const notifId = "fbradar_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  if (post.link) {
    notificationUrls.set(notifId, post.link);
  }

  const postTimeInfo = post.postTime ? ` (Đăng: ${post.postTime})` : "";
  const title = `🎯 FB Radar: [${post.matchedKeyword}]${postTimeInfo}`;
  const message = `${post.groupTitle ? post.groupTitle + "\n" : ""}${post.text || "Click để mở bài viết"}`;

  chrome.notifications.create(notifId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: title,
    message: message.substring(0, 200),
    contextMessage: "FB Group Keyword Radar (Click để mở)",
    priority: 2,
    requireInteraction: true
  }, (createdId) => {
    if (chrome.runtime.lastError) {
      console.warn("[FB Radar Background] Lỗi tạo thông báo:", chrome.runtime.lastError);
    }
  });
}

// Open post link when user clicks desktop notification
chrome.notifications.onClicked.addListener((notifId) => {
  const url = notificationUrls.get(notifId);
  if (url) {
    chrome.tabs.create({ url: url });
    notificationUrls.delete(notifId);
  } else {
    chrome.tabs.create({ url: "https://www.facebook.com" });
  }
  chrome.notifications.clear(notifId);
});

// Build standardized target URL with chronological sort and runner flag
function buildRunnerUrl(rawUrl) {
  try {
    let cleanUrl = (rawUrl || "").trim();
    if (!cleanUrl.startsWith("http")) {
      cleanUrl = "https://" + cleanUrl;
    }
    const urlObj = new URL(cleanUrl);
    urlObj.searchParams.set("sorting_setting", "CHRONOLOGICAL");
    urlObj.hash = "fbradar_runner";
    return urlObj.toString();
  } catch (e) {
    return (rawUrl || "https://www.facebook.com/groups/feed/") + "#fbradar_runner";
  }
}

// Khởi chạy hoặc chuyển tab treo, LUÔN LẤY DỮ LIỆU TRỰC TIẾP TỪ DATABASE
async function handleOpenOrFocusRunnerTab() {
  console.log("[FB Radar Background] Bắt đầu mở Tab Treo. Đang kéo dữ liệu mới nhất từ Database...");
  
  // 1. Kéo cấu hình mới nhất trực tiếp từ Database
  const aggregated = await syncLatestConfigFromDatabase();
  const groups = (aggregated && Array.isArray(aggregated.groups)) ? aggregated.groups : [];

  const enabledGroups = groups.filter(g => g && g.url && g.enabled !== false);

  let targetUrl = "https://www.facebook.com/groups/feed/?sorting_setting=CHRONOLOGICAL#fbradar_runner";
  if (enabledGroups.length > 0) {
    targetUrl = buildRunnerUrl(enabledGroups[0].url);
  }

  chrome.storage.local.get(["runnerTabId"], async (stored) => {
    let runnerId = stored.runnerTabId;

    if (runnerId) {
      try {
        const tab = await chrome.tabs.get(runnerId);
        if (tab) {
          // Tab vẫn tồn tại, điều hướng tới nhóm mới và đưa tab lên trên
          chrome.tabs.update(runnerId, { active: true, url: targetUrl });
          if (tab.windowId) {
            chrome.windows.update(tab.windowId, { focused: true });
          }
          return;
        }
      } catch (err) {
        // Tab không tồn tại, sẽ tạo mới bên dưới
      }
    }

    // Tạo tab treo mới
    chrome.tabs.create({ url: targetUrl }, (newTab) => {
      chrome.storage.local.set({
        runnerTabId: newTab.id,
        runnerStatus: "Đang khởi tạo Tab Treo...",
        currentRunningGroup: targetUrl
      });
      // Gửi heartbeat lên database
      SupabaseClient.sendHeartbeat("Đang khởi tạo Tab Treo...", targetUrl).catch(() => {});
    });
  });
}

// Lắng nghe khi tab bị đóng để cập nhật trạng thái Tab Treo
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get(["runnerTabId"], (stored) => {
    if (stored.runnerTabId === tabId) {
      console.log("[FB Radar Background] Tab Treo đã bị đóng.");
      chrome.storage.local.set({
        runnerTabId: null,
        runnerStatus: "Tab Treo đã đóng",
        currentRunningGroup: null
      });
      SupabaseClient.sendHeartbeat("Tab Treo đã đóng", null).catch(() => {});
    }
  });
});

// Listener for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "OPEN_OR_FOCUS_RUNNER_TAB") {
    handleOpenOrFocusRunnerTab();
    sendResponse({ ok: true });
  } else if (message.action === "REFRESH_DATABASE_CONFIG") {
    // Popup hoặc tab yêu cầu đồng bộ database ngay lập tức
    syncLatestConfigFromDatabase().then((aggregated) => {
      sendResponse({ ok: true, data: aggregated });
    });
    return true; // Phản hồi bất đồng bộ
  } else if (message.action === "NEW_MATCHED_POST") {
    const post = message.post;
    console.log("[FB Radar Background] Nhận bài viết khớp:", post);

    // Lưu bài viết lên Supabase Cloud kèm mapping tài khoản
    SupabaseClient.savePost(post).catch(() => {});

    chrome.storage.local.get(null, (config) => {
      if (config.desktopNotify !== false) {
        showDesktopNotification(post);
      }
      if (config.tgBotToken && config.tgChatId) {
        sendTelegramAlert(config, post);
      }
    });
    sendResponse({ ok: true });
  } else if (message.action === "UPDATE_RUNNER_STATUS") {
    chrome.storage.local.set({
      runnerStatus: message.status,
      currentRunningGroup: message.currentGroup || null
    });
    // Gửi heartbeat trạng thái Tab Treo lên Supabase
    SupabaseClient.sendHeartbeat(message.status, message.currentGroup).catch(() => {});
    sendResponse({ ok: true });
  } else if (message.action === "CHECK_AM_I_RUNNER") {
    chrome.storage.local.get(["runnerTabId"], (stored) => {
      const isRunnerId = sender.tab && stored.runnerTabId === sender.tab.id;
      const isRunnerUrl = sender.tab && sender.tab.url && sender.tab.url.includes("fbradar_runner");
      sendResponse({ isRunner: !!(isRunnerId || isRunnerUrl) });
    });
    return true;
  } else if (message.action === "NAVIGATE_OR_RELOAD_RUNNER") {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      if (message.isReload) {
        console.log("[FB Radar Background] Tải lại trang Tab Treo:", tabId);
        chrome.tabs.reload(tabId, { bypassCache: false }, () => {
          if (sendResponse) sendResponse({ ok: true });
        });
      } else if (message.url) {
        console.log("[FB Radar Background] Điều hướng Tab Treo sang:", message.url);
        chrome.tabs.update(tabId, { url: message.url }, () => {
          if (sendResponse) sendResponse({ ok: true });
        });
      }
    }
    return true;
  }

  return true;
});

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[m]);
}
