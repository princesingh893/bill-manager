/////////////////////////////////////////////////
// VERSION CHECK
/////////////////////////////////////////////////
const APP_VERSION = "20260516h";
const storedVersion = localStorage.getItem("appVersion");
if (storedVersion !== APP_VERSION) {
  localStorage.setItem("appVersion", APP_VERSION);
  window.location.reload(true);
}

/////////////////////////////////////////////////
// GLOBAL HELPER
/////////////////////////////////////////////////
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/////////////////////////////////////////////////
// STORAGE
/////////////////////////////////////////////////
function loadFoldersFromStorage() {
  try {
    const data = JSON.parse(localStorage.getItem("folders"));
    if (!Array.isArray(data)) return [];
    return data.map((f, i) => ({
      id: f.id || "folder_" + i + "_" + Date.now(),
      name: f.name || "Unnamed",
      files: Array.isArray(f.files) ? f.files : []
    }));
  } catch (e) {
    return [];
  }
}

function getLocalUpdatedAt() {
  return parseInt(localStorage.getItem("foldersUpdatedAt") || "0", 10);
}

function setLocalUpdatedAt(time) {
  localStorage.setItem("foldersUpdatedAt", String(time || Date.now()));
}

function saveFolders() {
  try {
    localStorage.setItem("folders", JSON.stringify(folders));
    setLocalUpdatedAt(Date.now());
  } catch (e) {
    alert("Could not save — storage may be full. Try smaller images or delete old bills.");
    throw e;
  }
  if (window.BillSync) BillSync.schedulePush();
  if (typeof renderGlobalCalendar === "function") renderGlobalCalendar();
}

function applyFoldersFromCloud(payload) {
  if (!payload || !Array.isArray(payload.folders)) return;
  folders = payload.folders.map((f, i) => ({
    id: f.id || "folder_" + i + "_" + Date.now(),
    name: f.name || "Unnamed",
    files: Array.isArray(f.files) ? f.files : []
  }));
  localStorage.setItem("folders", JSON.stringify(folders));
  if (payload.updatedAt) setLocalUpdatedAt(payload.updatedAt);
  window.dispatchEvent(new CustomEvent("foldersUpdated"));
  if (typeof renderGlobalCalendar === "function") renderGlobalCalendar();
}

function guessMime(fileName, dataUrl) {
  if (dataUrl && String(dataUrl).startsWith("data:")) {
    const m = String(dataUrl).match(/^data:([^;]+);/);
    if (m) return m[1];
  }
  const ext = (fileName || "").split(".").pop().toLowerCase();
  const map = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif"
  };
  return map[ext] || "application/octet-stream";
}

let billViewerRevokeUrl = null;
function closeBillViewer() {
  const viewer = document.getElementById("billViewer");
  if (!viewer) return;
  viewer.classList.remove("open");
  viewer.setAttribute("aria-hidden", "true");
  const body = document.getElementById("billViewerBody");
  if (body) body.innerHTML = "";
  if (billViewerRevokeUrl) {
    URL.revokeObjectURL(billViewerRevokeUrl);
    billViewerRevokeUrl = null;
  }
}

function initBillViewer() {
  const viewer = document.getElementById("billViewer");
  if (!viewer || viewer.dataset.ready) return;
  viewer.dataset.ready = "1";
  const backdrop = document.getElementById("billViewerBackdrop");
  const closeBtn = document.getElementById("billViewerClose");
  if (backdrop) backdrop.onclick = closeBillViewer;
  if (closeBtn) closeBtn.onclick = closeBillViewer;
}

function showBillViewer(fileName, viewUrl, mime, downloadUrl) {
  initBillViewer();
  const viewer = document.getElementById("billViewer");
  const body = document.getElementById("billViewerBody");
  const title = document.getElementById("billViewerTitle");
  const downloadLink = document.getElementById("billViewerDownload");
  const newTabLink = document.getElementById("billViewerNewTab");
  if (!viewer || !body) return;
  title.textContent = fileName || "Bill";
  body.innerHTML = "";
  const isPdf = (mime || "").includes("pdf") || /\.pdf$/i.test(fileName || "");
  const isImage = (mime || "").startsWith("image/");
  if (isImage) {
    const img = document.createElement("img");
    img.src = viewUrl;
    img.alt = fileName || "Bill image";
    body.appendChild(img);
  } else if (isPdf) {
    const iframe = document.createElement("iframe");
    iframe.src = viewUrl;
    iframe.title = fileName || "Bill PDF";
    body.appendChild(iframe);
  } else {
    body.innerHTML = '<p class="emptyHint">Preview not available. Use Download or Open in new tab.</p>';
  }
  if (downloadLink) {
    downloadLink.href = downloadUrl || viewUrl;
    downloadLink.download = fileName || "bill";
  }
  if (newTabLink) newTabLink.href = downloadUrl || viewUrl;
  viewer.classList.add("open");
  viewer.setAttribute("aria-hidden", "false");
}

window.openBillFile = async function (data, fileName, mimeType) {
  if (!data) {
    alert("Could not open file. Data may be missing — try uploading again.");
    return;
  }
  closeBillViewer();
  try {
    let blob;
    if (typeof data === "string" && (data.startsWith("data:") || data.startsWith("blob:") || data.startsWith("http"))) {
      const response = await fetch(data);
      blob = await response.blob();
    } else {
      throw new Error("Unsupported file format");
    }
    if (billViewerRevokeUrl) URL.revokeObjectURL(billViewerRevokeUrl);
    billViewerRevokeUrl = URL.createObjectURL(blob);
    showBillViewer(fileName, billViewerRevokeUrl, blob.type || mimeType, billViewerRevokeUrl);
  } catch (err) {
    console.error(err);
    alert("Could not open file. Please upload it again.");
  }
};

const ADMIN_PASSWORD = "Princek89360";
const AUTH_SESSION_KEY = "billManagerAuth";
let passwordModalCallback = null;

function isPasswordAuthorized() { return sessionStorage.getItem(AUTH_SESSION_KEY) === "1"; }
function authorizeSession() { sessionStorage.setItem(AUTH_SESSION_KEY, "1"); }

function initPasswordModal() {
  if (document.getElementById("passwordModal")) return;
  const modal = document.createElement("div");
  modal.id = "passwordModal";
  modal.className = "passwordModal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="passwordModalBackdrop" id="passwordModalBackdrop"></div>
    <div class="passwordModalPanel" role="dialog" aria-labelledby="passwordModalTitle">
      <h2 id="passwordModalTitle" class="passwordModalTitle">Enter password</h2>
      <p class="passwordModalHint">Create, rename and delete require your password.</p>
      <input type="password" id="passwordInput" class="searchInput" placeholder="Password" autocomplete="off">
      <div class="passwordModalActions">
        <button type="button" class="btn btnGhost" id="passwordCancel">Cancel</button>
        <button type="button" class="btn btnPrimary" id="passwordConfirm">Continue</button>
      </div>
      <p id="passwordError" class="passwordError hidden">Wrong password. Try again.</p>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("passwordModalBackdrop").onclick = hidePasswordModal;
  document.getElementById("passwordCancel").onclick = hidePasswordModal;
  document.getElementById("passwordConfirm").onclick = submitPasswordModal;
  document.getElementById("passwordInput").onkeydown = (e) => {
    if (e.key === "Enter") submitPasswordModal();
    if (e.key === "Escape") hidePasswordModal();
  };
}

function showPasswordModal(onSuccess) {
  initPasswordModal();
  passwordModalCallback = onSuccess;
  const modal = document.getElementById("passwordModal");
  const input = document.getElementById("passwordInput");
  const err = document.getElementById("passwordError");
  if (!modal) return;
  input.value = "";
  err.classList.add("hidden");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  setTimeout(() => input.focus(), 50);
}

function hidePasswordModal() {
  const modal = document.getElementById("passwordModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  passwordModalCallback = null;
}

function submitPasswordModal() {
  const input = document.getElementById("passwordInput");
  const err = document.getElementById("passwordError");
  if (input.value === ADMIN_PASSWORD) {
    authorizeSession();
    hidePasswordModal();
    const cb = passwordModalCallback;
    passwordModalCallback = null;
    if (cb) cb();
    return;
  }
  err.classList.remove("hidden");
  input.value = "";
  input.focus();
}

function requirePassword(onSuccess) {
  if (isPasswordAuthorized()) {
    onSuccess();
    return;
  }
  showPasswordModal(onSuccess);
}

let folders = [];

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatMonthYear(year, month) {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function getFolderById(id) { return folders.find((f) => f.id === id); }

function uniqueBillDates(files) {
  const set = new Set();
  (files || []).forEach((f) => { if (f.date) set.add(f.date); });
  return [...set].sort().reverse();
}

window.goBack = function () { window.location.href = "index.html"; };

/////////////////////////////////////////////////
// GLOBAL CALENDAR (ALL FOLDERS)
/////////////////////////////////////////////////
function getAllBillsByDate() {
  const map = new Map();
  folders.forEach(folder => {
    (folder.files || []).forEach(file => {
      if (file.date) {
        if (!map.has(file.date)) map.set(file.date, []);
        map.get(file.date).push({
          folderName: folder.name,
          folderId: folder.id,
          fileName: file.name,
          fileData: file.data,
          mime: file.mime
        });
      }
    });
  });
  return map;
}

let globalViewYear = new Date().getFullYear();
let globalViewMonth = new Date().getMonth();

function renderGlobalCalendar() {
  const container = document.getElementById("globalCalendar");
  const monthLabel = document.getElementById("globalMonthLabel");
  if (!container) return;
  monthLabel.textContent = formatMonthYear(globalViewYear, globalViewMonth);

  const billMap = getAllBillsByDate();
  const first = new Date(globalViewYear, globalViewMonth, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(globalViewYear, globalViewMonth + 1, 0).getDate();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  let html = "";
  for (let i = 0; i < startDay; i++) html += '<div class="dayEmpty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = globalViewYear + "-" + String(globalViewMonth + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    const hasBill = billMap.has(iso);
    const isToday = iso === todayStr;
    let cls = hasBill ? "dayMark" : "day";
    if (isToday) cls += " dayToday";
    html += `<div class="${cls}" data-date="${iso}">${d}</div>`;
  }
  container.innerHTML = html;

  container.querySelectorAll('[data-date]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showBillsForDate(el.getAttribute('data-date'));
    });
  });
}

function showBillsForDate(date) {
  const billMap = getAllBillsByDate();
  const bills = billMap.get(date) || [];
  const modal = document.getElementById("dateBillModal");
  const title = document.getElementById("dateBillTitle");
  const listDiv = document.getElementById("dateBillList");
  if (!modal || !listDiv) return;

  title.textContent = `📄 Bills on ${formatDate(date)}`;
  listDiv.innerHTML = "";

  if (bills.length === 0) {
    listDiv.innerHTML = '<p class="emptyHint">No bills on this date.</p>';
  } else {
    bills.forEach(bill => {
      const card = document.createElement("div");
      card.className = "fileRow";
      card.innerHTML = `
        <div class="fileRowInfo">
          <div><strong>${escapeHtml(bill.folderName)}</strong></div>
          <div class="fileRowName">${escapeHtml(bill.fileName)}</div>
        </div>
        <div class="fileRowBtns">
          <button class="btnOpen">Open</button>
          <button class="btnGhost" style="background:#f1f5f9;" data-newtab>New Tab</button>
        </div>
      `;
      const openBtn = card.querySelector(".btnOpen");
      openBtn.onclick = () => openBillFile(bill.fileData, bill.fileName, bill.mime);
      const newTabBtn = card.querySelector("[data-newtab]");
      newTabBtn.onclick = async () => {
        let blob;
        try {
          if (typeof bill.fileData === "string" && bill.fileData.startsWith("data:")) {
            const response = await fetch(bill.fileData);
            blob = await response.blob();
          } else {
            blob = await fetch(bill.fileData).then(r => r.blob());
          }
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
          console.error(err);
          alert("Could not open in new tab");
        }
      };
      listDiv.appendChild(card);
    });
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function initGlobalCalendar() {
  const prevBtn = document.getElementById("globalPrevMonth");
  const nextBtn = document.getElementById("globalNextMonth");
  if (prevBtn) prevBtn.onclick = () => {
    globalViewMonth--;
    if (globalViewMonth < 0) { globalViewMonth = 11; globalViewYear--; }
    renderGlobalCalendar();
  };
  if (nextBtn) nextBtn.onclick = () => {
    globalViewMonth++;
    if (globalViewMonth > 11) { globalViewMonth = 0; globalViewYear++; }
    renderGlobalCalendar();
  };
  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
  const weekdayDiv = document.getElementById("globalCalWeekdays");
  if (weekdayDiv) weekdayDiv.innerHTML = weekdays.map(w => `<div class="calWeekday">${w}</div>`).join("");
  renderGlobalCalendar();

  const modal = document.getElementById("dateBillModal");
  if (modal) {
    const backdrop = document.getElementById("dateBillBackdrop");
    const closeBtn = document.getElementById("dateBillClose");
    if (backdrop) backdrop.onclick = () => modal.classList.remove("open");
    if (closeBtn) closeBtn.onclick = () => modal.classList.remove("open");
  }
}

/////////////////////////////////////////////////
// HOME PAGE
/////////////////////////////////////////////////
function initHomePage() {
  if (!document.getElementById("folderList")) return;
  const list = document.getElementById("folderList");
  const search = document.getElementById("search");
  const emptyHint = document.getElementById("emptyHint");

  function showFolders(data) {
    list.innerHTML = "";
    if (!Array.isArray(data) || data.length === 0) {
      emptyHint.classList.remove("hidden");
      return;
    }
    emptyHint.classList.add("hidden");
    data.forEach((f) => {
      const count = (f.files || []).length;
      const dates = uniqueBillDates(f.files);
      const lastDate = dates[0] ? formatDate(dates[0]) : "No bills yet";
      const card = document.createElement("div");
      card.className = "card";
      const main = document.createElement("div");
      main.className = "cardMain";
      main.innerHTML = `
        <span class="cardIcon">📁</span>
        <div class="cardInfo">
          <p class="cardName">${escapeHtml(f.name)}</p>
          <p class="cardMeta">${count} bill${count === 1 ? "" : "s"} · Last: ${escapeHtml(lastDate)}</p>
        </div>
      `;
      main.onclick = () => {
        localStorage.setItem("currentFolderId", f.id);
        window.location.href = "folder.html";
      };
      const actions = document.createElement("div");
      actions.className = "cardActions";
      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "btn btnGhost";
      renameBtn.textContent = "✏️ Rename";
      renameBtn.onclick = (e) => {
        e.stopPropagation();
        renameFolder(f.id);
      };
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btnDanger";
      delBtn.textContent = "🗑️ Delete";
      delBtn.onclick = (e) => {
        e.stopPropagation();
        deleteFolder(f.id);
      };
      actions.appendChild(renameBtn);
      actions.appendChild(delBtn);
      card.appendChild(main);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  showFolders(folders);

  window.createFolder = function () {
    requirePassword(() => {
      if (!Array.isArray(folders)) folders = [];
      const input = document.getElementById("folderName");
      const name = input.value.trim();
      if (!name) return alert("Enter a party name");

      folders.push({
        id: "folder_" + Date.now(),
        name: name,
        files: []
      });
      saveFolders();
      input.value = "";
      const filterText = search.value.trim();
      showFolders(
        filterText
          ? folders.filter((f) => f.name.toLowerCase().includes(filterText))
          : folders
      );
    });
  };

  window.renameFolder = function (id) {
    requirePassword(() => {
      const folder = getFolderById(id);
      if (!folder) return;
      const newName = prompt("New name:", folder.name);
      if (newName === null) return;
      const trimmed = newName.trim();
      if (!trimmed) return alert("Name cannot be empty");
      folder.name = trimmed;
      saveFolders();
      const filterText = search.value.trim();
      showFolders(
        filterText
          ? folders.filter((f) => f.name.toLowerCase().includes(filterText))
          : folders
      );
    });
  };

  window.deleteFolder = function (id) {
    requirePassword(() => {
      const folder = getFolderById(id);
      if (!folder) return;
      const ok = confirm('Delete "' + folder.name + '" and all its bills?\nThis cannot be undone.');
      if (!ok) return;
      folders = folders.filter((f) => f.id !== id);
      saveFolders();
      const filterText = search.value.trim();
      showFolders(
        filterText
          ? folders.filter((f) => f.name.toLowerCase().includes(filterText))
          : folders
      );
      const currentFolderId = localStorage.getItem("currentFolderId");
      if (currentFolderId === id) window.location.href = "index.html";
    });
  };

  search.oninput = () => {
    const filterText = search.value.trim();
    showFolders(
      filterText
        ? folders.filter((f) => f.name.toLowerCase().includes(filterText))
        : folders
    );
  };

  window.addEventListener("foldersUpdated", () => {
    const filterText = search.value.trim();
    showFolders(
      filterText
        ? folders.filter((f) => f.name.toLowerCase().includes(filterText))
        : folders
    );
    renderGlobalCalendar();
  });
}

/////////////////////////////////////////////////
// FOLDER PAGE
/////////////////////////////////////////////////
function initFolderPage() {
  if (!document.getElementById("fileInput")) return;
  const folderId = localStorage.getItem("currentFolderId") ||
    (() => {
      const oldIndex = localStorage.getItem("currentFolder");
      if (oldIndex !== null && folders[oldIndex]) return folders[oldIndex].id;
      return null;
    })();

  if (!folderId || !getFolderById(folderId)) {
    alert("Folder not found");
    window.location.href = "index.html";
    return;
  }

  let folder = getFolderById(folderId);
  localStorage.setItem("currentFolderId", folder.id);

  const fileList = document.getElementById("fileList");
  const title = document.getElementById("folderTitle");
  const billSummary = document.getElementById("billSummary");
  const noFilesHint = document.getElementById("noFilesHint");
  const dateInput = document.getElementById("billDateInput");
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth();

  title.textContent = "📁 " + folder.name;
  updateSummary();

  function updateSummary() {
    const dates = uniqueBillDates(folder.files);
    if (dates.length === 0) {
      billSummary.textContent = "No bills yet";
    } else {
      billSummary.textContent = "Bills on " + dates.length + " day" + (dates.length === 1 ? "" : "s") +
        " · " + dates.map(formatDate).slice(0, 3).join(", ") + (dates.length > 3 ? "…" : "");
    }
  }

  function showFiles() {
    if (!fileList) return;
    fileList.innerHTML = "";
    const files = [...(folder.files || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    if (files.length === 0) {
      if (noFilesHint) noFilesHint.classList.remove("hidden");
      return;
    }
    if (noFilesHint) noFilesHint.classList.add("hidden");

    files.forEach((f, idx) => {
      const realIndex = folder.files.indexOf(f);
      const row = document.createElement("div");
      row.className = "fileRow";
      row.innerHTML = `
        <div class="fileRowInfo">
          <span class="fileRowName">${escapeHtml(f.name)}</span>
          <span class="fileRowDate">📅 ${formatDate(f.date)}</span>
        </div>
        <div class="fileRowBtns">
          <button type="button" class="btnOpen" data-idx="${realIndex}">Open</button>
          <button type="button" class="btnDelFile" data-idx="${realIndex}">Delete</button>
        </div>
      `;
      row.querySelector(".btnOpen").onclick = () => openBillFile(f.data, f.name, f.mime);
      row.querySelector(".btnDelFile").onclick = () => deleteFile(realIndex);
      fileList.appendChild(row);
    });
  }

  function renderCalendar() {
    const cal = document.getElementById("calendar");
    const monthLabel = document.getElementById("monthLabel");
    if (!cal || !monthLabel) return;
    monthLabel.textContent = formatMonthYear(viewYear, viewMonth);

    const billDates = (() => {
      const set = new Set();
      (folder.files || []).forEach((f) => { if (f.date) set.add(f.date); });
      return set;
    })();

    const first = new Date(viewYear, viewMonth, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    let html = "";
    for (let i = 0; i < startDay; i++) html += '<div class="dayEmpty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = viewYear + "-" + String(viewMonth + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
      const hasBill = billDates.has(iso);
      const isToday = iso === todayStr;
      let cls = hasBill ? "dayMark" : "day";
      if (isToday) cls += " dayToday";
      html += `<div class="${cls}">${d}</div>`;
    }
    cal.innerHTML = html;
  }

  function renderDateLegend() {
    const legend = document.getElementById("dateLegend");
    if (!legend) return;
    const dates = uniqueBillDates(folder.files);
    if (dates.length === 0) {
      legend.innerHTML = '<p class="emptyHint" style="margin:0">No bill dates yet. Upload a bill to mark dates on the calendar.</p>';
      return;
    }
    legend.innerHTML = dates.map(d => `<div class="legendItem"><span class="legendDot"></span>${formatDate(d)}</div>`).join("");
  }

  const prevBtn = document.getElementById("prevMonth");
  const nextBtn = document.getElementById("nextMonth");
  if (prevBtn) prevBtn.onclick = () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCalendar();
  };
  if (nextBtn) nextBtn.onclick = () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  };

  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
  const calWeekdays = document.getElementById("calWeekdays");
  if (calWeekdays) calWeekdays.innerHTML = weekdays.map(w => `<div class="calWeekday">${w}</div>`).join("");

  window.uploadFile = function () {
    const fileInput = document.getElementById("fileInput");
    const dateInputEl = document.getElementById("billDateInput");
    if (!fileInput) return;
    const file = fileInput.files[0];
    if (!file) return alert("Select a file first");
    let billDate = dateInputEl ? dateInputEl.value : "";
    if (!billDate) billDate = new Date().toISOString().slice(0, 10);
    const reader = new FileReader();
    reader.onload = function () {
      folder.files.push({
        name: file.name,
        data: reader.result,
        mime: file.type || guessMime(file.name, reader.result),
        date: billDate
      });
      saveFolders();
      fileInput.value = "";
      if (dateInputEl) dateInputEl.value = new Date().toISOString().slice(0, 10);
      showFiles();
      renderCalendar();
      renderDateLegend();
      updateSummary();
      renderGlobalCalendar();
    };
    reader.readAsDataURL(file);
  };

  window.deleteFile = function (index) {
    requirePassword(() => {
      if (!confirm("Delete this bill?")) return;
      folder.files.splice(index, 1);
      saveFolders();
      showFiles();
      renderCalendar();
      renderDateLegend();
      updateSummary();
      renderGlobalCalendar();
    });
  };

  window.addEventListener("foldersUpdated", function () {
    const updated = getFolderById(folderId);
    if (!updated) {
      window.location.href = "index.html";
      return;
    }
    folder = updated;
    title.textContent = "📁 " + folder.name;
    updateSummary();
    showFiles();
    renderCalendar();
    renderDateLegend();
    renderGlobalCalendar();
  });

  initBillViewer();
  showFiles();
  renderCalendar();
  renderDateLegend();
}

/////////////////////////////////////////////////
// BOOTSTRAP
/////////////////////////////////////////////////
async function bootstrapApp() {
  folders = loadFoldersFromStorage();
  if (!localStorage.getItem("foldersUpdatedAt") && folders.length) {
    setLocalUpdatedAt(Date.now());
  }
  if (window.BillSync) {
    await BillSync.init({
      onData: applyFoldersFromCloud,
      getLocal: () => ({ folders: folders, updatedAt: getLocalUpdatedAt() })
    });
  }
  initHomePage();
  initFolderPage();
  initGlobalCalendar();
  window.dispatchEvent(new Event("foldersReady"));
}

bootstrapApp();