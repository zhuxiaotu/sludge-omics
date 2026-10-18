(() => {
  "use strict";

  const KEY = "genome-analysis-history-v1";
  const MAX = 80;

  function readAll() {
    try {
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function writeAll(list) {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  }

  function uid() {
    return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function saveRun(record) {
    const list = readAll();
    const item = {
      id: record.id || uid(),
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...record,
    };
    const idx = list.findIndex((x) => x.id === item.id);
    if (idx >= 0) list.splice(idx, 1);
    list.unshift(item);
    writeAll(list);
    return item;
  }

  function getRun(id) {
    return readAll().find((x) => x.id === id) || null;
  }

  function deleteRun(id) {
    writeAll(readAll().filter((x) => x.id !== id));
  }

  function clearAll() {
    localStorage.removeItem(KEY);
  }

  function pageForType(type) {
    if (type === "rna") return "rna.html";
    if (type === "meta") return "meta.html";
    if (type === "16s") return "16s.html";
    return "index.html";
  }

  function typeLabel(type) {
    if (type === "rna") return "转录组";
    if (type === "meta") return "宏基因组";
    if (type === "16s") return "16S";
    return type || "未知";
  }

  function formatTime(iso) {
    try {
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return iso;
    }
  }

  window.HistoryStore = {
    KEY,
    readAll,
    saveRun,
    getRun,
    deleteRun,
    clearAll,
    pageForType,
    typeLabel,
    formatTime,
  };
})();
