(() => {
  "use strict";

  const page = document.body.dataset.pipeline;
  const config = window.PIPELINES?.[page];
  if (!config) return;

  const state = {
    files: [],
    pipeline: [],
    charts: { taxonomy: null, diversity: null, extra: null },
    dragPaletteId: null,
    dragStepIndex: null,
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
      <div class="catalog-group">
        <h4>${escapeHtml(g.group)}</h4>
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

  function renderPalette() {
    const palette = $("#palette");
    palette.innerHTML = config.modules
      .map(
        (m) => `
      <div class="module-chip" draggable="true" data-id="${m.id}">
        <span class="chip-dot" style="background:${m.color}"></span>
        <div class="chip-body">
          <strong>${m.name}</strong>
          <span>${m.desc}</span>
        </div>
      </div>`
      )
      .join("");

    palette.querySelectorAll(".module-chip").forEach((chip) => {
      chip.addEventListener("dragstart", (e) => {
        state.dragPaletteId = chip.dataset.id;
        state.dragStepIndex = null;
        chip.classList.add("dragging");
        e.dataTransfer.setData("text/plain", `palette:${chip.dataset.id}`);
        e.dataTransfer.effectAllowed = "copy";
      });
      chip.addEventListener("dragend", () => chip.classList.remove("dragging"));
      chip.addEventListener("dblclick", () => addModule(chip.dataset.id));
    });
  }

  function addModule(id, index = null) {
    const mod = findModule(id);
    if (!mod) return;
    const item = { ...mod, uid: `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    if (index == null || index < 0 || index > state.pipeline.length) state.pipeline.push(item);
    else state.pipeline.splice(index, 0, item);
    renderPipeline();
  }

  function resetPipeline() {
    state.pipeline = config.defaultIds.map((id, i) => {
      const m = findModule(id);
      return { ...m, uid: `${id}-default-${i}` };
    });
    renderPipeline();
  }

  function renderPipeline() {
    const steps = $("#pipeline-steps");
    const empty = $("#canvas-empty");
    steps.innerHTML = state.pipeline
      .map(
        (step, i) => `
      <li class="pipeline-step" draggable="true" data-index="${i}" style="border-top: 3px solid ${step.color}">
        <button class="step-remove" type="button" data-index="${i}" aria-label="移除">×</button>
        <span class="step-index">${String(i + 1).padStart(2, "0")}</span>
        <strong class="step-name">${step.name}</strong>
        <span class="step-desc">${step.desc}</span>
      </li>`
      )
      .join("");
    empty.style.display = state.pipeline.length ? "none" : "grid";

    steps.querySelectorAll(".pipeline-step").forEach((el) => {
      el.addEventListener("dragstart", (e) => {
        state.dragStepIndex = Number(el.dataset.index);
        state.dragPaletteId = null;
        el.classList.add("dragging");
        e.dataTransfer.setData("text/plain", `step:${el.dataset.index}`);
        e.dataTransfer.effectAllowed = "move";
      });
      el.addEventListener("dragend", () => {
        el.classList.remove("dragging");
        steps.querySelectorAll(".drop-target").forEach((n) => n.classList.remove("drop-target"));
      });
      el.addEventListener("dragover", (e) => {
        e.preventDefault();
        el.classList.add("drop-target");
      });
      el.addEventListener("dragleave", () => el.classList.remove("drop-target"));
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove("drop-target");
        handleDropOnStep(Number(el.dataset.index));
      });
    });
  }

  function handleDropOnStep(targetIndex) {
    if (state.dragPaletteId) {
      addModule(state.dragPaletteId, targetIndex);
      state.dragPaletteId = null;
      return;
    }
    if (state.dragStepIndex == null || state.dragStepIndex === targetIndex) return;
    const [moved] = state.pipeline.splice(state.dragStepIndex, 1);
    const insertAt = state.dragStepIndex < targetIndex ? targetIndex - 1 : targetIndex;
    state.pipeline.splice(insertAt, 0, moved);
    state.dragStepIndex = null;
    renderPipeline();
  }

  function destroyCharts() {
    Object.keys(state.charts).forEach((k) => {
      if (state.charts[k]) {
        state.charts[k].destroy();
        state.charts[k] = null;
      }
    });
  }

  function chartDefaults() {
    Chart.defaults.color = "#3d5266";
    Chart.defaults.borderColor = "rgba(58, 126, 184, 0.12)";
    Chart.defaults.font.family = "'Source Sans 3', sans-serif";
  }

  function persistCurrentRun() {
    if (!window.HistoryStore) return null;
    const noteEl = $("#meta-note");
    const saved = HistoryStore.saveRun({
      id: state.activeRunId || undefined,
      pipelineType: page,
      title: config.title,
      project: $("#meta-project").value.trim() || "未命名项目",
      sample: ($("#meta-sample") && $("#meta-sample").value.trim()) || "",
      platform: ($("#meta-platform") && $("#meta-platform").value) || "",
      note: (noteEl && noteEl.value.trim()) || "",
      files: state.files.map((f) => ({ name: f.name, size: f.size })),
      steps: state.pipeline.map((s) => ({ id: s.id, name: s.name, desc: s.desc, color: s.color })),
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

  function renderResults(customData) {
    const data = customData || config.results;
    state.resultData = data;
    const results = $("#results");
    results.hidden = false;

    $("#results-subtitle").textContent = `「${$("#meta-project").value}」· ${config.title} · ${state.pipeline.length} 个分析步骤`;

    $("#kpi-grid").innerHTML = data.kpis
      .map(
        (k, i) => `
      <div class="kpi" style="animation-delay:${i * 0.05}s">
        <span class="label">${k.label}</span>
        <span class="value">${k.value}</span>
      </div>`
      )
      .join("");

    $("#chart-tax-title").textContent = data.titles.tax;
    $("#chart-div-title").textContent = data.titles.div;
    $("#chart-extra-title").textContent = data.titles.extra;

    $("#hits-table tbody").innerHTML = data.hits
      .map(
        ([name, cat, abund]) => `
      <tr><td>${name}</td><td>${cat}</td><td>${abund}</td></tr>`
      )
      .join("");

    $("#insight-panel").innerHTML = `<h3>解读摘要</h3><p>${data.insight}</p>`;

    destroyCharts();
    chartDefaults();
    const palette = ["#2a5f8f", "#3a7eb8", "#5a9bcf", "#7eb3d9", "#4a90c8", "#c48a4a", "#a8c5dc"];

    state.charts.taxonomy = new Chart($("#chart-taxonomy"), {
      type: "doughnut",
      data: {
        labels: data.taxonomy.labels,
        datasets: [{ data: data.taxonomy.values, backgroundColor: palette, borderWidth: 2, borderColor: "#fff", hoverOffset: 6 }],
      },
      options: { plugins: { legend: { position: "right", labels: { boxWidth: 12, padding: 12 } } }, cutout: "58%" },
    });

    state.charts.diversity = new Chart($("#chart-diversity"), {
      type: "bar",
      data: {
        labels: data.diversity.labels,
        datasets: [
          { label: page === "rna" ? "表达复杂度" : "Shannon", data: data.diversity.shannon, backgroundColor: "rgba(58,126,184,0.75)", borderRadius: 8, yAxisID: "y" },
          { label: page === "rna" ? "检出基因数" : "丰富度", data: data.diversity.chao1, type: "line", borderColor: "#c48a4a", backgroundColor: "rgba(196,138,74,0.15)", tension: 0.35, yAxisID: "y1" },
        ],
      },
      options: {
        scales: {
          y: { beginAtZero: true, grid: { color: "rgba(58,126,184,0.08)" } },
          y1: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false } },
          x: { grid: { display: false } },
        },
        plugins: { legend: { labels: { boxWidth: 12 } } },
      },
    });

    state.charts.extra = new Chart($("#chart-extra"), {
      type: "radar",
      data: {
        labels: data.extra.labels,
        datasets: [{
          label: "相对贡献",
          data: data.extra.values,
          borderColor: "#3a7eb8",
          backgroundColor: "rgba(58,126,184,0.18)",
          pointBackgroundColor: "#2a5f8f",
        }],
      },
      options: {
        scales: {
          r: {
            angleLines: { color: "rgba(58,126,184,0.15)" },
            grid: { color: "rgba(58,126,184,0.12)" },
            pointLabels: { color: "#3d5266", font: { size: 11 } },
            ticks: { display: false },
            suggestedMin: 0,
            suggestedMax: 40,
          },
        },
        plugins: { legend: { display: false } },
      },
    });

    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function runAnalysis() {
    if (!state.pipeline.length) {
      toast("请先编排分析流水线");
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
      text.textContent = `正在执行：${state.pipeline[i].name}（${i + 1}/${state.pipeline.length}）`;
      await wait(400 + Math.random() * 350);
    }
    text.textContent = "分析完成，正在生成可视化…";
    fill.style.width = "100%";
    await wait(300);
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
    state.pipeline = (run.steps || []).map((s, i) => ({
      ...s,
      uid: `${s.id || "step"}-loaded-${i}`,
    }));
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
    const canvas = $("#pipeline-canvas");
    canvas.addEventListener("dragover", (e) => { e.preventDefault(); canvas.classList.add("dragover"); });
    canvas.addEventListener("dragleave", (e) => { if (!canvas.contains(e.relatedTarget)) canvas.classList.remove("dragover"); });
    canvas.addEventListener("drop", (e) => {
      e.preventDefault();
      canvas.classList.remove("dragover");
      if (state.dragPaletteId) {
        addModule(state.dragPaletteId);
        state.dragPaletteId = null;
      }
    });
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
      toast("已加载推荐流水线");
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
