(() => {
  "use strict";

  const MODULES = {
    "16s": [
      { id: "qc", name: "质控过滤", desc: "FastQC / cutadapt 去接头", color: "#3a7eb8" },
      { id: "denoise", name: "去噪 ASV", desc: "DADA2 / Deblur", color: "#5a9bcf" },
      { id: "tax", name: "物种注释", desc: "SILVA / GTDB 16S", color: "#2a5f8f" },
      { id: "alpha", name: "Alpha 多样性", desc: "Shannon / Chao1 / Faith", color: "#7eb3d9" },
      { id: "beta", name: "Beta 多样性", desc: "Bray-Curtis · PCoA", color: "#4a90c8" },
      { id: "diff", name: "差异分析", desc: "工艺段差异菌群", color: "#c48a4a" },
    ],
    meta: [
      { id: "qc", name: "质控修剪", desc: "fastp 质量过滤", color: "#3a7eb8" },
      { id: "assemble", name: "宏基因组组装", desc: "MEGAHIT / metaSPAdes", color: "#5a9bcf" },
      { id: "bin", name: "分箱 MAG", desc: "MetaBAT2 · CheckM", color: "#2a5f8f" },
      { id: "tax", name: "物种分类", desc: "Kraken2 / GTDB-Tk", color: "#7eb3d9" },
      { id: "arg", name: "抗性基因 ARG", desc: "CARD / ResFinder", color: "#c48a4a" },
      { id: "func", name: "功能注释", desc: "KEGG / COG / CAZy", color: "#4a90c8" },
    ],
  };

  const DEMO_FILES = [
    { name: "A2O_aerobic_R1.fastq.gz", size: 482391040 },
    { name: "A2O_aerobic_R2.fastq.gz", size: 491028480 },
    { name: "A2O_anaerobic_R1.fastq.gz", size: 401120256 },
  ];

  const RESULTS = {
    "16s": {
      kpis: [
        { label: "ASV 数", value: "1,284" },
        { label: "平均 Shannon", value: "4.62" },
        { label: "覆盖度 Good's", value: "99.1%" },
        { label: "优势门", value: "Proteobacteria" },
      ],
      taxonomy: {
        labels: ["Proteobacteria", "Bacteroidota", "Actinobacteriota", "Chloroflexi", "Firmicutes", "Nitrospirota", "其他"],
        values: [34.2, 18.6, 12.4, 9.8, 8.1, 4.5, 12.4],
      },
      diversity: {
        labels: ["进水", "厌氧", "好氧", "沉淀", "脱水"],
        shannon: [3.1, 4.2, 4.8, 4.5, 3.6],
        chao1: [820, 1105, 1284, 1190, 940],
      },
      extra: {
        labels: ["硝化相关", "反硝化", "除磷 PAO", "聚糖 GAO", "产甲烷", "水解发酵"],
        values: [18, 24, 14, 11, 6, 22],
      },
      hits: [
        ["Nitrospira", "硝化细菌", "4.8%"],
        ["Candidatus Accumulibacter", "除磷菌 PAO", "3.2%"],
        ["Dechloromonas", "反硝化", "2.9%"],
        ["Tetrasphaera", "除磷相关", "2.1%"],
        ["Candidatus Competibacter", "聚糖菌 GAO", "1.7%"],
      ],
      insight:
        "好氧池污泥中 Nitrospira 与 Accumulibacter 相对丰度偏高，提示硝化与生物除磷功能活跃；脱水污泥多样性下降，可能与机械脱水与环境压力筛选有关。",
      titles: {
        tax: "门级相对丰度",
        div: "各工艺段 Alpha 多样性",
        extra: "功能相关菌群相对贡献",
      },
    },
    meta: {
      kpis: [
        { label: "组装 contig", value: "186k" },
        { label: "高质量 MAG", value: "42" },
        { label: "ARG 检出", value: "127" },
        { label: "物种数", value: "3, Idle" },
      ],
      taxonomy: {
        labels: ["Proteobacteria", "Bacteroidota", "Actinobacteriota", "Firmicutes", "Chloroflexi", "Planctomycetota", "其他"],
        values: [31.5, 16.2, 14.8, 10.4, 8.9, 5.2, 13.0],
      },
      diversity: {
        labels: ["进水", "厌氧", "好氧", "沉淀", "脱水"],
        shannon: [5.2, 6.1, 6.8, 6.4, 5.5],
        chao1: [2100, 2800, 3410, 3100, 2400],
      },
      extra: {
        labels: ["氨基糖苷类", "β-内酰胺", "四环素", "磺胺", "大环内酯", "多药外排"],
        values: [22, 31, 18, 14, 12, 30],
      },
      hits: [
        ["sul1", "磺胺类 ARG", "RPKM 48.2"],
        ["tetA", "四环素 ARG", "RPKM 36.7"],
        ["blaOXA", "β-内酰胺 ARG", "RPKM 29.1"],
        ["mexB", "多药外排", "RPKM 41.5"],
        ["intI1", "I 类整合子", "RPKM 55.0"],
      ],
      insight:
        "污泥宏基因组中 intI1 与 sul1 共现明显，提示移动元件可能介导抗性基因扩散；好氧段 β-内酰胺与多药外排相关基因丰度较高，建议结合进出水耐药监测评估生物安全风险。",
      titles: {
        tax: "物种组成（门级）",
        div: "群落丰富度与多样性",
        extra: "抗性基因类别相对丰度",
      },
    },
  };

  const state = {
    mode: "16s",
    files: [],
    pipeline: [],
    charts: { taxonomy: null, diversity: null, extra: null },
    dragPaletteId: null,
    dragStepIndex: null,
  };

  const $ = (sel) => document.querySelector(sel);

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }

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

  function estimateReads(files) {
    if (!files.length) return "—";
    const total = files.reduce((s, f) => s + f.size, 0);
    const approx = Math.max(1, Math.round(total / 250));
    if (approx >= 1e6) return `${(approx / 1e6).toFixed(1)}M`;
    if (approx >= 1e3) return `${(approx / 1e3).toFixed(0)}K`;
    return String(approx);
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

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function addFiles(fileList) {
    const allowed = /\.(fastq|fq|fasta|fa)(\.gz)?$/i;
    let added = 0;
    [...fileList].forEach((file) => {
      if (!allowed.test(file.name) && !file.name.endsWith(".gz")) {
        return;
      }
      if (state.files.some((f) => f.name === file.name && f.size === file.size)) return;
      state.files.push({ name: file.name, size: file.size });
      added += 1;
    });
    renderFiles();
    if (added) toast(`已添加 ${added} 个文件`);
    else toast("未识别到新的测序文件");
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      const on = btn.dataset.mode === mode;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    $("#pipeline-mode-label").textContent =
      mode === "16s" ? "当前：16S 扩增子" : "当前：宏基因组";
    renderPalette();
    resetPipeline();
  }

  function renderPalette() {
    const palette = $("#palette");
    palette.innerHTML = MODULES[state.mode]
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

  function findModule(id) {
    return MODULES[state.mode].find((m) => m.id === id);
  }

  function addModule(id, index = null) {
    const mod = findModule(id);
    if (!mod) return;
    const item = { ...mod, uid: `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    if (index == null || index < 0 || index > state.pipeline.length) {
      state.pipeline.push(item);
    } else {
      state.pipeline.splice(index, 0, item);
    }
    renderPipeline();
  }

  function resetPipeline() {
    state.pipeline = MODULES[state.mode].slice(0, 4).map((m, i) => ({
      ...m,
      uid: `${m.id}-default-${i}`,
    }));
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
        const target = Number(el.dataset.index);
        handleDropOnStep(target);
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

  function renderResults() {
    const data = RESULTS[state.mode];
    const results = $("#results");
    results.hidden = false;

    $("#results-subtitle").textContent = `项目「${$("#meta-project").value}」· ${$(
      "#meta-process"
    ).value} · ${state.mode === "16s" ? "16S" : "宏基因组"} · ${state.pipeline.length} 个分析步骤`;

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

    const tbody = $("#hits-table tbody");
    tbody.innerHTML = data.hits
      .map(
        ([name, cat, abund]) => `
      <tr>
        <td>${name}</td>
        <td>${cat}</td>
        <td>${abund}</td>
      </tr>`
      )
      .join("");

    $("#insight-panel").innerHTML = `
      <h3>解读摘要</h3>
      <p>${data.insight}</p>`;

    destroyCharts();
    chartDefaults();

    const palette = ["#2a5f8f", "#3a7eb8", "#5a9bcf", "#7eb3d9", "#4a90c8", "#c48a4a", "#a8c5dc"];

    state.charts.taxonomy = new Chart($("#chart-taxonomy"), {
      type: "doughnut",
      data: {
        labels: data.taxonomy.labels,
        datasets: [
          {
            data: data.taxonomy.values,
            backgroundColor: palette,
            borderWidth: 2,
            borderColor: "#ffffff",
            hoverOffset: 6,
          },
        ],
      },
      options: {
        plugins: {
          legend: { position: "right", labels: { boxWidth: 12, padding: 12 } },
        },
        cutout: "58%",
      },
    });

    state.charts.diversity = new Chart($("#chart-diversity"), {
      type: "bar",
      data: {
        labels: data.diversity.labels,
        datasets: [
          {
            label: "Shannon",
            data: data.diversity.shannon,
            backgroundColor: "rgba(58, 126, 184, 0.75)",
            borderRadius: 8,
            yAxisID: "y",
          },
          {
            label: state.mode === "16s" ? "Chao1" : "观测物种数",
            data: data.diversity.chao1,
            type: "line",
            borderColor: "#c48a4a",
            backgroundColor: "rgba(196, 138, 74, 0.15)",
            tension: 0.35,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        scales: {
          y: { beginAtZero: true, grid: { color: "rgba(58,126,184,0.08)" } },
          y1: {
            position: "right",
            beginAtZero: true,
            grid: { drawOnChartArea: false },
          },
          x: { grid: { display: false } },
        },
        plugins: { legend: { labels: { boxWidth: 12 } } },
      },
    });

    state.charts.extra = new Chart($("#chart-extra"), {
      type: "radar",
      data: {
        labels: data.extra.labels,
        datasets: [
          {
            label: state.mode === "16s" ? "相对贡献" : "ARG 相对丰度",
            data: data.extra.values,
            borderColor: "#3a7eb8",
            backgroundColor: "rgba(58, 126, 184, 0.18)",
            pointBackgroundColor: "#2a5f8f",
          },
        ],
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

  async function runAnalysis() {
    if (!state.pipeline.length) {
      toast("请先编排分析流水线");
      return;
    }
    if (!state.files.length) {
      toast("建议先上传或载入演示数据");
    }

    const progress = $("#run-progress");
    const fill = $("#progress-fill");
    const text = $("#progress-text");
    progress.hidden = false;
    fill.style.width = "0%";

    const steps = [...state.pipeline];
    for (let i = 0; i < steps.length; i++) {
      const pct = Math.round(((i + 1) / steps.length) * 100);
      text.textContent = `正在执行：${steps[i].name}（${i + 1}/${steps.length}）`;
      fill.style.width = `${pct}%`;
      await wait(420 + Math.random() * 380);
    }

    text.textContent = "分析完成，正在生成可视化…";
    fill.style.width = "100%";
    await wait(350);
    renderResults();
    toast("分析完成");
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function bindDropzone() {
    const zone = $("#dropzone");
    const input = $("#file-input");
    const inner = zone.querySelector(".dropzone-inner");

    const prevent = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) => {
      zone.addEventListener(ev, prevent);
    });

    zone.addEventListener("dragenter", () => zone.classList.add("dragover"));
    zone.addEventListener("dragover", () => zone.classList.add("dragover"));
    zone.addEventListener("dragleave", (e) => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove("dragover");
    });
    zone.addEventListener("drop", (e) => {
      zone.classList.remove("dragover");
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    });

    inner.addEventListener("click", () => input.click());
    zone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });
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

    canvas.addEventListener("dragover", (e) => {
      e.preventDefault();
      canvas.classList.add("dragover");
    });
    canvas.addEventListener("dragleave", (e) => {
      if (!canvas.contains(e.relatedTarget)) canvas.classList.remove("dragover");
    });
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
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.mode));
    });

    $("#btn-reset-pipeline").addEventListener("click", () => {
      resetPipeline();
      toast("已加载推荐流水线");
    });
    $("#btn-run").addEventListener("click", runAnalysis);
    $("#btn-demo").addEventListener("click", () => {
      state.files = DEMO_FILES.map((f) => ({ ...f }));
      renderFiles();
      if (!state.pipeline.length) resetPipeline();
      toast("已载入演示测序文件");
    });

    bindDropzone();
    bindPipelineCanvas();
    setMode("16s");
  }

  init();
})();
