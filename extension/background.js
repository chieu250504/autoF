/**
 * FB Group Keyword Radar - Background Service Worker (Manifest V3)
 * Orchestrates Single Tab Runner, Notifications, Telegram, and Direct Supabase Cloud Sync
 */

importScripts("supabase.js");

console.log("%c[FB Radar Background]%c Service worker initialized with Direct Database Sync.", "color: #1877f2; font-weight: bold;", "color: inherit;");

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

let isOpeningTab = false;

/**
 * Kiểm tra lệnh Bật từ Web Dashboard ngay cả khi chưa mở tab Facebook nào.
 * Nếu phát hiện enabled: true trên Cloud mà chưa có Tab Treo -> Tự động mở Facebook!
 */
async function checkRemoteRunnerCommand() {
  try {
    const aggregated = await syncLatestConfigFromDatabase();

    chrome.storage.local.get(["runnerTabId"], async (stored) => {
      let runnerId = stored.runnerTabId;
      let isTabAlive = false;

      if (runnerId) {
        try {
          const tab = await chrome.tabs.get(runnerId);
          if (tab && tab.url && (tab.url.includes("facebook.com") || tab.url.includes("fbradar_runner"))) {
            isTabAlive = true;
          } else {
            chrome.storage.local.set({ runnerTabId: null });
            isTabAlive = false;
          }
        } catch (e) {
          chrome.storage.local.set({ runnerTabId: null });
          isTabAlive = false;
        }
      }

      // Nếu Web Dashboard gửi lệnh BẬT quét
      if (aggregated && aggregated.enabled) {
        // NẾU CHƯA CÓ TAB TREO NÀO HOẠT ĐỘNG -> TỰ ĐỘNG MỞ TAB FACEBOOK ĐỂ QUÉT!
        if (!isTabAlive && !isOpeningTab) {
          isOpeningTab = true;
          console.log("%c[FB Radar Background]%c Phát hiện lệnh BẬT từ Web Dashboard mà chưa có Tab Treo -> Tự động mở Facebook!", "color: #10b981; font-weight: bold;", "color: inherit;");
          try {
            await handleOpenOrFocusRunnerTab();
          } catch (err) {
            console.error("[FB Radar Background] Lỗi không mở được Tab Treo:", err);
            await SupabaseClient.setMasterEnabled(false);
            SupabaseClient.sendHeartbeat("Lỗi: Không thể mở Tab Facebook", null).catch(() => {});
          } finally {
            setTimeout(() => { isOpeningTab = false; }, 3000);
          }
        }
      } else {
        // NẾU WEB DASHBOARD ĐÃ TẮT QUÉT MÀ TAB TREO VẪN ĐANG MỞ -> TỰ ĐỘNG ĐÓNG TAB VÀ DỪNG!
        if (isTabAlive) {
          console.log("[FB Radar Background] Phát hiện lệnh TẮT từ Web Dashboard -> Đang dừng Tab Treo!");
          await handleStopRunnerTab(true);
        } else {
          // Nếu không có Tab Treo nào chạy, gửi nhịp tim định kỳ từ Background
          // để Web Dashboard luôn nhận biết trình duyệt Chrome đang bật và sẵn sàng nhận lệnh
          SupabaseClient.sendHeartbeat("Trình duyệt Chrome sẵn sàng (Chờ lệnh)", null).catch(() => {});
        }
      }
    });
  } catch (err) {
    console.warn("[FB Radar Background] Lỗi checkRemoteRunnerCommand:", err);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log("[FB Radar Background] Extension installed/updated. Đang nạp cấu hình từ Supabase Database...");

  // Thiết lập Alarm định kỳ 30 giây để kiểm tra lệnh điều khiển từ xa
  chrome.alarms.create("sync_supabase_config", { periodInMinutes: 0.5 });

  // Kiểm tra ngay khi extension được nạp
  await checkRemoteRunnerCommand();
});

// Khi trình duyệt Chrome khởi động
chrome.runtime.onStartup.addListener(async () => {
  console.log("[FB Radar Background] Trình duyệt Chrome khởi động. Đang kiểm tra lệnh quét từ xa...");
  await checkRemoteRunnerCommand();
});

// Lắng nghe alarm để liên tục kiểm tra lệnh Bật/Tắt từ Web Dashboard
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "sync_supabase_config") {
    await checkRemoteRunnerCommand();
  }
});

// Thăm dò định kỳ mỗi 2.5 giây khi Service Worker đang thức
setInterval(() => {
  checkRemoteRunnerCommand();
}, 2500);

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
  console.log("[FB Radar Background] Bắt đầu mở Tab Treo. Đang kích hoạt và kéo dữ liệu mới nhất từ Database...");
  
  // 1. Kích hoạt enabled trên Database và local storage
  try {
    await SupabaseClient.setMasterEnabled(true);
  } catch (e) {
    console.warn("[FB Radar Background] Không thể cập nhật trạng thái master trên DB:", e);
  }

  // 2. Kéo cấu hình mới nhất trực tiếp từ Database
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
          chrome.storage.local.set({
            enabled: true,
            runnerStatus: "Đang bắt đầu quét...",
            currentRunningGroup: targetUrl
          });
          SupabaseClient.sendHeartbeat("Đang bắt đầu quét...", targetUrl).catch(() => {});
          return;
        }
      } catch (err) {
        // Tab không tồn tại, sẽ tạo mới bên dưới
      }
    }

    // Kiểm tra xem có tab Facebook nào đang mở sẵn có hashtag #fbradar_runner không
    chrome.tabs.query({ url: "*://*.facebook.com/*" }, (tabs) => {
      const existingRunner = tabs.find(t => t.url && t.url.includes("fbradar_runner"));
      if (existingRunner) {
        chrome.tabs.update(existingRunner.id, { active: true, url: targetUrl });
        if (existingRunner.windowId) {
          chrome.windows.update(existingRunner.windowId, { focused: true });
        }
        chrome.storage.local.set({
          enabled: true,
          runnerTabId: existingRunner.id,
          runnerStatus: "Đang bắt đầu quét...",
          currentRunningGroup: targetUrl
        });
        SupabaseClient.sendHeartbeat("Đang bắt đầu quét...", targetUrl).catch(() => {});
        return;
      }

      // Tạo tab treo mới sang một tab khác
      chrome.tabs.create({ url: targetUrl, active: true }, (newTab) => {
        chrome.storage.local.set({
          enabled: true,
          runnerTabId: newTab.id,
          runnerStatus: "Đang khởi tạo Tab Treo...",
          currentRunningGroup: targetUrl
        });
        // Gửi heartbeat lên database
        SupabaseClient.sendHeartbeat("Đang khởi tạo Tab Treo...", targetUrl).catch(() => {});
      });
    });
  });
}

// Dừng Tab Treo và chuyển trạng thái quét về OFF
async function handleStopRunnerTab(closeTab = true) {
  console.log("[FB Radar Background] Đang tắt quét và đóng Tab Treo...");
  try {
    await SupabaseClient.setMasterEnabled(false);
  } catch (e) {
    console.warn("[FB Radar Background] Lỗi tắt master trên DB:", e);
  }

  chrome.storage.local.get(["runnerTabId"], async (stored) => {
    const runnerId = stored.runnerTabId;
    if (runnerId && closeTab) {
      try {
        await chrome.tabs.remove(runnerId);
      } catch (err) {
        // Tab có thể đã được người dùng đóng từ trước
      }
    }

    const updated = {
      enabled: false,
      runnerTabId: null,
      runnerStatus: "Đã dừng quét",
      currentRunningGroup: null
    };

    chrome.storage.local.set(updated, () => {
      broadcastConfig(updated);
    });

    SupabaseClient.sendHeartbeat("Đã dừng quét", null).catch(() => {});
  });
}

// Lắng nghe khi tab bị đóng để cập nhật trạng thái Tab Treo và đồng bộ tắt lên Cloud
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get(["runnerTabId"], async (stored) => {
    if (stored.runnerTabId === tabId) {
      console.log("[FB Radar Background] Tab Treo đã bị đóng -> Đồng bộ tắt quét về Database.");
      try {
        await SupabaseClient.setMasterEnabled(false);
      } catch (e) {
        console.warn("[FB Radar Background] Lỗi tắt master trên DB khi tab đóng:", e);
      }
      const updated = {
        enabled: false,
        runnerTabId: null,
        runnerStatus: "Tab Treo đã đóng",
        currentRunningGroup: null
      };
      chrome.storage.local.set(updated, () => {
        broadcastConfig(updated);
      });
      SupabaseClient.sendHeartbeat("Tab Treo đã đóng", null).catch(() => {});
    }
  });
});

// Listener for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "START_RUNNER") {
    handleOpenOrFocusRunnerTab().then(() => {
      sendResponse({ ok: true });
    });
    return true;
  } else if (message.action === "STOP_RUNNER") {
    handleStopRunnerTab(message.closeTab !== false).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  } else if (message.action === "OPEN_OR_FOCUS_RUNNER_TAB") {
    handleOpenOrFocusRunnerTab().then(() => {
      sendResponse({ ok: true });
    });
    return true;
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
      if (config.tgBotToken && config.tgChatId) {
        sendTelegramAlert(config, post);
      }
    });
    sendResponse({ ok: true });
  } else if (message.action === "UPDATE_RUNNER_STATUS") {
    const tabId = sender.tab ? sender.tab.id : null;
    const storeObj = {
      runnerStatus: message.status,
      currentRunningGroup: message.currentGroup || null
    };
    if (tabId) {
      storeObj.runnerTabId = tabId;
    }
    chrome.storage.local.set(storeObj);
    // Gửi heartbeat trạng thái Tab Treo lên Supabase
    SupabaseClient.sendHeartbeat(message.status, message.currentGroup).catch(() => {});
    sendResponse({ ok: true });
  } else if (message.action === "CHECK_AM_I_RUNNER") {
    chrome.storage.local.get(["runnerTabId"], (stored) => {
      const isRunnerId = Boolean(sender.tab && stored.runnerTabId === sender.tab.id);
      const isRunnerUrl = Boolean(sender.tab && sender.tab.url && sender.tab.url.includes("fbradar_runner"));
      const isRunner = isRunnerId || isRunnerUrl;
      if (isRunner && sender.tab && sender.tab.id && stored.runnerTabId !== sender.tab.id) {
        chrome.storage.local.set({ runnerTabId: sender.tab.id });
      }
      sendResponse({ isRunner });
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
