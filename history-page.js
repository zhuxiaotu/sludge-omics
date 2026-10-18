(() => {
  "use strict";

  const state = { filter: "all", query: "" };
  const $ = (sel) => document.querySelector(sel);

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => { el.hidden = true; }, 250);
    }, 2200);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function filtered() {
    const q = state.query.trim().toLowerCase();
    return HistoryStore.readAll().filter((run) => {
      if (state.filter !== "all" && run.pipelineType !== state.filter) return false;
      if (!q) return true;
      const hay = `${run.project || ""} ${run.note || ""} ${run.title || ""} ${run.sample || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function render() {
    const list = filtered();
    const all = HistoryStore.readAll();
    $("#history-count").textContent = `共 ${all.length} 条记录${state.filter !== "all" || state.query ? `，当前显示 ${list.length} 条` : ""}`;

    const empty = $("#history-empty");
    const wrap = $("#history-list");

    if (!list.length) {
      wrap.innerHTML = "";
      empty.hidden = false;
      empty.textContent = all.length
        ? "没有符合筛选条件的记录。"
        : "暂无历史记录。去任一分析模块运行一次分析后，会自动保存在这里。";
      return;
    }

    empty.hidden = true;
    wrap.innerHTML = list
      .map((run) => {
        const href = `${HistoryStore.pageForType(run.pipelineType)}?id=${encodeURIComponent(run.id)}`;
        const steps = (run.steps || []).map((s) => s.name).join(" → ") || "未记录步骤";
        const files = (run.files || []).map((f) => f.name).join("、") || "无文件";
        return `
        <article class="history-card" data-id="${escapeHtml(run.id)}">
          <div class="history-card-top">
            <span class="card-tag">${escapeHtml(HistoryStore.typeLabel(run.pipelineType))}</span>
            <time>${escapeHtml(HistoryStore.formatTime(run.createdAt))}</time>
          </div>
          <h3>${escapeHtml(run.project || "未命名项目")}</h3>
          <p class="history-meta">${escapeHtml(run.title || "")}${run.sample ? ` · ${escapeHtml(run.sample)}` : ""}${run.platform ? ` · ${escapeHtml(run.platform)}` : ""}</p>
          ${run.note ? `<p class="history-note">${escapeHtml(run.note)}</p>` : ""}
          <p class="history-steps"><strong>流水线</strong> ${escapeHtml(steps)}</p>
          <p class="history-files"><strong>文件</strong> ${escapeHtml(files)}</p>
          <div class="history-card-actions">
            <a class="btn btn-primary btn-sm" href="${href}">打开查看</a>
            <button class="btn btn-ghost btn-sm btn-delete" type="button" data-id="${escapeHtml(run.id)}">删除</button>
          </div>
        </article>`;
      })
      .join("");
  }

  function init() {
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.filter = btn.dataset.filter;
        document.querySelectorAll(".filter-btn").forEach((b) => b.classList.toggle("active", b === btn));
        render();
      });
    });

    $("#history-search").addEventListener("input", (e) => {
      state.query = e.target.value;
      render();
    });

    $("#history-list").addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-delete");
      if (!btn) return;
      const id = btn.dataset.id;
      if (!confirm("确定删除这条历史记录？")) return;
      HistoryStore.deleteRun(id);
      toast("已删除");
      render();
    });

    $("#btn-clear-history").addEventListener("click", () => {
      const n = HistoryStore.readAll().length;
      if (!n) {
        toast("当前没有记录");
        return;
      }
      if (!confirm(`确定清空全部 ${n} 条历史记录？此操作不可恢复。`)) return;
      HistoryStore.clearAll();
      toast("已清空历史");
      render();
    });

    render();
  }

  init();
})();
