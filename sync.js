(function () {
  const SYNC_ID_KEY = "billManagerSyncId";
  const DEFAULT_SYNC_ID = "prince-bill-manager";

  let db = null;
  let pushTimer = null;
  let ignoreRemote = false;
  let statusText = "Loading…";
  let onDataCallback = null;
  let getLocalCallback = null;

  function getSyncId() {
    let id = localStorage.getItem(SYNC_ID_KEY);
    if (!id) {
      id = DEFAULT_SYNC_ID;
      localStorage.setItem(SYNC_ID_KEY, id);
    }
    return id;
  }

  function isConfigured() {
    const c = window.FIREBASE_CONFIG || {};
    return (
      window.FIREBASE_ENABLED === true &&
      c.databaseURL &&
      c.apiKey &&
      c.apiKey !== "PASTE_YOUR_API_KEY"
    );
  }

  function cloudPath() {
    return "billManager/" + getSyncId();
  }

  function setStatus(msg) {
    statusText = msg;
    const el = document.getElementById("syncStatusText");
    if (el) el.textContent = msg;
  }

  function initDb() {
    if (!isConfigured() || typeof firebase === "undefined") return false;
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(window.FIREBASE_CONFIG);
      }
      db = firebase.database();
      return true;
    } catch (e) {
      console.error(e);
      setStatus("Cloud error — check firebase-config.js");
      return false;
    }
  }

  function normalizePayload(val) {
    if (!val || !Array.isArray(val.folders)) return null;
    return {
      folders: val.folders,
      updatedAt: val.updatedAt || 0
    };
  }

  async function pullOnce() {
    if (!db) return null;
    const snap = await db.ref(cloudPath()).once("value");
    return normalizePayload(snap.val());
  }

  async function pushPayload(payload) {
    if (!db) return;
    ignoreRemote = true;
    try {
      await db.ref(cloudPath()).set(payload);
    } catch (e) {
      console.error(e);
      setStatus("Save failed — bill image may be too large");
      throw e;
    } finally {
      setTimeout(function () {
        ignoreRemote = false;
      }, 400);
    }
  }

  function schedulePush() {
    if (!db || !getLocalCallback) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async function () {
      try {
        const local = getLocalCallback();
        await pushPayload({
          folders: local.folders,
          updatedAt: local.updatedAt || Date.now()
        });
        setStatus("☁️ All devices — same data on this URL");
      } catch (e) {
        /* set in pushPayload */
      }
    }, 600);
  }

  function mergeOnLoad(local, cloud) {
    const localHas =
      local.folders && local.folders.length > 0;
    const cloudHas = cloud.folders && cloud.folders.length > 0;
    const localTime = local.updatedAt || 0;
    const cloudTime = cloud.updatedAt || 0;

    if (cloudHas && (!localHas || cloudTime >= localTime)) {
      return { action: "useCloud", cloud: cloud };
    }
    if (localHas) {
      return { action: "pushLocal", local: local };
    }
    return { action: "none" };
  }

  function startListener() {
    if (!db) return;
    db.ref(cloudPath()).on("value", function (snap) {
      if (ignoreRemote || !onDataCallback) return;
      const cloud = normalizePayload(snap.val());
      if (!cloud || !cloud.folders.length) return;
      const local = getLocalCallback();
      if (cloud.updatedAt >= (local.updatedAt || 0)) {
        onDataCallback(cloud);
        setStatus("☁️ All devices — same data on this URL");
      }
    });
  }

  async function init(options) {
    onDataCallback = options.onData;
    getLocalCallback = options.getLocal;

    if (!isConfigured()) {
      setStatus("⚠️ Cloud off — add Firebase keys in firebase-config.js");
      return;
    }

    if (!initDb()) return;

    setStatus("Loading bills from cloud…");

    try {
      const local = getLocalCallback();
      const cloud = await pullOnce();

      if (!cloud) {
        if (local.folders && local.folders.length) {
          await pushPayload({
            folders: local.folders,
            updatedAt: Date.now()
          });
        }
      } else {
        const merged = mergeOnLoad(local, cloud);
        if (merged.action === "useCloud") {
          onDataCallback(merged.cloud);
        } else if (merged.action === "pushLocal") {
          await pushPayload({
            folders: merged.local.folders,
            updatedAt: Date.now()
          });
        }
      }

      startListener();
      setStatus("☁️ All devices — same data on this URL");
    } catch (e) {
      console.error(e);
      setStatus("⚠️ Could not load cloud — check internet");
    }
  }

  window.BillSync = {
    init: init,
    schedulePush: schedulePush,
    isConfigured: isConfigured,
    getStatus: function () {
      return statusText;
    }
  };
})();
