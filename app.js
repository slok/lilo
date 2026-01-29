const glyphSymbols = [
  "♠",
  "♥",
  "♦",
  "♣",
  "⬤",
  "⬟",
  "☘",
  "■",
  "▣",
  "◆",
  "◇",
  "▲",
  "✪",
  "✖",
  "⬅",
  "☃",
  "◫",
  "✦",
  "⛊",
  "⭘",
  "✷",
  "◩",
  "✹",
  "✇",
  "✻",
  "◁",
  "✚",
  "◑",
  "☂",
  "⛁",
  "⚡",
  "⊙",
];

const fabricCatalog = [
  {
    id: "aida",
    name: "Aida",
    counts: [12, 14, 16, 18, 20, 22, 24, 26, 28],
  },
  {
    id: "evenweave",
    name: "Evenweave",
    counts: [20, 22, 24, 26, 28, 32, 36],
  },
  {
    id: "linen",
    name: "Linen",
    counts: [20, 22, 24, 26, 28, 32, 36],
  },
];

const defaultPaletteId = typeof dmcPalette !== "undefined" ? dmcPalette.id : "";

const paletteCatalog = typeof dmcPalette !== "undefined" ? [dmcPalette] : [];

const STITCH_SIZE = 10;

const state = {
  image: null,
  imageUrl: null,
  imageWidth: 0,
  imageHeight: 0,
  aspectRatio: 1,
  gridWidth: 80,
  gridHeight: 80,
  colorLimit: 10,
  ditherStrength: 0,
  paletteId: defaultPaletteId,
  blurStrength: 0,
  smoothing: false,
  accentSlots: 2,
  fabricType: "aida",
  fabricCount: 14,
  fabricUnit: "inch",
  patternMode: "color-symbols",
  hiddenColors: [],
  manageMode: "pick",
  manageColorIndex: null,
  managePainting: false,
  manageModalOpen: false,
  manageModalMaximized: false,
  managePendingColor: null,
  manageHistory: {
    undo: [],
    redo: [],
    batch: null,
  },
  paletteSearchMode: "replace",
  projectMeta: null,
  mappedPixels: null,
  mappedPalette: [],
  counts: [],
  symbols: [],
  activeReplaceIndex: null,
};

const elements = {
  imageUpload: document.getElementById("imageUpload"),
  paletteSelect: document.getElementById("paletteSelect"),
  colorLimit: document.getElementById("colorLimit"),
  colorLimitValue: document.getElementById("colorLimitValue"),
  ditherStrength: document.getElementById("ditherStrength"),
  ditherStrengthValue: document.getElementById("ditherStrengthValue"),
  gridWidth: document.getElementById("gridWidth"),
  gridHeight: document.getElementById("gridHeight"),
  lockAspect: document.getElementById("lockAspect"),
  useOriginal: document.getElementById("useOriginal"),
  blurStrength: document.getElementById("blurStrength"),
  blurValue: document.getElementById("blurValue"),
  smoothing: document.getElementById("smoothing"),
  accentSlots: document.getElementById("accentSlots"),
  fabricType: document.getElementById("fabricType"),
  fabricCount: document.getElementById("fabricCount"),
  fabricUnit: document.getElementById("fabricUnit"),
  patternMode: document.getElementById("patternMode"),
  pdfSplit: document.getElementById("pdfSplit"),
  previewZoom: document.getElementById("previewZoom"),
  previewZoomValue: document.getElementById("previewZoomValue"),
  managePick: document.getElementById("managePick"),
  managePaint: document.getElementById("managePaint"),
  manageBucket: document.getElementById("manageBucket"),
  manageSelect: document.getElementById("manageSelect"),
  manageUndo: document.getElementById("manageUndo"),
  manageRedo: document.getElementById("manageRedo"),
  managePendingBadge: document.getElementById("managePendingBadge"),
  manageSwatch: document.getElementById("manageSwatch"),
  manageColorName: document.getElementById("manageColorName"),
  manageColorCode: document.getElementById("manageColorCode"),
  sizeCm: document.getElementById("sizeCm"),
  sizeIn: document.getElementById("sizeIn"),
  refresh: document.getElementById("refresh"),
  printPdf: document.getElementById("printPdf"),
  saveProject: document.getElementById("saveProject"),
  loadProject: document.getElementById("loadProject"),
  projectFile: document.getElementById("projectFile"),
  openManage: document.getElementById("openManage"),
  sourceCanvas: document.getElementById("sourceCanvas"),
  outputCanvas: document.getElementById("outputCanvas"),
  manageCanvas: document.getElementById("manageCanvas"),
  legendList: document.getElementById("legendList"),
  status: document.getElementById("status"),
  paletteSearchModal: document.getElementById("paletteSearchModal"),
  paletteSearchInput: document.getElementById("paletteSearchInput"),
  paletteSearchResults: document.getElementById("paletteSearchResults"),
  paletteSearchCount: document.getElementById("paletteSearchCount"),
  paletteSearchClose: document.getElementById("paletteSearchClose"),
  manageModal: document.getElementById("manageModal"),
  manageClose: document.getElementById("manageClose"),
  manageMaximize: document.getElementById("manageMaximize"),
};

const sourceCtx = elements.sourceCanvas.getContext("2d");
const outputCtx = elements.outputCanvas.getContext("2d");

const offscreen = document.createElement("canvas");
const offscreenCtx = offscreen.getContext("2d");

const resized = document.createElement("canvas");
const resizedCtx = resized.getContext("2d");

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

const hexToRgb = (hex) => {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
};

const distanceSq = (a, b) => {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
};

const rgbToLab = (rgb) => {
  const sr = rgb.r / 255;
  const sg = rgb.g / 255;
  const sb = rgb.b / 255;

  const linear = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const r = linear(sr);
  const g = linear(sg);
  const b = linear(sb);

  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
};

const labDistanceSq = (a, b) => {
  const dl = a.l - b.l;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return dl * dl + da * da + db * db;
};

const buildLimitedPalette = (data, paletteColors, limit, accentSlots) => {
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 10) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const existing = buckets.get(key) || { count: 0, sumR: 0, sumG: 0, sumB: 0 };
    existing.count += 1;
    existing.sumR += r;
    existing.sumG += g;
    existing.sumB += b;
    buckets.set(key, existing);
  }

  const totalPixels = Math.floor(data.length / 4);
  const minCount = Math.max(20, Math.round(totalPixels * 0.001));
  const bucketList = Array.from(buckets.values())
    .map((bucket) => {
      const avg = {
        r: Math.round(bucket.sumR / bucket.count),
        g: Math.round(bucket.sumG / bucket.count),
        b: Math.round(bucket.sumB / bucket.count),
      };
      const lab = rgbToLab(avg);
      const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
      return { ...bucket, avg, lab, chroma };
    })
    .sort((a, b) => b.count - a.count);

  const selected = [];
  const selectedIndices = new Set();

  const addClosestPalette = (lab) => {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let j = 0; j < paletteColors.length; j += 1) {
      const dist = labDistanceSq(lab, paletteColors[j].lab);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestIndex = j;
      }
    }
    if (!selectedIndices.has(bestIndex)) {
      selectedIndices.add(bestIndex);
      selected.push(paletteColors[bestIndex]);
    }
  };

  const slots = Math.min(accentSlots, limit);
  const accentChroma = 20;
  const accentBuckets = bucketList
    .filter((bucket) => bucket.count >= minCount && bucket.chroma >= accentChroma)
    .sort((a, b) => b.chroma - a.chroma);

  for (const bucket of accentBuckets) {
    addClosestPalette(bucket.lab);
    if (selected.length >= slots) break;
  }

  for (const bucket of bucketList) {
    if (selected.length >= limit) break;
    addClosestPalette(bucket.lab);
  }

  if (selected.length < limit) {
    for (let j = 0; j < paletteColors.length; j += 1) {
      if (!selectedIndices.has(j)) {
        selectedIndices.add(j);
        selected.push(paletteColors[j]);
      }
      if (selected.length >= limit) break;
    }
  }

  return selected.slice(0, limit);
};

const setStatus = (message) => {
  elements.status.textContent = message;
};

const getProjectMeta = () => {
  const now = new Date().toISOString();
  if (!state.projectMeta) {
    const id =
      (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
      `lilo-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    state.projectMeta = {
      id,
      createdAt: now,
      updatedAt: now,
    };
    return state.projectMeta;
  }
  state.projectMeta.updatedAt = now;
  return state.projectMeta;
};

let toastTimer = null;
const showToast = (message) => {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
};

const updateLegend = () => {
  elements.legendList.innerHTML = "";
  if (!state.counts.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "Legend will populate after conversion.";
    elements.legendList.appendChild(empty);
    return;
  }

  state.counts.forEach((count, index) => {
    const color = state.mappedPalette[index];
    if (!color || count <= 0) return;
    const symbol = state.symbols[index] || "";
    const hidden = isHiddenColor(color);

    const item = document.createElement("div");
    item.className = "legend-item";
    if (hidden) item.classList.add("is-hidden");

    const symbolBadge = document.createElement("div");
    symbolBadge.className = "symbol-badge";
    symbolBadge.textContent = symbol;

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = color.name;
    const meta = document.createElement("div");
    meta.className = "legend-meta";
    const swatch = document.createElement("div");
    swatch.className = "swatch";
    swatch.style.background = color.hex;
    const stitchCount = document.createElement("span");
    stitchCount.className = "legend-count";
    stitchCount.textContent = `(${count} st.)`;
    meta.appendChild(stitchCount);
    if (color.code) {
      const kbd = document.createElement("kbd");
      kbd.className = "kbd";
      kbd.textContent = `@${color.code}`;
      meta.appendChild(kbd);
    }

    const iconStack = document.createElement("div");
    iconStack.className = "legend-icon";
    iconStack.appendChild(swatch);
    iconStack.appendChild(symbolBadge);
    const actions = document.createElement("div");
    actions.className = "legend-actions";
    const visibility = document.createElement("label");
    visibility.className = "switch legend-switch";
    visibility.dataset.index = String(index);
    const visibilityInput = document.createElement("input");
    visibilityInput.className = "switch-input switch-input-sm";
    visibilityInput.type = "checkbox";
    visibilityInput.role = "switch";
    visibilityInput.checked = hidden;
    const visibilityText = document.createElement("span");
    visibilityText.textContent = "Hide";
    visibility.appendChild(visibilityInput);
    visibility.appendChild(visibilityText);
    actions.appendChild(visibility);
    const action = document.createElement("button");
    action.className = "legend-action icon-button";
    action.type = "button";
    action.dataset.index = String(index);
    action.setAttribute("aria-label", "Replace the color");
    action.setAttribute("title", "Replace the color");
    action.innerHTML = '<i data-lucide="pencil"></i>';
    actions.appendChild(action);
    info.appendChild(title);
    info.appendChild(meta);
    info.appendChild(actions);
    item.appendChild(iconStack);
    item.appendChild(info);
    elements.legendList.appendChild(item);
  });
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
};

const getPalette = () => paletteCatalog.find((item) => item.id === state.paletteId);

const getSymbolSet = () => glyphSymbols;

const normalizeHex = (hex) => hex.toLowerCase();

const getHiddenSet = () => new Set(state.hiddenColors.map(normalizeHex));

const isHiddenColor = (color) => getHiddenSet().has(normalizeHex(color.hex));

const toggleHiddenColor = (color) => {
  const hex = normalizeHex(color.hex);
  const hiddenSet = getHiddenSet();
  if (hiddenSet.has(hex)) {
    hiddenSet.delete(hex);
  } else {
    hiddenSet.add(hex);
  }
  state.hiddenColors = Array.from(hiddenSet);
};

const normalizeQuery = (query) => query.trim().toLowerCase();

const buildSearchResults = (query) => {
  const palette = getPalette();
  if (!palette) return [];
  const cleaned = normalizeQuery(query);
  if (!cleaned) return palette.colors;

  if (cleaned.startsWith("#")) {
    const hexQuery = cleaned;
    return palette.colors.filter((color) => color.hex.toLowerCase().startsWith(hexQuery));
  }
  if (cleaned.startsWith("@")) {
    const codeQuery = cleaned.slice(1);
    return palette.colors.filter((color) => color.code && color.code.toLowerCase().includes(codeQuery));
  }
  return palette.colors.filter((color) => color.name.toLowerCase().includes(cleaned));
};

const openPaletteSearch = (index, mode = "replace") => {
  if (!state.mappedPalette.length) return;
  state.activeReplaceIndex = mode === "replace" ? index : null;
  state.paletteSearchMode = mode;
  elements.paletteSearchInput.value = "";
  renderPaletteSearch("");
  elements.paletteSearchModal.classList.toggle("modal-top", mode === "select");
  elements.paletteSearchModal.classList.add("open");
  elements.paletteSearchModal.setAttribute("aria-hidden", "false");
  elements.paletteSearchInput.focus();
};

const closePaletteSearch = () => {
  elements.paletteSearchModal.classList.remove("open");
  elements.paletteSearchModal.classList.remove("modal-top");
  elements.paletteSearchModal.setAttribute("aria-hidden", "true");
  state.activeReplaceIndex = null;
  state.paletteSearchMode = "replace";
};

const renderPaletteSearch = (query) => {
  const results = buildSearchResults(query);
  elements.paletteSearchResults.innerHTML = "";
  const countLabel = results.length === 1 ? "1 match" : `${results.length} matches`;
  elements.paletteSearchCount.textContent = countLabel;

  const maxResults = 120;
  results.slice(0, maxResults).forEach((color) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "search-result";
    item.dataset.code = color.code || "";
    item.dataset.name = color.name || "";
    item.dataset.hex = color.hex;

    const swatch = document.createElement("div");
    swatch.className = "swatch";
    swatch.style.background = color.hex;

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = color.name;
    const meta = document.createElement("div");
    meta.className = "result-meta";
    const code = color.code ? `Code ${color.code}` : "";
    meta.textContent = `${color.hex.toUpperCase()}${code ? ` · ${code}` : ""}`;
    info.appendChild(title);
    info.appendChild(meta);

    const action = document.createElement("span");
    action.className = "muted";
    action.textContent = "Select";

    item.appendChild(swatch);
    item.appendChild(info);
    item.appendChild(action);
    elements.paletteSearchResults.appendChild(item);
  });
};

const applyPaletteReplacement = (color) => {
  if (state.activeReplaceIndex === null) return;
  const paletteColor = {
    ...color,
    rgb: hexToRgb(color.hex),
  };
  paletteColor.lab = rgbToLab(paletteColor.rgb);

  const existingIndex = state.mappedPalette.findIndex(
    (entry, index) => index !== state.activeReplaceIndex && entry && entry.hex === color.hex
  );
  const currentSymbol = state.symbols[state.activeReplaceIndex] || "?";
  const symbol = existingIndex >= 0 ? state.symbols[existingIndex] || currentSymbol : currentSymbol;
  paletteColor.symbol = symbol;

  state.mappedPalette[state.activeReplaceIndex] = paletteColor;
  state.symbols[state.activeReplaceIndex] = symbol;
  renderOutput();
  updateLegend();
  closePaletteSearch();
};

const selectManageColor = (color) => {
  if (!state.mappedPalette.length) return;
  const paletteColor = {
    ...color,
    rgb: hexToRgb(color.hex),
  };
  paletteColor.lab = rgbToLab(paletteColor.rgb);

  const existingIndex = state.mappedPalette.findIndex((entry) => entry && entry.hex === color.hex);
  if (existingIndex >= 0) {
    state.manageColorIndex = existingIndex;
    state.managePendingColor = null;
    state.manageMode = "paint";
    updateManageToolbar();
    closePaletteSearch();
    return;
  }

  state.managePendingColor = paletteColor;
  state.manageColorIndex = null;
  state.manageMode = "paint";
  updateManageToolbar();
  closePaletteSearch();
};

const formatSize = (value) => {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10) / 10;
  return rounded.toFixed(1);
};

const updateFabricSizes = () => {
  const count = state.fabricCount || 1;
  let widthIn = 0;
  let heightIn = 0;
  let widthCm = 0;
  let heightCm = 0;

  if (state.fabricUnit === "cm") {
    widthCm = state.gridWidth / count;
    heightCm = state.gridHeight / count;
    widthIn = widthCm / 2.54;
    heightIn = heightCm / 2.54;
  } else {
    widthIn = state.gridWidth / count;
    heightIn = state.gridHeight / count;
    widthCm = widthIn * 2.54;
    heightCm = heightIn * 2.54;
  }

  elements.sizeCm.textContent = `${formatSize(widthCm)} cm x ${formatSize(heightCm)} cm`;
  elements.sizeIn.textContent = `${formatSize(widthIn)} in x ${formatSize(heightIn)} in`;
};

const drawSourcePreview = () => {
  const width = elements.sourceCanvas.width;
  const height = elements.sourceCanvas.height;
  sourceCtx.clearRect(0, 0, width, height);
  if (!state.image) return;

  const ratio = Math.min(width / state.imageWidth, height / state.imageHeight);
  const drawWidth = state.imageWidth * ratio;
  const drawHeight = state.imageHeight * ratio;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;

  sourceCtx.drawImage(state.image, x, y, drawWidth, drawHeight);
};

const resizeForGrid = () => {
  if (!state.image) return;

  offscreen.width = state.imageWidth;
  offscreen.height = state.imageHeight;
  offscreenCtx.clearRect(0, 0, offscreen.width, offscreen.height);
  offscreenCtx.drawImage(state.image, 0, 0);

  resized.width = state.gridWidth;
  resized.height = state.gridHeight;
  resizedCtx.clearRect(0, 0, resized.width, resized.height);
  resizedCtx.imageSmoothingEnabled = state.smoothing;
  resizedCtx.imageSmoothingQuality = state.smoothing ? "high" : "low";
  resizedCtx.filter = state.blurStrength > 0 ? `blur(${state.blurStrength}px)` : "none";
  resizedCtx.drawImage(offscreen, 0, 0, resized.width, resized.height);
  resizedCtx.filter = "none";
};

const mapToPalette = () => {
  const palette = getPalette();
  if (!palette) return;

  const symbolSet = getSymbolSet();

  const paletteColors = palette.colors.map((color) => {
    const rgb = hexToRgb(color.hex);
    return {
      ...color,
      rgb,
      lab: rgbToLab(rgb),
    };
  });

  const imageData = resizedCtx.getImageData(0, 0, resized.width, resized.height);
  const data = imageData.data;
  const limit = clampNumber(state.colorLimit, 2, paletteColors.length);
  const limitedBase = buildLimitedPalette(
    data,
    paletteColors,
    limit,
    state.accentSlots
  );
  const limitedPalette = limitedBase.map((color, index) => ({
    ...color,
    symbol: symbolSet[index] || "?",
  }));
  const limitedCounts = new Array(limitedPalette.length).fill(0);

  const totalPixels = resized.width * resized.height;
  const limitedMapped = new Uint16Array(totalPixels);
  const ditherStrength = clampNumber(state.ditherStrength, 0, 100) / 100;

  if (ditherStrength > 0) {
    const width = resized.width;
    const height = resized.height;
    const errR = new Float32Array(totalPixels);
    const errG = new Float32Array(totalPixels);
    const errB = new Float32Array(totalPixels);

    for (let i = 0; i < totalPixels; i += 1) {
      const idx = i * 4;
      errR[i] = data[idx];
      errG[i] = data[idx + 1];
      errB[i] = data[idx + 2];
    }

    const distributeError = (x, y, er, eg, eb, weight) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const index = y * width + x;
      errR[index] += er * weight;
      errG[index] += eg * weight;
      errB[index] += eb * weight;
    };

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        const idx = index * 4;
        const alpha = data[idx + 3];
        if (alpha < 10) {
          limitedMapped[index] = 0;
          continue;
        }

        const rgb = {
          r: clampNumber(Math.round(errR[index]), 0, 255),
          g: clampNumber(Math.round(errG[index]), 0, 255),
          b: clampNumber(Math.round(errB[index]), 0, 255),
        };
        const lab = rgbToLab(rgb);
        let bestIndex = 0;
        let bestDistance = Infinity;
        for (let j = 0; j < limitedPalette.length; j += 1) {
          const dist = labDistanceSq(lab, limitedPalette[j].lab);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestIndex = j;
          }
        }

        limitedMapped[index] = bestIndex;
        limitedCounts[bestIndex] += 1;

        const target = limitedPalette[bestIndex].rgb;
        const er = (rgb.r - target.r) * ditherStrength;
        const eg = (rgb.g - target.g) * ditherStrength;
        const eb = (rgb.b - target.b) * ditherStrength;

        distributeError(x + 1, y, er, eg, eb, 7 / 16);
        distributeError(x - 1, y + 1, er, eg, eb, 3 / 16);
        distributeError(x, y + 1, er, eg, eb, 5 / 16);
        distributeError(x + 1, y + 1, er, eg, eb, 1 / 16);
      }
    }
  } else {
    for (let i = 0; i < totalPixels; i += 1) {
      const idx = i * 4;
      const alpha = data[idx + 3];
      const rgb = { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
      const lab = rgbToLab(rgb);
      let bestIndex = 0;
      let bestDistance = Infinity;
      for (let j = 0; j < limitedPalette.length; j += 1) {
        const dist = labDistanceSq(lab, limitedPalette[j].lab);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestIndex = j;
        }
      }
      if (alpha >= 10) {
        limitedCounts[bestIndex] += 1;
      }
      limitedMapped[i] = bestIndex;
    }
  }

  state.mappedPixels = limitedMapped;
  state.mappedPalette = limitedPalette;
  state.counts = limitedCounts;
  state.symbols = limitedPalette.map((color) => color.symbol || "?");
};

const applySymbolPresetToMapped = () => {
  if (!state.mappedPalette.length) return;
  const symbolSet = getSymbolSet();
  state.symbols = state.mappedPalette.map((color, index) => {
    const symbol = symbolSet[index] || "?";
    if (color) {
      color.symbol = symbol;
    }
    return symbol;
  });
};

const renderOutputToCanvas = (canvas, scale) => {
  if (!state.mappedPixels) return;

  const scaledStitch = STITCH_SIZE * scale;
  const width = state.gridWidth * scaledStitch;
  const height = state.gridHeight * scaledStitch;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);

  for (let y = 0; y < state.gridHeight; y += 1) {
    for (let x = 0; x < state.gridWidth; x += 1) {
      const index = y * state.gridWidth + x;
      const paletteIndex = state.mappedPixels[index];
      const color = state.mappedPalette[paletteIndex];
      if (!isHiddenColor(color)) {
        ctx.fillStyle = color.hex;
        ctx.fillRect(
          x * scaledStitch,
          y * scaledStitch,
          scaledStitch,
          scaledStitch
        );
      }
    }
  }

  ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
  ctx.lineWidth = Math.max(1, Math.round(scale * 0.4));
  for (let x = 0; x <= state.gridWidth; x += 1) {
    const xPos = x * scaledStitch;
    ctx.beginPath();
    ctx.moveTo(xPos, 0);
    ctx.lineTo(xPos, height);
    ctx.stroke();
  }
  for (let y = 0; y <= state.gridHeight; y += 1) {
    const yPos = y * scaledStitch;
    ctx.beginPath();
    ctx.moveTo(0, yPos);
    ctx.lineTo(width, yPos);
    ctx.stroke();
  }
};

const renderOutput = () => {
  renderOutputToCanvas(elements.outputCanvas, 1);
  renderManagePreview();
};

const updatePreviewZoom = () => {
  const zoom = clampNumber(Number(elements.previewZoom.value) || 1, 0.5, 4);
  elements.previewZoomValue.textContent = `${zoom.toFixed(1)}x`;
  if (!elements.manageCanvas) return;
  const width = elements.manageCanvas.width * zoom;
  const height = elements.manageCanvas.height * zoom;
  elements.manageCanvas.style.width = `${width}px`;
  elements.manageCanvas.style.height = `${height}px`;
};

const renderManagePreview = () => {
  if (!elements.manageCanvas) return;
  renderOutputToCanvas(elements.manageCanvas, 1);
  updatePreviewZoom();
};

const updateManageToolbar = () => {
  if (!elements.managePick || !elements.managePaint || !elements.manageBucket) return;
  const isPick = state.manageMode === "pick";
  const isPaint = state.manageMode === "paint";
  const isBucket = state.manageMode === "bucket";
  elements.managePick.classList.toggle("active", isPick);
  elements.managePaint.classList.toggle("active", isPaint);
  elements.manageBucket.classList.toggle("active", isBucket);
  if (elements.manageCanvas) {
    elements.manageCanvas.classList.toggle("cursor-pick", isPick);
  }

  if (elements.manageUndo) {
    elements.manageUndo.disabled = state.manageHistory.undo.length === 0;
  }
  if (elements.manageRedo) {
    elements.manageRedo.disabled = state.manageHistory.redo.length === 0;
  }

  const color =
    state.managePendingColor ||
    (state.manageColorIndex !== null ? state.mappedPalette[state.manageColorIndex] : null);
  if (!elements.manageSwatch || !elements.manageColorName || !elements.manageColorCode) return;
  if (!color) {
    elements.manageSwatch.style.background = "#fff";
    elements.manageColorName.textContent = "No color selected";
    elements.manageColorCode.textContent = "";
    return;
  }
  elements.manageSwatch.style.background = color.hex;
  elements.manageColorName.textContent = color.name || "Color";
  elements.manageColorCode.textContent = color.code ? `@${color.code}` : "";

  if (elements.managePendingBadge) {
    elements.managePendingBadge.style.display = state.managePendingColor ? "inline-flex" : "none";
  }
};

const updateCountsFromMapped = () => {
  if (!state.mappedPixels || !state.mappedPalette.length) return;
  const counts = new Array(state.mappedPalette.length).fill(0);
  for (let i = 0; i < state.mappedPixels.length; i += 1) {
    const idx = state.mappedPixels[i];
    if (Number.isFinite(idx) && counts[idx] !== undefined) {
      counts[idx] += 1;
    }
  }
  state.counts = counts;
  const usedColors = counts.filter((count) => count > 0).length;
  const clamped = clampNumber(usedColors || 3, 3, 32);
  elements.colorLimit.value = clamped;
  state.colorLimit = clamped;
  elements.colorLimitValue.textContent = clamped;
};

const startManageBatch = () => {
  if (state.manageHistory.batch) return;
  state.manageHistory.batch = new Map();
};

const addManageChange = (index, prev, next) => {
  if (prev === next) return;
  startManageBatch();
  if (state.manageHistory.batch.has(index)) {
    const existing = state.manageHistory.batch.get(index);
    state.manageHistory.batch.set(index, { prev: existing.prev, next });
    return;
  }
  state.manageHistory.batch.set(index, { prev, next });
};

const finalizeManageBatch = () => {
  const batch = state.manageHistory.batch;
  if (!batch || batch.size === 0) {
    state.manageHistory.batch = null;
    return;
  }
  const changes = Array.from(batch.entries()).map(([index, change]) => ({
    index,
    prev: change.prev,
    next: change.next,
  }));
  state.manageHistory.undo.push(changes);
  state.manageHistory.redo = [];
  state.manageHistory.batch = null;
  updateManageToolbar();
};

const applyManageBatch = (changes, direction) => {
  if (!changes) return;
  changes.forEach(({ index, prev, next }) => {
    state.mappedPixels[index] = direction === "undo" ? prev : next;
  });
  updateCountsFromMapped();
  renderOutput();
  updateLegend();
};

const undoManageChange = () => {
  const changes = state.manageHistory.undo.pop();
  if (!changes) return;
  state.manageHistory.redo.push(changes);
  applyManageBatch(changes, "undo");
  updateManageToolbar();
};

const redoManageChange = () => {
  const changes = state.manageHistory.redo.pop();
  if (!changes) return;
  state.manageHistory.undo.push(changes);
  applyManageBatch(changes, "redo");
  updateManageToolbar();
};

const getManageCellIndex = (event) => {
  if (!state.mappedPixels || !elements.manageCanvas) return;
  const rect = elements.manageCanvas.getBoundingClientRect();
  const scale = elements.manageCanvas.width / rect.width;
  const x = (event.clientX - rect.left) * scale;
  const y = (event.clientY - rect.top) * scale;
  const col = Math.floor(x / STITCH_SIZE);
  const row = Math.floor(y / STITCH_SIZE);
  if (col < 0 || row < 0 || col >= state.gridWidth || row >= state.gridHeight) return;
  const index = row * state.gridWidth + col;
  return index;
};

const paintManageCell = (index) => {
  if (!Number.isFinite(index)) return;
  if (state.manageColorIndex === null && state.managePendingColor) {
    const pending = state.managePendingColor;
    const existingIndex = state.mappedPalette.findIndex((entry) => entry && entry.hex === pending.hex);
    if (existingIndex >= 0) {
      state.manageColorIndex = existingIndex;
      state.managePendingColor = null;
    } else {
      if (state.mappedPalette.length >= 32) {
        setStatus("Maximum of 32 colors reached.");
        showToast("Maximum of 32 colors reached.");
        return;
      }
      const paletteColor = {
        ...pending,
        rgb: hexToRgb(pending.hex),
      };
      paletteColor.lab = rgbToLab(paletteColor.rgb);
      state.mappedPalette.push(paletteColor);
      applySymbolPresetToMapped();
      state.manageColorIndex = state.mappedPalette.length - 1;
      state.managePendingColor = null;
      elements.colorLimit.value = Math.min(32, state.mappedPalette.length);
      syncStateFromInputs();
      updateLegend();
    }
  }

  if (state.manageColorIndex === null) {
    setStatus("Pick a color first.");
    return;
  }
  const prev = state.mappedPixels[index];
  const next = state.manageColorIndex;
  if (prev === next) return;
  state.mappedPixels[index] = next;
  addManageChange(index, prev, next);
  updateCountsFromMapped();
  renderOutput();
  updateLegend();
};

const applyManageBucket = (startIndex) => {
  if (!Number.isFinite(startIndex)) return;
  if (state.manageColorIndex === null && state.managePendingColor) {
    const pending = state.managePendingColor;
    const existingIndex = state.mappedPalette.findIndex((entry) => entry && entry.hex === pending.hex);
    if (existingIndex >= 0) {
      state.manageColorIndex = existingIndex;
      state.managePendingColor = null;
    } else {
      if (state.mappedPalette.length >= 32) {
        setStatus("Maximum of 32 colors reached.");
        showToast("Maximum of 32 colors reached.");
        return;
      }
      const paletteColor = {
        ...pending,
        rgb: hexToRgb(pending.hex),
      };
      paletteColor.lab = rgbToLab(paletteColor.rgb);
      state.mappedPalette.push(paletteColor);
      applySymbolPresetToMapped();
      state.manageColorIndex = state.mappedPalette.length - 1;
      state.managePendingColor = null;
      elements.colorLimit.value = Math.min(32, state.mappedPalette.length);
      syncStateFromInputs();
      updateLegend();
    }
  }

  if (state.manageColorIndex === null) {
    setStatus("Pick a color first.");
    return;
  }

  const target = state.mappedPixels[startIndex];
  const replacement = state.manageColorIndex;
  if (target === replacement) return;

  startManageBatch();
  const stack = [startIndex];
  const visited = new Set();

  while (stack.length) {
    const index = stack.pop();
    if (visited.has(index)) continue;
    visited.add(index);
    if (state.mappedPixels[index] !== target) continue;
    const prev = state.mappedPixels[index];
    state.mappedPixels[index] = replacement;
    addManageChange(index, prev, replacement);

    const row = Math.floor(index / state.gridWidth);
    const col = index % state.gridWidth;
    if (col > 0) stack.push(index - 1);
    if (col < state.gridWidth - 1) stack.push(index + 1);
    if (row > 0) stack.push(index - state.gridWidth);
    if (row < state.gridHeight - 1) stack.push(index + state.gridWidth);
  }

  finalizeManageBatch();
  updateCountsFromMapped();
  renderOutput();
  updateLegend();
};

const handleManageClick = (event) => {
  const index = getManageCellIndex(event);
  if (!Number.isFinite(index)) return;
  const current = state.mappedPixels[index];

  if (state.manageMode === "pick") {
    state.manageColorIndex = current;
    state.managePendingColor = null;
    state.manageMode = "paint";
    updateManageToolbar();
    return;
  }
  if (state.manageMode === "bucket") {
    applyManageBucket(index);
    return;
  }
  paintManageCell(index);
};

const updateAll = () => {
  if (!state.image) {
    setStatus("Upload an image to begin.");
    return;
  }

  if (!state.paletteId) {
    setStatus("Add a palette to start mapping colors.");
    return;
  }

  setStatus("Processing...");
  resizeForGrid();
  mapToPalette();
  renderOutput();
  updateLegend();
  setStatus("Preview updated.");
};

const updateGridFromWidth = () => {
  if (!state.image || !elements.lockAspect.checked) return;
  const widthValue = Number(elements.gridWidth.value) || state.gridWidth;
  const heightValue = Math.round(widthValue / state.aspectRatio);
  elements.gridHeight.value = heightValue;
};

const updateGridFromHeight = () => {
  if (!state.image || !elements.lockAspect.checked) return;
  const heightValue = Number(elements.gridHeight.value) || state.gridHeight;
  const widthValue = Math.round(heightValue * state.aspectRatio);
  elements.gridWidth.value = widthValue;
};

const populatePalettes = () => {
  elements.paletteSelect.innerHTML = "";
  if (!paletteCatalog.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No palettes yet";
    elements.paletteSelect.appendChild(option);
    elements.paletteSelect.disabled = true;
    return;
  }

  paletteCatalog.forEach((palette) => {
    const option = document.createElement("option");
    option.value = palette.id;
    option.textContent = palette.name;
    elements.paletteSelect.appendChild(option);
  });
  const exists = paletteCatalog.some((palette) => palette.id === state.paletteId);
  elements.paletteSelect.value = exists ? state.paletteId : paletteCatalog[0]?.id;
  if (!exists && paletteCatalog[0]) {
    state.paletteId = paletteCatalog[0].id;
  }
  elements.paletteSelect.disabled = false;
};

const populateFabrics = () => {
  elements.fabricType.innerHTML = "";
  fabricCatalog.forEach((fabric) => {
    const option = document.createElement("option");
    option.value = fabric.id;
    option.textContent = fabric.name;
    elements.fabricType.appendChild(option);
  });
  elements.fabricType.value = state.fabricType;
  populateFabricCounts();
};

const populateFabricCounts = () => {
  const fabric = fabricCatalog.find((item) => item.id === state.fabricType) || fabricCatalog[0];
  if (!fabric) return;
  elements.fabricCount.innerHTML = "";
  fabric.counts.forEach((count) => {
    const option = document.createElement("option");
    option.value = count;
    option.textContent = `${count}-count`;
    elements.fabricCount.appendChild(option);
  });
  const fallback = fabric.counts.includes(state.fabricCount) ? state.fabricCount : fabric.counts[0];
  elements.fabricCount.value = String(fallback);
  state.fabricCount = Number(elements.fabricCount.value) || fallback;
};

const syncStateFromInputs = () => {
  state.gridWidth = clampNumber(Number(elements.gridWidth.value) || 10, 10, 1000);
  state.gridHeight = clampNumber(Number(elements.gridHeight.value) || 10, 10, 1000);
  state.colorLimit = clampNumber(Number(elements.colorLimit.value) || 10, 2, 32);
  state.ditherStrength = clampNumber(Number(elements.ditherStrength.value) || 0, 0, 100);
  state.paletteId = elements.paletteSelect.value || "";
  state.blurStrength = Number(elements.blurStrength.value) || 0;
  state.smoothing = elements.smoothing.checked;
  state.accentSlots = clampNumber(Number(elements.accentSlots.value) || 0, 0, 4);
  state.fabricType = elements.fabricType.value;
  state.fabricCount = Number(elements.fabricCount.value) || state.fabricCount;
  state.fabricUnit = elements.fabricUnit.value;
  state.patternMode = elements.patternMode.value || "color-symbols";

  elements.colorLimitValue.textContent = state.colorLimit;
  elements.ditherStrengthValue.textContent = state.ditherStrength;
  elements.blurValue.textContent = state.blurStrength;
  updateFabricSizes();
};

const buildProjectData = () => {
  const meta = getProjectMeta();
  const settings = {
    palette: state.paletteId,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    colorLimit: state.colorLimit,
    ditherStrength: state.ditherStrength,
    blurStrength: state.blurStrength,
    smoothing: state.smoothing,
    accentSlots: state.accentSlots,
    fabricType: state.fabricType,
    fabricCount: state.fabricCount,
    fabricUnit: state.fabricUnit,
    patternMode: state.patternMode,
    hiddenColors: state.hiddenColors,
    lockAspect: elements.lockAspect.checked,
  };

  return {
    schemaVersion: "V1",
    metadata: meta,
    settings,
    mappedPixels: state.mappedPixels ? Array.from(state.mappedPixels) : null,
    mappedPalette: state.mappedPalette ? state.mappedPalette : null,
  };
};

const getImageBlob = async () => {
  if (!state.imageUrl) return null;
  const response = await fetch(state.imageUrl);
  return response.blob();
};

const saveProject = async () => {
  if (!state.image) {
    setStatus("Upload an image to save a project.");
    return;
  }
  if (!window.JSZip) {
    setStatus("Project export is unavailable.");
    return;
  }

  syncStateFromInputs();
  const zip = new window.JSZip();
  const project = buildProjectData();
  zip.file("project.json", JSON.stringify(project, null, 2));

  const imageBlob = await getImageBlob();
  if (imageBlob) {
    zip.file("image.png", imageBlob);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.metadata?.id || "project"}.lilo`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("Project saved.");
};

const applyProjectSettings = (settings) => {
  if (!settings) return;
  if (settings.palette && paletteCatalog.some((palette) => palette.id === settings.palette)) {
    elements.paletteSelect.value = settings.palette;
    state.paletteId = settings.palette;
  }
  if (Number.isFinite(settings.gridWidth)) elements.gridWidth.value = settings.gridWidth;
  if (Number.isFinite(settings.gridHeight)) elements.gridHeight.value = settings.gridHeight;
  if (Number.isFinite(settings.colorLimit)) elements.colorLimit.value = settings.colorLimit;
  if (Number.isFinite(settings.ditherStrength)) elements.ditherStrength.value = settings.ditherStrength;
  if (Number.isFinite(settings.blurStrength)) elements.blurStrength.value = settings.blurStrength;
  if (typeof settings.smoothing === "boolean") elements.smoothing.checked = settings.smoothing;
  if (Number.isFinite(settings.accentSlots)) elements.accentSlots.value = settings.accentSlots;
  if (settings.fabricType && fabricCatalog.some((fabric) => fabric.id === settings.fabricType)) {
    elements.fabricType.value = settings.fabricType;
    state.fabricType = settings.fabricType;
    populateFabricCounts();
  }
  if (Number.isFinite(settings.fabricCount)) elements.fabricCount.value = settings.fabricCount;
  if (settings.fabricUnit === "inch" || settings.fabricUnit === "cm") {
    elements.fabricUnit.value = settings.fabricUnit;
  }
  if (settings.patternMode && ["color-symbols", "symbols", "color"].includes(settings.patternMode)) {
    elements.patternMode.value = settings.patternMode;
  }
  if (Array.isArray(settings.hiddenColors)) {
    state.hiddenColors = settings.hiddenColors;
  }
  if (typeof settings.lockAspect === "boolean") elements.lockAspect.checked = settings.lockAspect;
  syncStateFromInputs();
};

const loadImageFromBlob = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = event.target.result;
      state.imageUrl = img.src;
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const loadProject = async (file) => {
  if (!file || !window.JSZip) return;
  const zip = await window.JSZip.loadAsync(file);
  const projectText = await zip.file("project.json")?.async("string");
  if (!projectText) {
    setStatus("Invalid project file.");
    return;
  }
  const project = JSON.parse(projectText);
  if (project.metadata) {
    state.projectMeta = {
      id: project.metadata.id || state.projectMeta?.id || null,
      createdAt: project.metadata.createdAt || state.projectMeta?.createdAt || null,
      updatedAt: project.metadata.updatedAt || state.projectMeta?.updatedAt || null,
    };
  } else {
    state.projectMeta = null;
  }
  applyProjectSettings(project.settings || {});

  const imageFile = zip.file("image.png");
  if (imageFile) {
    const blob = await imageFile.async("blob");
    const img = await loadImageFromBlob(blob);
    state.image = img;
    state.imageWidth = img.naturalWidth;
    state.imageHeight = img.naturalHeight;
    state.aspectRatio = state.imageWidth / state.imageHeight;
    drawSourcePreview();
  }

  if (project.mappedPixels && project.mappedPalette) {
    state.mappedPixels = project.mappedPixels;
    state.mappedPalette = project.mappedPalette;
    applySymbolPresetToMapped();
    updateCountsFromMapped();
    renderOutput();
    updateLegend();
  } else {
    updateAll();
  }
  showToast("Project loaded.");
};

const handleFile = (file) => {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("Please upload an image file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      state.image = img;
      state.imageWidth = img.naturalWidth;
      state.imageHeight = img.naturalHeight;
      state.aspectRatio = state.imageWidth / state.imageHeight;

      const targetWidth = clampNumber(state.imageWidth, 30, 120);
      const targetHeight = Math.round(targetWidth / state.aspectRatio);
      elements.gridWidth.value = targetWidth;
      elements.gridHeight.value = targetHeight;

      drawSourcePreview();
      syncStateFromInputs();
      updateAll();
    };
    img.src = event.target.result;
    state.imageUrl = img.src;
  };
  reader.readAsDataURL(file);
};

const printPdf = () => {
  if (!state.mappedPixels) return;
  if (!window.LiloPdf?.downloadPatternPdf) {
    setStatus("PDF export is unavailable.");
    return;
  }

  syncStateFromInputs();
  window.LiloPdf.downloadPatternPdf({
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    mappedPixels: state.mappedPixels,
    mappedPalette: state.mappedPalette,
    counts: state.counts,
    symbols: state.symbols,
    fabricCount: state.fabricCount,
    fabricUnit: state.fabricUnit,
    patternMode: state.patternMode,
    hiddenColors: state.hiddenColors,
    splitMode: elements.pdfSplit.checked,
  });
};

populatePalettes();
populateFabrics();
syncStateFromInputs();
updateLegend();
if (window.lucide?.createIcons) {
  window.lucide.createIcons();
}

elements.imageUpload.addEventListener("change", (event) => {
  const file = event.target.files[0];
  handleFile(file);
});

elements.paletteSelect.addEventListener("change", () => {
  syncStateFromInputs();
  updateAll();
});

elements.colorLimit.addEventListener("input", () => {
  syncStateFromInputs();
});

elements.colorLimit.addEventListener("change", () => {
  updateAll();
});

elements.ditherStrength.addEventListener("input", () => {
  syncStateFromInputs();
});

elements.ditherStrength.addEventListener("change", () => {
  updateAll();
});

elements.gridWidth.addEventListener("input", () => {
  updateGridFromWidth();
  syncStateFromInputs();
});

elements.gridWidth.addEventListener("change", () => {
  updateAll();
});

elements.gridHeight.addEventListener("input", () => {
  updateGridFromHeight();
  syncStateFromInputs();
});

elements.gridHeight.addEventListener("change", () => {
  updateAll();
});

elements.lockAspect.addEventListener("change", () => {
  updateGridFromWidth();
  syncStateFromInputs();
  updateAll();
});

elements.useOriginal.addEventListener("click", () => {
  if (!state.image) return;
  elements.gridWidth.value = state.imageWidth;
  elements.gridHeight.value = state.imageHeight;
  syncStateFromInputs();
  updateAll();
});

elements.previewZoom.addEventListener("input", () => {
  updatePreviewZoom();
});

elements.previewZoom.addEventListener("change", () => {
  updatePreviewZoom();
});

const openManageModal = () => {
  if (!elements.manageModal) return;
  elements.manageModal.classList.add("open");
  elements.manageModal.classList.toggle("maximized", state.manageModalMaximized);
  elements.manageModal.setAttribute("aria-hidden", "false");
  state.manageModalOpen = true;
  if (window.lucide?.createIcons) {
    elements.manageMaximize.innerHTML = `
      <i data-lucide="${state.manageModalMaximized ? "minimize-2" : "maximize-2"}"></i>
    `;
    window.lucide.createIcons();
  }
  updateManageToolbar();
  renderManagePreview();
};

const closeManageModal = () => {
  if (!elements.manageModal) return;
  elements.manageModal.classList.remove("open");
  elements.manageModal.setAttribute("aria-hidden", "true");
  state.manageModalOpen = false;
  finalizeManageBatch();
};

elements.accentSlots.addEventListener("input", () => {
  syncStateFromInputs();
});

elements.accentSlots.addEventListener("change", () => {
  updateAll();
});

elements.fabricType.addEventListener("change", () => {
  state.fabricType = elements.fabricType.value;
  populateFabricCounts();
  syncStateFromInputs();
});

elements.fabricCount.addEventListener("change", () => {
  syncStateFromInputs();
});

elements.fabricUnit.addEventListener("change", () => {
  syncStateFromInputs();
});

elements.patternMode.addEventListener("change", () => {
  syncStateFromInputs();
});

elements.blurStrength.addEventListener("input", () => {
  syncStateFromInputs();
});

elements.blurStrength.addEventListener("change", () => {
  updateAll();
});

elements.smoothing.addEventListener("change", () => {
  syncStateFromInputs();
  updateAll();
});

elements.smoothing.addEventListener("input", () => {
  syncStateFromInputs();
  updateAll();
});

elements.printPdf.addEventListener("click", () => {
  printPdf();
});

elements.saveProject.addEventListener("click", () => {
  saveProject();
});

elements.loadProject.addEventListener("click", () => {
  elements.projectFile.click();
});

elements.projectFile.addEventListener("change", (event) => {
  const file = event.target.files[0];
  loadProject(file);
  event.target.value = "";
});

elements.openManage.addEventListener("click", () => {
  openManageModal();
});

elements.manageClose.addEventListener("click", () => {
  closeManageModal();
});

elements.manageModal.addEventListener("click", (event) => {
  if (event.target === elements.manageModal) {
    closeManageModal();
  }
});

elements.manageMaximize.addEventListener("click", () => {
  state.manageModalMaximized = !state.manageModalMaximized;
  elements.manageModal.classList.toggle("maximized", state.manageModalMaximized);
  if (window.lucide?.createIcons) {
    elements.manageMaximize.innerHTML = `
      <i data-lucide="${state.manageModalMaximized ? "minimize-2" : "maximize-2"}"></i>
    `;
    window.lucide.createIcons();
  }
});

elements.managePick.addEventListener("click", () => {
  state.manageMode = "pick";
  updateManageToolbar();
});

elements.manageSelect.addEventListener("click", () => {
  openPaletteSearch(null, "select");
});

elements.managePaint.addEventListener("click", () => {
  state.manageMode = "paint";
  updateManageToolbar();
});

elements.manageBucket.addEventListener("click", () => {
  state.manageMode = "bucket";
  updateManageToolbar();
});

elements.manageUndo.addEventListener("click", () => {
  undoManageChange();
});

elements.manageRedo.addEventListener("click", () => {
  redoManageChange();
});

elements.manageCanvas.addEventListener("mousedown", (event) => {
  if (event.button === 2) {
    event.preventDefault();
    const index = getManageCellIndex(event);
    if (!Number.isFinite(index)) return;
    state.manageColorIndex = state.mappedPixels[index];
    state.managePendingColor = null;
    state.manageMode = "paint";
    updateManageToolbar();
    return;
  }
  if (state.manageMode === "pick") {
    handleManageClick(event);
    return;
  }
  if (state.manageMode === "bucket") {
    handleManageClick(event);
    return;
  }
  state.managePainting = true;
  startManageBatch();
  const index = getManageCellIndex(event);
  paintManageCell(index);
});

elements.manageCanvas.addEventListener("mousemove", (event) => {
  if (!state.managePainting || state.manageMode !== "paint") return;
  const index = getManageCellIndex(event);
  paintManageCell(index);
});

elements.manageCanvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

elements.manageCanvas.addEventListener("mouseup", () => {
  state.managePainting = false;
  finalizeManageBatch();
});

elements.manageCanvas.addEventListener("mouseleave", () => {
  state.managePainting = false;
  finalizeManageBatch();
});

window.addEventListener("mouseup", () => {
  state.managePainting = false;
  finalizeManageBatch();
});

window.addEventListener("keydown", (event) => {
  const isMod = event.ctrlKey || event.metaKey;
  if (!isMod || !state.manageModalOpen) return;
  if (event.key.toLowerCase() !== "z") return;
  event.preventDefault();
  if (event.shiftKey) {
    redoManageChange();
  } else {
    undoManageChange();
  }
});

elements.legendList.addEventListener("click", (event) => {
  const visibility = event.target.closest(".legend-switch");
  if (visibility) {
    const index = Number(visibility.dataset.index);
    if (!Number.isFinite(index)) return;
    const color = state.mappedPalette[index];
    if (!color) return;
    toggleHiddenColor(color);
    renderOutput();
    updateLegend();
    return;
  }
  const button = event.target.closest(".legend-action");
  if (!button) return;
  const index = Number(button.dataset.index);
  if (!Number.isFinite(index)) return;
  openPaletteSearch(index);
});

elements.paletteSearchInput.addEventListener("input", (event) => {
  renderPaletteSearch(event.target.value);
});

elements.paletteSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePaletteSearch();
  }
});

elements.paletteSearchResults.addEventListener("click", (event) => {
  const item = event.target.closest(".search-result");
  if (!item) return;
  const palette = getPalette();
  if (!palette) return;
  const hex = item.dataset.hex;
  const match = palette.colors.find((color) => color.hex === hex);
  if (!match) return;
  if (state.paletteSearchMode === "select") {
    selectManageColor(match);
  } else {
    applyPaletteReplacement(match);
  }
});

elements.paletteSearchClose.addEventListener("click", () => {
  closePaletteSearch();
});

elements.paletteSearchModal.addEventListener("click", (event) => {
  if (event.target === elements.paletteSearchModal) {
    closePaletteSearch();
  }
});
