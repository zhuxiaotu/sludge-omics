(() => {
  "use strict";

  const page = document.body.dataset.pipeline;
  const config = window.PIPELINES?.[page];
  if (!config) return;

  const state = {
    files: [],
    /** @type {{id:string,name:string,tools:string[],tool:string|null,uid:string}[]} */
    pipeline: [],
    dragTool: null, // { moduleId, toolName }
    activeRunId: null,
    resultData: null,
  };

  const $ = (sel) => document.querySelector(sel);

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => { el.hidden = true; }, 250);
    }, 2200);
  }

  function estimateReads(files) {
    if (!files.length) return "—";
    const total = files.reduce((s, f) => s + f.size, 0);
    const approx = Math.max(1, Math.round(total / 250));
    if (approx >= 1e6) return `${(approx / 1e6).toFixed(1)}M`;
    if (approx >= 1e3) return `${(approx / 1e3).toFixed(0)}K`;
    return String(approx);
  }

  function findModule(id) {
    return config.modules.find((m) => m.id === id);
  }

  function renderCatalog() {
    const el = $("#software-catalog");
    if (!el) return;
    el.innerHTML = config.catalog
      .map(
        (g) => `
      <div class="catalog-group panel">
        <div class="panel-heading">${escapeHtml(g.group)}</div>
        <ul>${g.items.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      </div>`
      )
      .join("");
  }

  function renderFiles() {
    const list = $("#file-list");
    list.innerHTML = state.files
      .map(
        (f, i) => `
      <li class="file-item">
        <span class="name">${escapeHtml(f.name)}</span>
        <span class="size">${formatSize(f.size)}</span>
        <button class="remove" type="button" data-i="${i}" aria-label="移除">×</button>
      </li>`
      )
      .join("");
    $("#stat-files").textContent = String(state.files.length);
    $("#stat-reads").textContent = estimateReads(state.files);
  }

  function addFiles(fileList) {
    const allowed = /\.(fastq|fq|fasta|fa|bam|sam|csv|tsv|txt)(\.gz)?$/i;
    let added = 0;
    [...fileList].forEach((file) => {
      if (!allowed.test(file.name) && !/\.gz$/i.test(file.name)) return;
      if (state.files.some((f) => f.name === file.name && f.size === file.size)) return;
      state.files.push({ name: file.name, size: file.size });
      added += 1;
    });
    renderFiles();
    toast(added ? `已添加 ${added} 个文件` : "未识别到新的数据文件");
  }

  /** Tool palette: all small tools grouped by process module */
  function renderPalette() {
    const palette = $("#palette");
    palette.innerHTML = config.modules
      .map((m) => {
        const tools = (m.tools || [])
          .map(
            (t) => `
          <div class="tool-chip" draggable="true" data-module="${m.id}" data-tool="${escapeHtml(t)}">
            ${escapeHtml(t)}
          </div>`
          )
          .join("");
        return `
        <div class="tool-group">
          <div class="tool-group-title">${escapeHtml(m.name)}</div>
          <div class="tool-group-list">${tools}</div>
        </div>`;
      })
      .join("");

    palette.querySelectorAll(".tool-chip").forEach((chip) => {
      chip.addEventListener("dragstart", (e) => {
        state.dragTool = { moduleId: chip.dataset.module, toolName: chip.dataset.tool };
        chip.classList.add("dragging");
        e.dataTransfer.setData("text/plain", `tool:${chip.dataset.module}|${chip.dataset.tool}`);
        e.dataTransfer.effectAllowed = "copy";
      });
      chip.addEventListener("dragend", () => chip.classList.remove("dragging"));
      chip.addEventListener("dblclick", () => assignTool(chip.dataset.module, chip.dataset.tool));
    });
  }

  function resetPipeline() {
    state.pipeline = config.defaultIds.map((id, i) => {
      const m = findModule(id);
      const tool = (config.defaultTools && config.defaultTools[id]) || (m.tools && m.tools[0]) || null;
      return {
        id: m.id,
        name: m.name,
        tools: m.tools || [],
        tool,
        uid: `${id}-default-${i}`,
      };
    });
    renderPipeline();
  }

  function addStep(moduleId, toolName) {
    const m = findModule(moduleId);
    if (!m) return false;
    if (toolName && !m.tools.includes(toolName)) return false;
    state.pipeline.push({
      id: m.id,
      name: m.name,
      tools: m.tools,
      tool: toolName || m.tools[0] || null,
      uid: `${m.id}-${Date.now()}`,
    });
    renderPipeline();
    toast(`已追加步骤「${m.name}」· ${toolName || ""}`);
    return true;
  }

  function assignTool(moduleId, toolName) {
    const step = state.pipeline.find((s) => s.id === moduleId);
    if (!step) {
      addStep(moduleId, toolName);
      return;
    }
    if (!step.tools.includes(toolName)) {
      // same module already present but tool mismatch shouldn't happen; append another instance
      addStep(moduleId, toolName);
      return;
    }
    step.tool = toolName;
    renderPipeline();
    toast(`「${step.name}」已选用 ${toolName}`);
  }

  function applyDropToStep(stepIndex) {
    if (!state.dragTool) return;
    const { moduleId, toolName } = state.dragTool;
    state.dragTool = null;
    const step = state.pipeline[stepIndex];
    if (!step) {
      addStep(moduleId, toolName);
      return;
    }
    if (step.id === moduleId) {
      step.tool = toolName;
      renderPipeline();
      toast(`「${step.name}」已选用 ${toolName}`);
      return;
    }
    // drop onto a different step → append as new step
    addStep(moduleId, toolName);
  }

  function bindAppendDrop(el) {
    if (!el) return;
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add("drop-target");
    });
    el.addEventListener("dragleave", () => el.classList.remove("drop-target"));
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove("drop-target");
      if (!state.dragTool) return;
      const { moduleId, toolName } = state.dragTool;
      state.dragTool = null;
      addStep(moduleId, toolName);
    });
  }

  function renderPipeline() {
    const steps = $("#pipeline-steps");
    const empty = $("#canvas-empty");
    const canvas = $("#pipeline-canvas");
    if (!state.pipeline.length) {
      steps.innerHTML = "";
      empty.style.display = "block";
      empty.textContent = "将小工具拖到此处追加步骤，或点击「重置推荐」";
    } else {
      empty.style.display = "none";
      steps.innerHTML =
        state.pipeline
          .map(
            (step, i) => `
      <li class="pipeline-step" data-index="${i}" data-module="${step.id}">
        <div class="step-head">
          <span class="step-index">${i + 1}</span>
          <strong class="step-name">${escapeHtml(step.name)}</strong>
          <button class="step-remove" type="button" data-index="${i}" aria-label="移除步骤">×</button>
        </div>
        <div class="step-slot ${step.tool ? "filled" : ""}" data-index="${i}">
          ${step.tool ? `<span class="picked-tool">${escapeHtml(step.tool)}</span>` : "<span class=\"slot-hint\">将小工具拖到此处</span>"}
        </div>
        <div class="step-arrow" aria-hidden="true">${i < state.pipeline.length - 1 ? "↓" : ""}</div>
      </li>`
          )
          .join("") +
        `<li class="pipeline-append" id="pipeline-append">拖到此处追加新步骤</li>`;
    }

    steps.querySelectorAll(".pipeline-step").forEach((el) => {
      el.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add("drop-target");
      });
      el.addEventListener("dragleave", () => el.classList.remove("drop-target"));
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove("drop-target");
        const idx = Number(el.dataset.index);
        applyDropToStep(idx);
      });
    });

    bindAppendDrop($("#pipeline-append"));
    bindAppendDrop(empty);

    canvas.ondragover = (e) => {
      e.preventDefault();
      canvas.classList.add("dragover");
    };
    canvas.ondragleave = (e) => {
      if (!canvas.contains(e.relatedTarget)) canvas.classList.remove("dragover");
    };
    canvas.ondrop = (e) => {
      e.preventDefault();
      canvas.classList.remove("dragover");
      if (!state.dragTool) return;
      const { moduleId, toolName } = state.dragTool;
      state.dragTool = null;
      addStep(moduleId, toolName);
    };
  }

  function persistCurrentRun() {
    if (!window.HistoryStore) return null;
    const noteEl = $("#meta-note");
    const saved = HistoryStore.saveRun({
      id: state.activeRunId || null,
      pipelineType: page,
      title: config.title,
      project: $("#meta-project").value.trim() || "未命名项目",
      sample: ($("#meta-sample") && $("#meta-sample").value.trim()) || "",
      platform: ($("#meta-platform") && $("#meta-platform").value) || "",
      note: (noteEl && noteEl.value.trim()) || "",
      files: state.files.map((f) => ({ name: f.name, size: f.size })),
      steps: state.pipeline.map((s) => ({
        id: s.id,
        name: s.name,
        tool: s.tool,
        tools: s.tools,
      })),
      results: state.resultData || config.results,
    });
    state.activeRunId = saved.id;
    updateSaveBadge(saved);
    return saved;
  }

  function updateSaveBadge(saved) {
    const badge = $("#save-badge");
    if (!badge || !saved) return;
    badge.hidden = false;
    badge.innerHTML = `已保存 · ${HistoryStore.formatTime(saved.createdAt)} · <a href="history.html">查看历史</a>`;
  }

  function toCsv(headers, rows) {
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  }

  function downloadCsv(filename, headers, rows) {
    const blob = new Blob(["\uFEFF" + toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function renderResults(customData) {
    const data = customData || config.results;
    state.resultData = data;
    const results = $("#results");
    results.hidden = false;

    const toolsLine = state.pipeline
      .map((s) => `${s.name}:${s.tool || "未选"}`)
      .join(" → ");
    $("#results-subtitle").textContent = `「${$("#meta-project").value}」· ${config.title} · ${toolsLine}`;

    const wrap = $("#result-tables");
    const tables = data.tables || [];
    wrap.innerHTML = tables
      .map((t, ti) => `
      <div class="result-table-block panel">
        <div class="panel-heading clearfix">
          <span>${escapeHtml(t.title)}</span>
          <button class="btn btn-xs btn-default csv-btn" type="button" data-ti="${ti}">下载 CSV</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>${t.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
            <tbody>
              ${t.rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`)
      .join("");

    wrap.querySelectorAll(".csv-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = tables[Number(btn.dataset.ti)];
        const safe = (t.title || "result").replace(/[\\/:*?"<>|]/g, "_");
        downloadCsv(`${safe}.csv`, t.headers, t.rows);
      });
    });

    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function runAnalysis() {
    if (!state.pipeline.length) {
      toast("请先设置分析流程");
      return;
    }
    const missing = state.pipeline.filter((s) => !s.tool);
    if (missing.length) {
      toast(`请为步骤选择工具：${missing.map((s) => s.name).join("、")}`);
      return;
    }
    if (!state.files.length) toast("建议先上传或载入演示数据");

    const progress = $("#run-progress");
    const fill = $("#progress-fill");
    const text = $("#progress-text");
    progress.hidden = false;
    fill.style.width = "0%";

    for (let i = 0; i < state.pipeline.length; i++) {
      fill.style.width = `${Math.round(((i + 1) / state.pipeline.length) * 100)}%`;
      text.textContent = `正在执行：${state.pipeline[i].name} / ${state.pipeline[i].tool}（${i + 1}/${state.pipeline.length}）`;
      await wait(380 + Math.random() * 320);
    }
    text.textContent = "分析完成";
    fill.style.width = "100%";
    await wait(250);
    state.activeRunId = null;
    renderResults(config.results);
    const saved = persistCurrentRun();
    toast(saved ? "分析完成，已存入历史记录" : "分析完成");
  }

  function loadRunFromHistory(id) {
    if (!window.HistoryStore) return;
    const run = HistoryStore.getRun(id);
    if (!run) {
      toast("未找到该历史记录");
      return;
    }
    if (run.pipelineType && run.pipelineType !== page) {
      location.href = `${HistoryStore.pageForType(run.pipelineType)}?id=${encodeURIComponent(run.id)}`;
      return;
    }

    state.activeRunId = run.id;
    state.files = (run.files || []).map((f) => ({ ...f }));
    state.pipeline = (run.steps || []).map((s, i) => {
      const m = findModule(s.id) || { tools: s.tools || [] };
      return {
        id: s.id,
        name: s.name || m.name,
        tools: s.tools || m.tools || [],
        tool: s.tool || null,
        uid: `${s.id || "step"}-loaded-${i}`,
      };
    });
    if ($("#meta-project")) $("#meta-project").value = run.project || "";
    if ($("#meta-sample")) $("#meta-sample").value = run.sample || "";
    if ($("#meta-platform") && run.platform) $("#meta-platform").value = run.platform;
    if ($("#meta-note")) $("#meta-note").value = run.note || "";

    renderFiles();
    renderPipeline();
    renderResults(run.results || config.results);
    updateSaveBadge(run);
    toast("已载入历史分析");
  }

  function bindDropzone() {
    const zone = $("#dropzone");
    const input = $("#file-input");
    const inner = zone.querySelector(".dropzone-inner");
    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, prevent));
    zone.addEventListener("dragenter", () => zone.classList.add("dragover"));
    zone.addEventListener("dragover", () => zone.classList.add("dragover"));
    zone.addEventListener("dragleave", (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove("dragover"); });
    zone.addEventListener("drop", (e) => {
      zone.classList.remove("dragover");
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    });
    inner.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      if (input.files?.length) addFiles(input.files);
      input.value = "";
    });
    $("#file-list").addEventListener("click", (e) => {
      const btn = e.target.closest(".remove");
      if (!btn) return;
      state.files.splice(Number(btn.dataset.i), 1);
      renderFiles();
    });
  }

  function bindPipelineCanvas() {
    $("#pipeline-steps").addEventListener("click", (e) => {
      const btn = e.target.closest(".step-remove");
      if (!btn) return;
      state.pipeline.splice(Number(btn.dataset.index), 1);
      renderPipeline();
    });
  }

  function init() {
    $("#pipeline-mode-label").textContent = `当前：${config.title}`;
    renderCatalog();
    renderPalette();
    resetPipeline();
    bindDropzone();
    bindPipelineCanvas();

    $("#btn-reset-pipeline").addEventListener("click", () => {
      resetPipeline();
      toast("已恢复推荐流程");
    });
    $("#btn-run").addEventListener("click", runAnalysis);
    $("#btn-demo").addEventListener("click", () => {
      const demos = {
        rna: [
          { name: "sample_A_R1.fastq.gz", size: 512000000 },
          { name: "sample_A_R2.fastq.gz", size: 520000000 },
          { name: "sample_B_R1.fastq.gz", size: 498000000 },
        ],
        meta: [
          { name: "meta_S1_R1.fastq.gz", size: 890000000 },
          { name: "meta_S1_R2.fastq.gz", size: 905000000 },
        ],
        "16s": [
          { name: "16S_S1_R1.fastq.gz", size: 120000000 },
          { name: "16S_S1_R2.fastq.gz", size: 118000000 },
          { name: "16S_S2_R1.fastq.gz", size: 115000000 },
        ],
      };
      state.files = (demos[page] || demos.rna).map((f) => ({ ...f }));
      renderFiles();
      toast("已载入演示测序文件");
    });

    const saveBtn = $("#btn-save");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        if (!state.resultData && !state.pipeline.length) {
          toast("请先运行分析后再保存");
          return;
        }
        if (!state.resultData) state.resultData = config.results;
        const saved = persistCurrentRun();
        toast(saved ? "当前分析已保存到历史" : "保存失败");
      });
    }

    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    if (id) loadRunFromHistory(id);
  }

  init();
})();
