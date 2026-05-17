(function () {

  const SYNC_ID_KEY = "billManagerSyncId";
  const DEFAULT_SYNC_ID = "prince-bill-manager";

  let db = null;
  let pushTimer = null;
  let statusText = "Loading…";
  let onDataCallback = null;
  let getLocalCallback = null;

  /* =========================
     SYNC ID
  ========================= */
  function getSyncId() {
    let id = localStorage.getItem(SYNC_ID_KEY);
    if (!id) {
      id = DEFAULT_SYNC_ID;
      localStorage.setItem(SYNC_ID_KEY, id);
    }
    return id;
  }

  function cloudPath() {
    return "billManager/" + getSyncId();
  }

  function setStatus(msg) {
    statusText = msg;
    const el = document.getElementById("syncStatusText");
    if (el) el.textContent = msg;
  }

  /* =========================
     FIREBASE INIT
  ========================= */
  function isConfigured() {
    const c = window.FIREBASE_CONFIG || {};
    return window.FIREBASE_ENABLED === true && c.databaseURL && c.apiKey;
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
      setStatus("❌ Firebase config error");
      return false;
    }
  }

  /* =========================
     NORMALIZE DATA
  ========================= */
  function normalizePayload(val) {
    if (!val || !Array.isArray(val.folders)) return null;
    return {
      folders: val.folders,
      updatedAt: val.updatedAt || 0
    };
  }

  /* =========================
     ONE TIME CLOUD LOAD (FAST)
  ========================= */
  async function loadFromCloudOnce() {
    if (!db) return null;

    try {
      const snap = await db.ref(cloudPath()).once("value");
      return normalizePayload(snap.val());
    } catch (e) {
      console.log("Cloud load error", e);
      return null;
    }
  }

  /* =========================
     PUSH TO CLOUD
  ========================= */
  async function pushPayload(payload) {
    if (!db) return;

    try {
      await db.ref(cloudPath()).set(payload);
      console.log("☁️ Push success", payload.updatedAt);
      setStatus("☁️ Synced");
    } catch (e) {
      console.error(e);
      setStatus("❌ Upload failed (file too big?)");
    }
  }

  /* =========================
     SMART BATCH PUSH (BIG SPEED BOOST)
  ========================= */
  function schedulePush() {
    if (!db || !getLocalCallback) return;

    clearTimeout(pushTimer);

    pushTimer = setTimeout(async function () {
      const local = getLocalCallback();

      await pushPayload({
        folders: local.folders,
        updatedAt: Date.now()
      });

    }, 2500); // batch sync every 2.5 sec
  }

  /* =========================
     MERGE LOGIC
  ========================= */
  function decideMerge(local, cloud) {

    const localHas = local.folders?.length > 0;
    const cloudHas = cloud?.folders?.length > 0;

    const localTime = local.updatedAt || 0;
    const cloudTime = cloud?.updatedAt || 0;

    if (cloudHas && cloudTime > localTime) return "USE_CLOUD";
    if (localHas) return "PUSH_LOCAL";
    return "NONE";
  }

  /* =========================
     INIT SYNC
  ========================= */
  async function init(options) {

    onDataCallback = options.onData;
    getLocalCallback = options.getLocal;

    if (!isConfigured()) {
      setStatus("⚠️ Firebase not configured");
      return;
    }

    if (!initDb()) return;

    setStatus("☁️ Loading from cloud…");

    const local = getLocalCallback();
    const cloud = await loadFromCloudOnce();

    if (!cloud) {
      if (local.folders.length) {
        await pushPayload({
          folders: local.folders,
          updatedAt: Date.now()
        });
      }
      setStatus("☁️ Ready");
      return;
    }

    const action = decideMerge(local, cloud);

    if (action === "USE_CLOUD") {
      onDataCallback(cloud);
      setStatus("☁️ Loaded from cloud");
    }

    if (action === "PUSH_LOCAL") {
      await pushPayload({
        folders: local.folders,
        updatedAt: Date.now()
      });
      setStatus("☁️ Uploaded local data");
    }
  }

  window.BillSync = {
    init,
    schedulePush,
    isConfigured: isConfigured,
    getStatus: () => statusText
  };

})();