/**
 * FB Group Keyword Radar - Popup Script
 * Hiển thị tổng quan thời gian thực từ Supabase Database, loại bỏ form nhập cục bộ
 */

// State
let dbOverviewData = {
  enabled: false,
  accounts: [],
  allAccounts: [],
  groups: [],
  allKeywords: [],
  keywordAccountMap: {},
  posts: [],
  runnerStatus: "Chưa chạy",
  currentRunningGroup: null
};

// DOM Elements
const masterToggle = document.getElementById("masterToggle");
const statusText = document.getElementById("statusText");
const refreshDbBtn = document.getElementById("refreshDbBtn");
const runnerDot = document.getElementById("runnerDot");
const runnerStatusText = document.getElementById("runnerStatusText");
const openRunnerBtn = document.getElementById("openRunnerBtn");

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanes = document.querySelectorAll(".tab-pane");

const statAccountsCount = document.getElementById("statAccountsCount");
const statGroupsCount = document.getElementById("statGroupsCount");
const statKeywordsCount = document.getElementById("statKeywordsCount");

const groupOverviewCount = document.getElementById("groupOverviewCount");
const dbGroupList = document.getElementById("dbGroupList");

const keywordOverviewCount = document.getElementById("keywordOverviewCount");
const dbKeywordTags = document.getElementById("dbKeywordTags");

const reloadMinutesInput = document.getElementById("reloadMinutes");
const jitterPercentInput = document.getElementById("jitterPercent");
const jitterDisplay = document.getElementById("jitterDisplay");
const calcPreview = document.getElementById("calcPreview");
const scrollSpeedSelect = document.getElementById("scrollSpeed");
const maxScrollStepsInput = document.getElementById("maxScrollSteps");

const soundEnabledInput = document.getElementById("soundEnabled");
const desktopNotifyInput = document.getElementById("desktopNotify");
const tgBotTokenInput = document.getElementById("tgBotToken");
const tgChatIdInput = document.getElementById("tgChatId");
const testTelegramBtn = document.getElementById("testTelegramBtn");
const tgTestResult = document.getElementById("tgTestResult");
const saveAlertsBtn = document.getElementById("saveAlertsBtn");

const logsContainer = document.getElementById("logsList");
const refreshPostsBtn = document.getElementById("refreshPostsBtn");
const exportExcelBtn = document.getElementById("exportExcelBtn");
const saveToast = document.getElementById("saveToast");

// Khởi tạo
document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupEventListeners();
  loadLocalAlertSettings();
  await refreshDatabaseOverview(false);
  listenToStorageChanges();
});

// Chuyển Tab
function setupTabs() {
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetTab = document.getElementById(btn.dataset.tab);
      if (targetTab) targetTab.classList.add("active");
    });
  });
}

// Cài đặt Event Listeners
function setupEventListeners() {
  // Nút Làm mới dữ liệu từ Database
  refreshDbBtn.addEventListener("click", async () => {
    refreshDbBtn.classList.add("spinning");
    await refreshDatabaseOverview(true);
    setTimeout(() => {
      refreshDbBtn.classList.remove("spinning");
    }, 600);
  });

  // Nút Bắt đầu / Mở Tab Treo (gọi lại API và mở tab theo nhóm mới nhất)
  openRunnerBtn.addEventListener("click", async () => {
    showToast("Đang kết nối Database và khởi động Tab Treo...");
    chrome.runtime.sendMessage({ action: "OPEN_OR_FOCUS_RUNNER_TAB" }).catch(() => {});
    // Làm mới hiển thị
    setTimeout(() => {
      refreshDatabaseOverview(false);
    }, 800);
  });

  // Master Toggle: Bật/Tắt quét toàn cục trên database
  masterToggle.addEventListener("change", async () => {
    const isChecked = masterToggle.checked;
    updateStatusUI(isChecked);
    
    // Gửi cập nhật trực tiếp lên Supabase
    try {
      await fetch(`${SUPABASE_CONFIG.url}/rest/v1/fbradar_config?id=eq.default`, {
        method: "PATCH",
        headers: SupabaseClient.getHeaders(),
        body: JSON.stringify({
          enabled: isChecked,
          updated_at: new Date().toISOString()
        })
      });

      // Kéo lại cấu hình mới nhất
      await refreshDatabaseOverview(false);
      showToast(isChecked ? "Đã bật quét!" : "Đã tắt quét!");
    } catch (err) {
      console.warn("Lỗi cập nhật toggle:", err);
    }
  });

  // Tab Hành vi: Preview thời gian
  if (reloadMinutesInput && jitterPercentInput) {
    reloadMinutesInput.addEventListener("input", updateTimingPreview);
    jitterPercentInput.addEventListener("input", () => {
      jitterDisplay.textContent = `±${jitterPercentInput.value}%`;
      updateTimingPreview();
    });
  }

  // Tab Thông báo: Test Telegram & Lưu
  testTelegramBtn.addEventListener("click", testTelegram);
  saveAlertsBtn.addEventListener("click", saveLocalAlertSettings);

  // Tab Lịch sử: Nút tải lại bài viết & Xuất CSV
  refreshPostsBtn.addEventListener("click", async () => {
    refreshPostsBtn.disabled = true;
    refreshPostsBtn.textContent = "Đang tải...";
    await loadRecentPosts();
    refreshPostsBtn.disabled = false;
    refreshPostsBtn.textContent = "🔄 Tải lại";
    showToast("Đã tải lại danh sách bài viết từ Database!");
  });

  exportExcelBtn.addEventListener("click", exportToExcel);
}

// Kéo và hiển thị dữ liệu tổng quan mới nhất từ Supabase Database
async function refreshDatabaseOverview(showNotification = false) {
  try {
    // 1. Kéo cấu hình hợp nhất đang hoạt động
    const aggregated = await SupabaseClient.pullAggregatedRunnerConfig();
    // 2. Kéo danh sách tất cả tài khoản
    const allAccounts = await SupabaseClient.fetchAllAccountConfigs();
    // 3. Đọc trạng thái runnerTab hiện tại từ local storage
    const localStored = await new Promise(r => chrome.storage.local.get(["runnerStatus", "currentRunningGroup"], r));

    dbOverviewData = {
      enabled: aggregated ? Boolean(aggregated.enabled) : false,
      accounts: aggregated ? (aggregated.accounts || []) : [],
      allAccounts: allAccounts || [],
      groups: aggregated ? (aggregated.groups || []) : [],
      allKeywords: aggregated ? (aggregated.allKeywords || []) : [],
      keywordAccountMap: aggregated ? (aggregated.keywordAccountMap || {}) : {},
      runnerStatus: localStored.runnerStatus || "Chưa chạy",
      currentRunningGroup: localStored.currentRunningGroup || null
    };

    // Render giao diện tổng quan
    renderOverviewUI();
    // Tải bài viết
    await loadRecentPosts();

    if (showNotification) {
      showToast("Đã làm mới dữ liệu từ Database thành công!");
    }
  } catch (err) {
    console.error("[FB Radar Popup] Lỗi nạp dữ liệu từ Database:", err);
    dbGroupList.innerHTML = `<div class="empty-state" style="color: #dc2626;">Lỗi tải dữ liệu: ${escapeHtml(err.message)}</div>`;
  }
}

// Render dữ liệu tổng quan lên HTML
function renderOverviewUI() {
  const isEnabled = dbOverviewData.enabled;
  masterToggle.checked = isEnabled;
  updateStatusUI(isEnabled);
  updateRunnerBarUI();

  // 1. Thống kê số lượng
  const activeAccountsCount = dbOverviewData.accounts.length;
  statAccountsCount.textContent = `${activeAccountsCount} TK`;
  statGroupsCount.textContent = String(dbOverviewData.groups.length);
  statKeywordsCount.textContent = String(dbOverviewData.allKeywords.length);

  groupOverviewCount.textContent = `${dbOverviewData.groups.length} nhóm`;
  keywordOverviewCount.textContent = `${dbOverviewData.allKeywords.length} từ khóa`;

  // 2. Render danh sách Hội Nhóm từ Database
  dbGroupList.innerHTML = "";
  if (dbOverviewData.groups.length === 0) {
    dbGroupList.innerHTML = `
      <div class="empty-state">
        Chưa có nhóm nào được bật từ các tài khoản trên Web Dashboard.<br>
        <span style="font-size: 10px; color: #94a3b8;">Vào Web Dashboard (localhost:3000) để thêm nhóm hoặc bật quét!</span>
      </div>`;
  } else {
    dbOverviewData.groups.forEach((g) => {
      const isCurrentRunning = dbOverviewData.currentRunningGroup && 
        (dbOverviewData.currentRunningGroup.toLowerCase().includes(g.canonicalUrl || g.url.toLowerCase()));

      const card = document.createElement("div");
      card.className = `group-card-item ${isCurrentRunning ? 'is-running' : ''}`;

      // Tạo nhãn tài khoản
      const accBadgesHtml = (g.accounts || []).map(accId => {
        const cls = accId === 'user1' ? 'user1' : (accId === 'user2' ? 'user2' : '');
        return `<span class="account-badge ${cls}">${escapeHtml(accId)}</span>`;
      }).join('');

      card.innerHTML = `
        <div class="group-card-top">
          <div class="group-title-row">
            <span class="group-name-text" title="${escapeHtml(g.name || g.url)}">
              ${isCurrentRunning ? '🟢 ' : ''}${escapeHtml(g.name || g.url)}
            </span>
          </div>
          <a href="${escapeHtml(g.url)}" target="_blank" class="group-link-icon" title="Mở nhóm trên Facebook">
            🔗 Mở nhóm
          </a>
        </div>
        <div class="group-meta-row">
          <div class="account-badge-group">
            ${accBadgesHtml}
          </div>
          <span class="group-params-pill">
            ⚡ ${g.scrollSteps || 8} cuộn | ⏱️ ${g.reloadMinutes || 10} phút
          </span>
        </div>
      `;
      dbGroupList.appendChild(card);
    });
  }

  // 3. Render danh sách Từ Khóa từ Database
  dbKeywordTags.innerHTML = "";
  if (dbOverviewData.allKeywords.length === 0) {
    dbKeywordTags.innerHTML = `<div class="empty-state" style="padding: 10px 0;">Chưa có từ khóa nào được thiết lập trên database.</div>`;
  } else {
    dbOverviewData.allKeywords.forEach((kw) => {
      const owners = dbOverviewData.keywordAccountMap[kw] || [];
      const tag = document.createElement("span");
      tag.className = "tag-item";
      
      const ownersText = owners.length > 0 ? owners.join(', ') : 'Tất cả';
      tag.innerHTML = `
        <span>#${escapeHtml(kw)}</span>
        <span class="tag-acc">${escapeHtml(ownersText)}</span>
      `;
      dbKeywordTags.appendChild(tag);
    });
  }
}

// Cập nhật trạng thái switch
function updateStatusUI(isOn) {
  if (isOn) {
    statusText.textContent = "ĐANG BẬT";
    statusText.className = "status-badge on";
  } else {
    statusText.textContent = "ĐÃ TẮT";
    statusText.className = "status-badge off";
  }
}

// Cập nhật Runner status bar
function updateRunnerBarUI() {
  const status = dbOverviewData.runnerStatus || "Chưa chạy";
  runnerStatusText.textContent = `Tab Treo: ${status}`;

  const isRunning = status.toLowerCase().includes("đang quét") || 
                    status.toLowerCase().includes("đổi sang") || 
                    status.toLowerCase().includes("lượt quét tới");

  if (isRunning) {
    runnerDot.className = "runner-dot active";
  } else {
    runnerDot.className = "runner-dot";
  }
}

// Tải bài viết từ bảng fbradar_posts trên Supabase
async function loadRecentPosts() {
  try {
    const posts = await SupabaseClient.fetchPosts(30);
    renderPostsList(posts);
  } catch (err) {
    console.warn("Lỗi tải bài viết:", err);
  }
}

function renderPostsList(posts) {
  logsContainer.innerHTML = "";
  if (!posts || posts.length === 0) {
    logsContainer.innerHTML = `<div class="empty-state">Chưa có bài viết nào được phát hiện trong Database.</div>`;
    return;
  }

  posts.forEach((post) => {
    const item = document.createElement("div");
    item.className = "log-item";

    const dateStr = post.postTime || new Date(post.timestamp).toLocaleTimeString("vi-VN");
    const accList = Array.isArray(post.accountIds) && post.accountIds.length > 0 
      ? ` [${post.accountIds.join(', ')}]` 
      : '';

    item.innerHTML = `
      <div class="log-top-row">
        <span class="log-keywords">🔑 ${escapeHtml(post.matchedKeyword || 'Từ khóa')}${escapeHtml(accList)}</span>
        <span class="log-time">${escapeHtml(dateStr)}</span>
      </div>
      <div class="log-text" title="${escapeHtml(post.text || '')}">${escapeHtml(post.text || 'Nội dung bài viết...')}</div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 3px;">
        <span style="font-size: 10px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px;">
          👥 ${escapeHtml(post.groupTitle || 'Nhóm Facebook')}
        </span>
        ${post.link ? `<a href="${escapeHtml(post.link)}" target="_blank" class="log-link">Xem bài viết ↗</a>` : ''}
      </div>
    `;
    logsContainer.appendChild(item);
  });
}

// Lắng nghe thay đổi storage từ background hoặc tab treo
function listenToStorageChanges() {
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.runnerStatus) {
      dbOverviewData.runnerStatus = changes.runnerStatus.newValue;
      updateRunnerBarUI();
    }
    if (changes.currentRunningGroup) {
      dbOverviewData.currentRunningGroup = changes.currentRunningGroup.newValue;
      renderOverviewUI();
    }
    if (changes.enabled) {
      dbOverviewData.enabled = changes.enabled.newValue;
      updateStatusUI(changes.enabled.newValue);
    }
  });
}

// Cài đặt thông báo cục bộ
function loadLocalAlertSettings() {
  chrome.storage.local.get(["soundEnabled", "desktopNotify", "tgBotToken", "tgChatId"], (res) => {
    if (soundEnabledInput) soundEnabledInput.checked = res.soundEnabled !== false;
    if (desktopNotifyInput) desktopNotifyInput.checked = res.desktopNotify !== false;
    if (tgBotTokenInput) tgBotTokenInput.value = res.tgBotToken || "";
    if (tgChatIdInput) tgChatIdInput.value = res.tgChatId || "";
  });
}

function saveLocalAlertSettings() {
  chrome.storage.local.set({
    soundEnabled: soundEnabledInput.checked,
    desktopNotify: desktopNotifyInput.checked,
    tgBotToken: tgBotTokenInput.value.trim(),
    tgChatId: tgChatIdInput.value.trim()
  }, () => {
    showToast("Đã lưu cài đặt thông báo!");
  });
}

// Gửi test Telegram
async function testTelegram() {
  const token = tgBotTokenInput.value.trim();
  const chatId = tgChatIdInput.value.trim();

  if (!token || !chatId) {
    tgTestResult.textContent = "Vui lòng nhập Bot Token và Chat ID";
    tgTestResult.style.color = "#dc2626";
    return;
  }

  tgTestResult.textContent = "Đang gửi...";
  tgTestResult.style.color = "#0284c7";

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🎯 <b>[FB Radar]</b> Kiểm tra kết nối Telegram thành công!",
        parse_mode: "HTML"
      })
    });
    const data = await res.json();
    if (data.ok) {
      tgTestResult.textContent = "Gửi thành công!";
      tgTestResult.style.color = "#16a34a";
    } else {
      tgTestResult.textContent = `Thất bại: ${data.description}`;
      tgTestResult.style.color = "#dc2626";
    }
  } catch (err) {
    tgTestResult.textContent = "Lỗi kết nối!";
    tgTestResult.style.color = "#dc2626";
  }
}

// Timing preview
function updateTimingPreview() {
  if (!reloadMinutesInput || !jitterPercentInput) return;
  const baseMinutes = parseFloat(reloadMinutesInput.value) || 5;
  const jitter = parseInt(jitterPercentInput.value, 10) || 20;

  const minMin = Math.max(0.4, baseMinutes * (1 - jitter / 100));
  const maxMin = baseMinutes * (1 + jitter / 100);

  const formatMinSec = (val) => {
    const mins = Math.floor(val);
    const secs = Math.round((val - mins) * 60);
    return secs > 0 ? `${mins}p ${secs}s` : `${mins} phút`;
  };

  calcPreview.innerHTML = `Nghỉ sau khi quét xong tất cả các nhóm: <b>${formatMinSec(minMin)} ~ ${formatMinSec(maxMin)}</b>.`;
}

// Xuất file CSV
async function exportToExcel() {
  try {
    const posts = await SupabaseClient.fetchPosts(200);
    if (!posts || posts.length === 0) {
      alert("Chưa có bài viết nào trong Database để xuất!");
      return;
    }

    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "STT,Thoi Gian,Nhom Facebook,Tu Khoa Khop,Tai Khoan,Noi Dung,Link Bai Viet\n";

    posts.forEach((post, index) => {
      const escapeCsv = (str) => `"${(str || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
      const timeStr = post.postTime || new Date(post.timestamp).toLocaleString("vi-VN");
      const accStr = (post.accountIds || []).join('; ');

      const row = [
        index + 1,
        escapeCsv(timeStr),
        escapeCsv(post.groupTitle || ''),
        escapeCsv(post.matchedKeyword || ''),
        escapeCsv(accStr),
        escapeCsv(post.text || ''),
        escapeCsv(post.link || '')
      ].join(",");

      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `FBRadar_Posts_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Lỗi xuất file: ${err.message}`);
  }
}

// Hiển thị Toast
function showToast(msg) {
  if (!saveToast) return;
  saveToast.textContent = msg;
  saveToast.style.display = "block";
  setTimeout(() => {
    saveToast.style.display = "none";
  }, 2200);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[m]);
}
