// Default configuration
const DEFAULT_CONFIG = {
  enabled: false,
  keywords: ["tuyển dụng", "báo giá", "cần tìm"],
  groups: [], // Array of objects: { url: string, enabled: boolean, name?: string }
  reloadMinutes: 0.75, // Tạm thời để 0.75 phút (~45s, dao động 31s - 59s) để test luân phiên nhanh
  jitterPercent: 30,
  scrollSpeed: "medium",
  maxScrollSteps: 4,
  soundEnabled: true,
  desktopNotify: true,
  tgBotToken: "",
  tgChatId: "",
  logs: [],
  runnerStatus: "Chưa chạy",
  currentRunningGroup: null
};

let currentConfig = { ...DEFAULT_CONFIG };

// DOM Elements
const masterToggle = document.getElementById("masterToggle");
const statusText = document.getElementById("statusText");
const runnerDot = document.getElementById("runnerDot");
const runnerStatusText = document.getElementById("runnerStatusText");
const openRunnerBtn = document.getElementById("openRunnerBtn");

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanes = document.querySelectorAll(".tab-pane");

const keywordInput = document.getElementById("keywordInput");
const addKeywordBtn = document.getElementById("addKeywordBtn");
const keywordTagsContainer = document.getElementById("keywordTags");
const keywordCount = document.getElementById("keywordCount");

const groupInput = document.getElementById("groupInput");
const addGroupBtn = document.getElementById("addGroupBtn");
const groupListContainer = document.getElementById("groupList");
const groupCount = document.getElementById("groupCount");

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

const logsContainer = document.getElementById("logsList");
const clearLogsBtn = document.getElementById("clearLogsBtn");
const exportExcelBtn = document.getElementById("exportExcelBtn");
const saveBtn = document.getElementById("saveBtn");
const saveToast = document.getElementById("saveToast");

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupEventListeners();
  await loadConfig();
  listenToStorageChanges();
});

// Setup Tab Switching
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

// Setup Event Listeners
function setupEventListeners() {
  masterToggle.addEventListener("change", () => {
    currentConfig.enabled = masterToggle.checked;
    updateStatusUI();
    saveConfig(true);
  });

  // Mở / Focus vào Tab Treo
  openRunnerBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "OPEN_OR_FOCUS_RUNNER_TAB" }).catch(() => {});
  });

  addKeywordBtn.addEventListener("click", addKeyword);
  keywordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  });

  addGroupBtn.addEventListener("click", addGroup);
  groupInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addGroup();
    }
  });

  reloadMinutesInput.addEventListener("input", updateTimingPreview);
  jitterPercentInput.addEventListener("input", () => {
    jitterDisplay.textContent = `±${jitterPercentInput.value}%`;
    updateTimingPreview();
  });

  testTelegramBtn.addEventListener("click", testTelegram);

  // Xuất Excel
  exportExcelBtn.addEventListener("click", exportToExcel);

  clearLogsBtn.addEventListener("click", () => {
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử bài viết?")) {
      currentConfig.logs = [];
      renderLogs();
      chrome.storage.local.set({ logs: [] });
    }
  });

  saveBtn.addEventListener("click", () => saveConfig(false));
}

// Listen for storage changes across tabs to update popup UI in real-time
function listenToStorageChanges() {
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.logs) {
      currentConfig.logs = changes.logs.newValue || [];
      renderLogs();
    }
    if (changes.runnerStatus) {
      currentConfig.runnerStatus = changes.runnerStatus.newValue;
      updateRunnerBarUI();
    }
    if (changes.currentRunningGroup) {
      currentConfig.currentRunningGroup = changes.currentRunningGroup.newValue;
      renderGroups();
    }
    if (changes.enabled) {
      currentConfig.enabled = changes.enabled.newValue;
      masterToggle.checked = !!currentConfig.enabled;
      updateStatusUI();
    }
  });
}

// Timing preview
function updateTimingPreview() {
  const baseMinutes = parseFloat(reloadMinutesInput.value) || 0.75;
  const jitter = parseInt(jitterPercentInput.value, 10) || 0;

  const minMin = Math.max(0.4, baseMinutes * (1 - jitter / 100));
  const maxMin = baseMinutes * (1 + jitter / 100);

  const formatMinSec = (val) => {
    const mins = Math.floor(val);
    const secs = Math.round((val - mins) * 60);
    return secs > 0 ? `${mins}p ${secs}s` : `${mins} phút`;
  };

  const enabledCount = (currentConfig.groups || []).filter(g => g.enabled !== false && g.url).length || 1;
  const loopMinStr = formatMinSec(minMin * enabledCount);
  const loopMaxStr = formatMinSec(maxMin * enabledCount);

  let loopInfo = "";
  if (enabledCount > 1) {
    loopInfo = `<br>🔁 Vòng lặp <b>${enabledCount} nhóm</b>: mỗi nhóm được quét lại sau khoảng <b>${loopMinStr} ~ ${loopMaxStr}</b>.`;
  }

  calcPreview.innerHTML = `Thời gian dừng ở mỗi nhóm: <b>${formatMinSec(minMin)} ~ ${formatMinSec(maxMin)}</b> (ngẫu nhiên).${loopInfo}`;
}

// Keywords
function addKeyword() {
  const val = keywordInput.value.trim();
  if (!val) return;
  if (!currentConfig.keywords.includes(val)) {
    currentConfig.keywords.push(val);
    renderKeywords();
  }
  keywordInput.value = "";
}

function removeKeyword(index) {
  currentConfig.keywords.splice(index, 1);
  renderKeywords();
}

function renderKeywords() {
  keywordTagsContainer.innerHTML = "";
  currentConfig.keywords.forEach((kw, index) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.innerHTML = `
      <span>${escapeHtml(kw)}</span>
      <span class="tag-remove" data-index="${index}">&times;</span>
    `;
    tag.querySelector(".tag-remove").addEventListener("click", () => removeKeyword(index));
    keywordTagsContainer.appendChild(tag);
  });
  keywordCount.textContent = `${currentConfig.keywords.length} từ khóa`;
}

// Helper: Normalize group items to { url, enabled, name, scrollSteps, reloadMinutes }
function normalizeGroup(item) {
  if (typeof item === "string") {
    return { url: item, enabled: true, name: extractGroupName(item), scrollSteps: 0, reloadMinutes: 0 };
  }
  return {
    url: item.url || "",
    enabled: item.enabled !== false,
    name: item.name || extractGroupName(item.url || ""),
    scrollSteps: parseInt(item.scrollSteps, 10) || 0,
    reloadMinutes: parseFloat(item.reloadMinutes) || 0
  };
}

function extractGroupName(url) {
  try {
    const m = url.match(/\/groups\/([^\/?#]+)/);
    return m ? `Nhóm: ${m[1]}` : url.replace(/^https?:\/\//, "");
  } catch (e) {
    return url;
  }
}

// Groups
function addGroup() {
  let val = groupInput.value.trim();
  if (!val) return;

  if (!val.startsWith("http://") && !val.startsWith("https://")) {
    val = "https://" + val;
  }

  // Check if exists
  const exists = currentConfig.groups.some(g => {
    const u = typeof g === "string" ? g : g.url;
    return u.toLowerCase() === val.toLowerCase();
  });

  if (!exists) {
    currentConfig.groups.push({
      url: val,
      enabled: true,
      name: extractGroupName(val),
      scrollSteps: 0,
      reloadMinutes: 0
    });
    renderGroups();
  }
  groupInput.value = "";
}

function toggleGroupEnabled(index) {
  currentConfig.groups[index].enabled = !currentConfig.groups[index].enabled;
  renderGroups();
  saveConfig(true);
}

function removeGroup(index) {
  currentConfig.groups.splice(index, 1);
  renderGroups();
  saveConfig(true);
}

function renderGroups() {
  groupListContainer.innerHTML = "";

  // Normalize groups
  currentConfig.groups = currentConfig.groups.map(normalizeGroup);

  const enabledCount = currentConfig.groups.filter(g => g.enabled).length;
  groupCount.textContent = `${enabledCount}/${currentConfig.groups.length} nhóm đang bật`;

  if (currentConfig.groups.length === 0) {
    groupListContainer.innerHTML = `<div class="empty-state" style="padding: 10px 0;">Chưa thêm link nhóm nào.</div>`;
    return;
  }

  currentConfig.groups.forEach((g, index) => {
    const isCurrent = currentConfig.currentRunningGroup && 
      (currentConfig.currentRunningGroup.toLowerCase() === g.url.toLowerCase());

    const hasCustomParams = (g.scrollSteps > 0) || (g.reloadMinutes > 0);
    const badgeText = hasCustomParams
      ? `⚡ ${g.scrollSteps > 0 ? g.scrollSteps + " cuộn" : "cuộn mặc định"} | ${g.reloadMinutes > 0 ? g.reloadMinutes + "p" : "dừng mặc định"}`
      : "";

    const item = document.createElement("div");
    item.className = `group-item ${g.enabled ? "" : "disabled"} ${isCurrent ? "current-running" : ""}`;

    item.innerHTML = `
      <div class="group-header-row">
        <input type="checkbox" class="group-checkbox" ${g.enabled ? "checked" : ""} title="Bật/Tắt theo dõi nhóm này" />
        <div class="group-content">
          <div class="group-url" title="${escapeHtml(g.url)}">
            ${isCurrent ? "🟢 <b>[Đang quét]</b> " : ""}${escapeHtml(g.url)}
          </div>
          ${badgeText ? `<span class="group-badge-params">${escapeHtml(badgeText)}</span>` : ""}
        </div>
        <button type="button" class="btn-group-toggle-config" title="Cài đặt riêng số bước cuộn & thời gian dừng cho nhóm này">⚙️</button>
        <span class="group-remove" title="Xóa nhóm">&times;</span>
      </div>
      <div class="group-custom-config-row" style="display: none;">
        <div class="group-param-col">
          <label>Nhịp cuộn nhóm này:</label>
          <input type="number" class="group-input-scroll" min="1" max="40" placeholder="Mặc định (${currentConfig.maxScrollSteps || 4})" value="${g.scrollSteps > 0 ? g.scrollSteps : ""}" />
        </div>
        <div class="group-param-col">
          <label>Thời gian dừng (phút):</label>
          <input type="number" class="group-input-reload" min="0.5" max="60" step="0.5" placeholder="Mặc định (${currentConfig.reloadMinutes || 3}p)" value="${g.reloadMinutes > 0 ? g.reloadMinutes : ""}" />
        </div>
      </div>
    `;

    // Event listeners
    item.querySelector(".group-checkbox").addEventListener("change", () => toggleGroupEnabled(index));
    item.querySelector(".group-remove").addEventListener("click", () => removeGroup(index));

    const toggleBtn = item.querySelector(".btn-group-toggle-config");
    const drawer = item.querySelector(".group-custom-config-row");
    toggleBtn.addEventListener("click", () => {
      drawer.style.display = (drawer.style.display === "none") ? "flex" : "none";
    });

    const scrollInput = item.querySelector(".group-input-scroll");
    const reloadInput = item.querySelector(".group-input-reload");

    const updateGroupParams = () => {
      const scrollVal = parseInt(scrollInput.value, 10);
      const reloadVal = parseFloat(reloadInput.value);

      currentConfig.groups[index].scrollSteps = (scrollVal > 0) ? scrollVal : 0;
      currentConfig.groups[index].reloadMinutes = (reloadVal > 0) ? reloadVal : 0;
      saveConfig(true);

      // Cập nhật badge hiển thị
      const customExists = (currentConfig.groups[index].scrollSteps > 0) || (currentConfig.groups[index].reloadMinutes > 0);
      let badgeEl = item.querySelector(".group-badge-params");
      if (customExists) {
        const text = `⚡ ${currentConfig.groups[index].scrollSteps > 0 ? currentConfig.groups[index].scrollSteps + " cuộn" : "cuộn mặc định"} | ${currentConfig.groups[index].reloadMinutes > 0 ? currentConfig.groups[index].reloadMinutes + "p" : "dừng mặc định"}`;
        if (!badgeEl) {
          badgeEl = document.createElement("span");
          badgeEl.className = "group-badge-params";
          item.querySelector(".group-content").appendChild(badgeEl);
        }
        badgeEl.textContent = text;
      } else if (badgeEl) {
        badgeEl.remove();
      }
    };

    scrollInput.addEventListener("change", updateGroupParams);
    reloadInput.addEventListener("change", updateGroupParams);

    groupListContainer.appendChild(item);
  });
}

// Test Telegram Sending
async function testTelegram() {
  const token = tgBotTokenInput.value.trim();
  const chatId = tgChatIdInput.value.trim();

  if (!token || !chatId) {
    tgTestResult.style.color = "#fa383e";
    tgTestResult.textContent = "Vui lòng nhập Token & Chat ID";
    return;
  }

  tgTestResult.style.color = "#65676b";
  tgTestResult.textContent = "Đang gửi thử...";

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🎯 [FB Radar] Kết nối thành công!\nBạn sẽ nhận thông báo bài đăng Facebook tại đây.",
        parse_mode: "HTML"
      })
    });

    const data = await res.json();
    if (data.ok) {
      tgTestResult.style.color = "#31a24c";
      tgTestResult.textContent = "Gửi thành công!";
    } else {
      tgTestResult.style.color = "#fa383e";
      tgTestResult.textContent = "Lỗi: " + (data.description || "Không hợp lệ");
    }
  } catch (err) {
    tgTestResult.style.color = "#fa383e";
    tgTestResult.textContent = "Lỗi kết nối mạng";
  }
}

// Sắp xếp bài viết: Bài mới đăng nhất lên trước
function getSortedLogs() {
  const logs = currentConfig.logs || [];
  return [...logs].sort((a, b) => {
    const timeA = a.postTimestamp || a.timestamp || 0;
    const timeB = b.postTimestamp || b.timestamp || 0;
    return timeB - timeA;
  });
}

// Logs
function renderLogs() {
  logsContainer.innerHTML = "";
  const logs = getSortedLogs();
  if (logs.length === 0) {
    logsContainer.innerHTML = `<div class="empty-state">Chưa có bài viết nào được phát hiện.</div>`;
    return;
  }

  logs.slice(0, 50).forEach(log => {
    const item = document.createElement("div");
    item.className = "log-item";
    const detectedStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "";
    const postTimeStr = log.postTime || "Vừa phát hiện";

    item.innerHTML = `
      <div class="log-time" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
        <span style="font-weight: 600; color: #050505;">🏢 ${escapeHtml(log.groupTitle || "Nhóm Facebook")}</span>
        <span style="color: #1877f2; font-weight: 700;">🕒 ${escapeHtml(postTimeStr)}</span>
      </div>
      <div style="font-size: 10px; color: #65676b; margin-bottom: 4px;">👁️ Bắt được lúc: ${detectedStr}</div>
      <span class="log-keywords">Từ khóa: ${escapeHtml(log.matchedKeyword || "Khớp")}</span>
      <div class="log-text">${escapeHtml(log.text || "")}</div>
      ${log.link ? `<a href="${escapeHtml(log.link)}" target="_blank" class="log-link">Mở bài viết &rarr;</a>` : ""}
    `;
    logsContainer.appendChild(item);
  });
}

// Xuất Lịch sử ra File Excel (.csv chuẩn UTF-8 BOM)
function exportToExcel() {
  const logs = getSortedLogs();
  if (logs.length === 0) {
    alert("Chưa có bài viết nào trong lịch sử để xuất Excel!");
    return;
  }

  // Tiền tố \uFEFF (Byte Order Mark) để Microsoft Excel mở UTF-8 không bị lỗi font tiếng Việt
  let csv = "\uFEFF";
  csv += "STT,Thời gian đăng bài,Thời gian phát hiện,Hội nhóm,Từ khóa khớp,Nội dung trích đoạn,Liên kết bài viết\r\n";

  logs.forEach((log, index) => {
    const stt = index + 1;
    const postTime = (log.postTime || "Vừa phát hiện").replace(/"/g, '""');
    const detectedTime = log.timestamp ? new Date(log.timestamp).toLocaleString("vi-VN") : "";
    const group = (log.groupTitle || "Nhóm Facebook").replace(/"/g, '""');
    const keyword = (log.matchedKeyword || "").replace(/"/g, '""');
    const text = (log.text || "").replace(/\r?\n|\r/g, " ").replace(/"/g, '""');
    const link = log.link || "";

    csv += `"${stt}","${postTime}","${detectedTime}","${group}","${keyword}","${text}","${link}"\r\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  a.href = url;
  a.download = `FB_Radar_Lich_Su_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Master status UI
function updateStatusUI() {
  if (currentConfig.enabled) {
    statusText.textContent = "ĐANG CHẠY";
    statusText.className = "status-badge on";
  } else {
    statusText.textContent = "ĐÃ TẮT";
    statusText.className = "status-badge off";
  }
  updateRunnerBarUI();
}

// Runner Bar UI
function updateRunnerBarUI() {
  if (!currentConfig.enabled) {
    runnerDot.className = "runner-dot";
    runnerStatusText.textContent = "Hệ thống đang tắt";
    openRunnerBtn.textContent = "🚀 Khởi động";
    return;
  }

  runnerDot.className = "runner-dot active";
  runnerStatusText.textContent = currentConfig.runnerStatus || "Tab Treo: Đang hoạt động";
  openRunnerBtn.textContent = "👁️ Đến Tab Treo";
}

// Load config
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_CONFIG, (stored) => {
      currentConfig = { ...DEFAULT_CONFIG, ...stored };

      // Ensure groups are normalized
      if (Array.isArray(currentConfig.groups)) {
        currentConfig.groups = currentConfig.groups.map(normalizeGroup);
      }

      masterToggle.checked = !!currentConfig.enabled;
      updateStatusUI();

      renderKeywords();
      renderGroups();

      reloadMinutesInput.value = currentConfig.reloadMinutes || 0.75;
      jitterPercentInput.value = currentConfig.jitterPercent || 30;
      jitterDisplay.textContent = `±${jitterPercentInput.value}%`;
      scrollSpeedSelect.value = currentConfig.scrollSpeed || "medium";
      maxScrollStepsInput.value = currentConfig.maxScrollSteps || 4;

      soundEnabledInput.checked = currentConfig.soundEnabled !== false;
      desktopNotifyInput.checked = currentConfig.desktopNotify !== false;
      tgBotTokenInput.value = currentConfig.tgBotToken || "";
      tgChatIdInput.value = currentConfig.tgChatId || "";

      updateTimingPreview();
      renderLogs();
      updateRunnerBarUI();

      // Đồng bộ lấy bài viết mới nhất từ Supabase Cloud
      if (typeof SupabaseClient !== "undefined") {
        SupabaseClient.fetchPosts(50).then(cloudPosts => {
          if (cloudPosts && cloudPosts.length > 0) {
            const existingIds = new Set((currentConfig.logs || []).map(l => String(l.id)));
            let hasNew = false;
            cloudPosts.forEach(cp => {
              if (!existingIds.has(String(cp.id))) {
                currentConfig.logs.push(cp);
                hasNew = true;
              }
            });
            if (hasNew) {
              chrome.storage.local.set({ logs: currentConfig.logs });
              renderLogs();
            }
          }
        }).catch(() => {});
      }

      resolve();
    });
  });
}

// Save config
function saveConfig(isSilent = false) {
  currentConfig.enabled = masterToggle.checked;
  currentConfig.reloadMinutes = Math.max(0.4, parseFloat(reloadMinutesInput.value) || 0.75);
  currentConfig.jitterPercent = parseInt(jitterPercentInput.value, 10) || 0;
  currentConfig.scrollSpeed = scrollSpeedSelect.value;
  currentConfig.maxScrollSteps = parseInt(maxScrollStepsInput.value, 10) || 4;

  currentConfig.soundEnabled = soundEnabledInput.checked;
  currentConfig.desktopNotify = desktopNotifyInput.checked;
  currentConfig.tgBotToken = tgBotTokenInput.value.trim();
  currentConfig.tgChatId = tgChatIdInput.value.trim();

  // Đẩy cấu hình lên Supabase Cloud
  if (typeof SupabaseClient !== "undefined") {
    SupabaseClient.pushConfig(currentConfig).catch(() => {});
  }

  chrome.storage.local.set(currentConfig, () => {
    chrome.runtime.sendMessage({ action: "CONFIG_UPDATED", config: currentConfig }).catch(() => {});

    if (!isSilent) {
      saveToast.style.display = "block";
      setTimeout(() => {
        saveToast.style.display = "none";
      }, 2000);
    }
  });
}

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
