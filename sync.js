(function () {
  const SYNC_ID_KEY = "billManagerSyncId";
  const DEFAULT_SYNC_ID = "prince-bill-manager";

  let db = null;
  let pushTimer = null;
  let ignoreRemote = false;
  let statusText = "Local only";
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

  function setSyncId(id) {
    const trimmed = (id || "").trim();
    if (!trimmed) return false;
    localStorage.setItem(SYNC_ID_KEY, trimmed);
    return true;
  }

  function isConfigured() {
    return (
      window.FIREBASE_ENABLED === true &&
      window.FIREBASE_CONFIG &&
      window.FIREBASE_CONFIG.databaseURL
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
      setStatus("Cloud sync error — check firebase-config.js");
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
      setStatus("Sync failed — file may be too large or offline");
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
        setStatus("☁️ Synced across devices");
      } catch (e) {
        /* status set in pushPayload */
      }
    }, 800);
  }

  async function syncNow() {
    if (!db) {
      setStatus("⚠️ Local only — enable Firebase to sync");
      return;
    }
    setStatus("Syncing…");
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
        setStatus("☁️ Synced across devices");
        return;
      }

      const localTime = local.updatedAt || 0;
      const cloudTime = cloud.updatedAt || 0;

      if (cloudTime >= localTime) {
        if (onDataCallback) onDataCallback(cloud);
      } else {
        await pushPayload({
          folders: local.folders,
          updatedAt: Date.now()
        });
      }
      setStatus("☁️ Synced across devices");
    } catch (e) {
      setStatus("Sync failed — check internet & Firebase setup");
    }
  }

  function startListener() {
    if (!db) return;
    db.ref(cloudPath()).on("value", function (snap) {
      if (ignoreRemote || !onDataCallback) return;
      const cloud = normalizePayload(snap.val());
      if (!cloud) return;
      const local = getLocalCallback();
      if (cloud.updatedAt >= (local.updatedAt || 0)) {
        onDataCallback(cloud);
        setStatus("☁️ Synced across devices");
      }
    });
  }

  async function init(options) {
    onDataCallback = options.onData;
    getLocalCallback = options.getLocal;

    if (!isConfigured()) {
      setStatus("⚠️ Local only — enable Firebase to sync");
      return;
    }

    if (!initDb()) {
      setStatus("⚠️ Local only — check firebase-config.js");
      return;
    }

    setStatus("Connecting to cloud…");

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
        const localTime = local.updatedAt || 0;
        const cloudTime = cloud.updatedAt || 0;
        if (cloudTime >= localTime) {
          onDataCallback(cloud);
        } else {
          await pushPayload({
            folders: local.folders,
            updatedAt: Date.now()
          });
        }
      }

      startListener();
      setStatus("☁️ Synced across devices");
    } catch (e) {
      console.error(e);
      setStatus("⚠️ Sync failed — tap Sync to retry");
    }
  }

  window.BillSync = {
    init: init,
    syncNow: syncNow,
    schedulePush: schedulePush,
    isConfigured: isConfigured,
    getSyncId: getSyncId,
    setSyncId: setSyncId,
    getStatus: function () {
      return statusText;
    }
  };
})();
