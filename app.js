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

function saveFolders() {
  try {
    localStorage.setItem("folders", JSON.stringify(folders));
  } catch (e) {
    alert(
      "Could not save — storage may be full. Try smaller images or delete old bills."
    );
    throw e;
  }
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

function dataUrlToBlob(dataUrl, fallbackMime) {
  const str = String(dataUrl);
  const match = str.match(/^data:([^;]*);base64,(.+)$/s);
  if (!match) throw new Error("Invalid file data");
  const mime = match[1] || fallbackMime || "application/octet-stream";
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

let billViewerRevokeUrl = null;

function closeBillViewer() {
  const viewer = document.getElementById("billViewer");
  if (!viewer) return;
  viewer.classList.remove("open");
  viewer.setAttribute("aria-hidden", "true");
  document.getElementById("billViewerBody").innerHTML = "";
  if (billViewerRevokeUrl) {
    URL.revokeObjectURL(billViewerRevokeUrl);
    billViewerRevokeUrl = null;
  }
}

function initBillViewer() {
  const viewer = document.getElementById("billViewer");
  if (!viewer || viewer.dataset.ready) return;
  viewer.dataset.ready = "1";
  document.getElementById("billViewerBackdrop").onclick = closeBillViewer;
  document.getElementById("billViewerClose").onclick = closeBillViewer;
}

function showBillViewer(fileName, viewUrl, mime, downloadUrl) {
  initBillViewer();
  const viewer = document.getElementById("billViewer");
  const body = document.getElementById("billViewerBody");
  const title = document.getElementById("billViewerTitle");
  const downloadLink = document.getElementById("billViewerDownload");
  const newTabLink = document.getElementById("billViewerNewTab");

  title.textContent = fileName || "Bill";
  body.innerHTML = "";

  const isPdf =
    (mime || "").includes("pdf") || /\.pdf$/i.test(fileName || "");
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
    body.innerHTML =
      '<p class="emptyHint">Preview not available for this file type. Use Download or Open in new tab.</p>';
  }

  downloadLink.href = downloadUrl || viewUrl;
  downloadLink.download = fileName || "bill";
  newTabLink.href = downloadUrl || viewUrl;

  viewer.classList.add("open");
  viewer.setAttribute("aria-hidden", "false");
}

window.openBillFile = async function (data, fileName, mimeType) {
  if (!data) {
    alert("Could not open file. Data may be missing — try uploading again.");
    return;
  }

  closeBillViewer();

  const mime = mimeType || guessMime(fileName, data);
  let blob;

  try {
    blob = dataUrlToBlob(data, mime);
  } catch (e1) {
    try {
      const res = await fetch(data);
      blob = await res.blob();
    } catch (e2) {
      if (String(data).startsWith("data:")) {
        showBillViewer(fileName, data, mime, data);
        return;
      }
      alert("Could not open file. Please upload it again.");
      return;
    }
  }

  if (billViewerRevokeUrl) URL.revokeObjectURL(billViewerRevokeUrl);
  billViewerRevokeUrl = URL.createObjectURL(blob);
  showBillViewer(
    fileName,
    billViewerRevokeUrl,
    blob.type || mime,
    billViewerRevokeUrl
  );
};

const ADMIN_PASSWORD = "Princek89360";
const AUTH_SESSION_KEY = "billManagerAuth";

let passwordModalCallback = null;

function isPasswordAuthorized() {
  return sessionStorage.getItem(AUTH_SESSION_KEY) === "1";
}

function authorizeSession() {
  sessionStorage.setItem(AUTH_SESSION_KEY, "1");
}

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
      <p class="passwordModalHint">Rename and delete require your password.</p>
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

let folders = loadFoldersFromStorage();

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatMonthYear(year, month) {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function getFolderById(id) {
  return folders.find((f) => f.id === id);
}

function uniqueBillDates(files) {
  const set = new Set();
  (files || []).forEach((f) => {
    if (f.date) set.add(f.date);
  });
  return [...set].sort().reverse();
}

window.goBack = function () {
  window.location.href = "index.html";
};

/////////////////////////////////////////////////
// HOME PAGE
/////////////////////////////////////////////////
if (document.getElementById("folderList")) {
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

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showFolders(folders);

  window.createFolder = function () {
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
    showFolders(folders);
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
      showFolders(
        search.value.trim()
          ? folders.filter((f) =>
              f.name.toLowerCase().includes(search.value.toLowerCase())
            )
          : folders
      );
    });
  };

  window.deleteFolder = function (id) {
    requirePassword(() => {
      const folder = getFolderById(id);
      if (!folder) return;
      const ok = confirm(
        'Delete "' + folder.name + '" and all its bills?\nThis cannot be undone.'
      );
      if (!ok) return;
      folders = folders.filter((f) => f.id !== id);
      saveFolders();
      showFolders(
        search.value.trim()
          ? folders.filter((f) =>
              f.name.toLowerCase().includes(search.value.toLowerCase())
            )
          : folders
      );
    });
  };

  search.oninput = () => {
    const text = search.value.toLowerCase().trim();
    const filtered = text
      ? folders.filter((f) => f.name.toLowerCase().includes(text))
      : folders;
    showFolders(filtered);
  };
}

/////////////////////////////////////////////////
// FOLDER PAGE
/////////////////////////////////////////////////
if (document.getElementById("fileInput")) {
  const folderId =
    localStorage.getItem("currentFolderId") ||
    (() => {
      const oldIndex = localStorage.getItem("currentFolder");
      if (oldIndex !== null && folders[oldIndex]) {
        return folders[oldIndex].id;
      }
      return null;
    })();

  if (!folderId || !getFolderById(folderId)) {
    alert("Folder not found");
    window.location.href = "index.html";
  }

  const folder = getFolderById(folderId);
  localStorage.setItem("currentFolderId", folder.id);

  const fileList = document.getElementById("fileList");
  const title = document.getElementById("folderTitle");
  const billSummary = document.getElementById("billSummary");
  const noFilesHint = document.getElementById("noFilesHint");

  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth();

  title.textContent = "📁 " + folder.name;
  updateSummary();

  function updateSummary() {
    const dates = uniqueBillDates(folder.files);
    if (dates.length === 0) {
      billSummary.textContent = "No bills yet";
    } else {
      billSummary.textContent =
        "Bills on " +
        dates.length +
        " day" +
        (dates.length === 1 ? "" : "s") +
        " · " +
        dates.map(formatDate).slice(0, 3).join(", ") +
        (dates.length > 3 ? "…" : "");
    }
  }

  showFiles();
  renderCalendar();
  renderDateLegend();

  document.getElementById("prevMonth").onclick = () => {
    viewMonth--;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear--;
    }
    renderCalendar();
  };

  document.getElementById("nextMonth").onclick = () => {
    viewMonth++;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear++;
    }
    renderCalendar();
  };

  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
  const calWeekdays = document.getElementById("calWeekdays");
  calWeekdays.innerHTML = weekdays
    .map((w) => `<div class="calWeekday">${w}</div>`)
    .join("");

  function getBillDateSet() {
    const set = new Set();
    (folder.files || []).forEach((f) => {
      if (f.date) set.add(f.date);
    });
    return set;
  }

  function renderCalendar() {
    const cal = document.getElementById("calendar");
    const monthLabel = document.getElementById("monthLabel");
    monthLabel.textContent = formatMonthYear(viewYear, viewMonth);

    const billDates = getBillDateSet();
    const first = new Date(viewYear, viewMonth, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    let html = "";
    for (let i = 0; i < startDay; i++) {
      html += '<div class="dayEmpty"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso =
        viewYear +
        "-" +
        String(viewMonth + 1).padStart(2, "0") +
        "-" +
        String(d).padStart(2, "0");
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
    const dates = uniqueBillDates(folder.files);
    if (dates.length === 0) {
      legend.innerHTML =
        '<p class="emptyHint" style="margin:0">No bill dates yet. Upload a bill to mark dates on the calendar.</p>';
      return;
    }
    legend.innerHTML = dates
      .map(
        (d) =>
          `<div class="legendItem"><span class="legendDot"></span>${formatDate(d)}</div>`
      )
      .join("");
  }

  window.uploadFile = function () {
    const file = document.getElementById("fileInput").files[0];
    if (!file) return alert("Select a file first");

    const reader = new FileReader();
    reader.onload = function () {
      const today = new Date().toISOString().slice(0, 10);
      folder.files.push({
        name: file.name,
        data: reader.result,
        mime: file.type || guessMime(file.name, reader.result),
        date: today
      });
      saveFolders();
      document.getElementById("fileInput").value = "";
      showFiles();
      renderCalendar();
      renderDateLegend();
      updateSummary();
    };
    reader.readAsDataURL(file);
  };

  function showFiles() {
    fileList.innerHTML = "";
    const files = [...(folder.files || [])].sort(
      (a, b) => (b.date || "").localeCompare(a.date || "")
    );

    if (files.length === 0) {
      noFilesHint.classList.remove("hidden");
      return;
    }
    noFilesHint.classList.add("hidden");

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
      row.querySelector(".btnOpen").onclick = () =>
        openBillFile(f.data, f.name, f.mime);
      row.querySelector(".btnDelFile").onclick = () => deleteFile(realIndex);
      fileList.appendChild(row);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  initBillViewer();

  window.deleteFile = function (index) {
    requirePassword(() => {
      if (!confirm("Delete this bill?")) return;
      folder.files.splice(index, 1);
      saveFolders();
      showFiles();
      renderCalendar();
      renderDateLegend();
      updateSummary();
    });
  };
}
