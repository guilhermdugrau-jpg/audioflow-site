/* ============================================================
   AudioFlow — Frontend "Studio"
   Link + busca pública (sem login) + fila + downloads
   ============================================================ */

"use strict";

const $ = (id) => document.getElementById(id);

const el = {
  input: $("url-input"),
  clear: $("clear-btn"),
  paste: $("paste-btn"),
  metaLine: $("url-hint"),
  metaCard: $("meta-card"),
  metaCover: $("meta-cover"),
  metaType: $("meta-type"),
  metaName: $("meta-name"),
  metaCount: $("meta-count"),
  statusDot: $("status-indicator"),
  statusText: $("status-text"),
  globalProgress: $("global-progress"),
  globalProgressFill: $("global-progress-fill"),
  globalProgressLabel: $("global-progress-label"),
  globalProgressValue: $("global-progress-value"),
  downloadBtn: $("download-btn"),
  downloadLabel: $("download-label"),
  downloadLoader: $("download-btn") ? $("download-btn").querySelector(".btn__loader") : null,
  stopBtn: $("stop-btn"),
  settingsToggle: $("settings-toggle"),
  settingsPanel: $("settings-panel"),
  settingsBackdrop: $("settings-backdrop"),
  settingsDrawer: $("settings-drawer"),
  settingsClose: $("settings-close"),
  formatHidden: $("format"),
  qualityHidden: $("quality"),
  tracknum: $("tracknum"),
  trackList: $("track-list"),
  trackEmpty: $("track-empty"),
  countBadge: $("count-badge"),
  tracksPanel: $("tracks-panel"),
  tracksBody: $("tracks-body"),
  tracksToggle: $("tracks-toggle"),
  downloadsPanel: $("downloads-panel"),
  downloadsList: $("downloads-list"),
  downloadZip: $("download-zip"),
  toastContainer: $("toast-container"),
  webNotice: $("web-notice"),
  wmEnabled: $("wm-enabled"),
  wmOptions: $("wm-options"),
  wmText: $("wm-text"),
  wmPosition: $("wm-position"),
  wmVolume: $("wm-volume"),
  wmVolumeLabel: $("wm-volume-label"),
  wmEcho: $("wm-effect-echo"),
  wmReverb: $("wm-effect-reverb"),
  wmDeep: $("wm-effect-deep"),
  wmRadio: $("wm-effect-radio"),
  wmVoice: $("wm-voice"),
  wmPreview: $("wm-preview"),
  wmPreviewLabel: $("wm-preview-label"),
  wmPreviewLoader: $("wm-preview") ? $("wm-preview").querySelector(".btn__loader") : null,
  wmRepeatEvery: $("wm-repeat-every"),
  wmRepeatCount: $("wm-repeat-count"),
  formatGrid: $("format-grid"),
  qualitySelector: $("quality-selector"),
  // Studio
  modeSwitch: $("mode-switch"),
  modeLink: $("mode-link"),
  modeSearch: $("mode-search"),
  urlWrapper: $("url-wrapper"),
  searchWrapper: $("search-wrapper"),
  searchInput: $("search-input"),
  searchClear: $("search-clear"),
  searchPanel: $("search-panel"),
  searchResults: $("search-results"),
  searchStatus: $("search-status"),
  searchEmpty: $("search-empty"),
  searchRecent: $("search-recent"),
  searchClose: $("search-close"),
  composerHint: $("composer-hint"),
  summaryFormat: $("summary-format"),
  summaryQuality: $("summary-quality"),
  summaryWatermark: $("summary-watermark"),
  summaryTracknum: $("summary-tracknum"),
  summarySettings: $("summary-settings"),
  tipSearch: $("tip-search"),
};

function getApi() {
  return (window.pywebview && window.pywebview.api) || null;
}

function isHttpMode() {
  return !(window.pywebview && window.pywebview.api);
}

const API_BASE = String(window.AUDIOFLOW_API_BASE || "").replace(/\/+$/, "");
const API_TOKEN = String(window.AUDIOFLOW_API_TOKEN || "");
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const SPOTIFY_RE = /(?:open\.spotify\.com\/(?:intl-[a-z]{2,}\/)?|spotify:)(?:playlist|track|album)[/:]/i;
const DEEZER_RE = /^deezer:(track|album|playlist):\d{1,20}$/;

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
}

function sessionId() {
  const key = "audioflow.session";
  let sid = "";
  try { sid = localStorage.getItem(key) || ""; } catch { }
  if (!sid) {
    sid = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem(key, sid); } catch { }
  }
  return sid;
}

function apiHeaders(extra) {
  const headers = Object.assign({}, extra || {});
  headers["X-AudioFlow-Session"] = sessionId();
  if (API_TOKEN) headers["Authorization"] = "Bearer " + API_TOKEN;
  return headers;
}

function apiUrl(path) {
  return (LOCAL_HOST ? "" : API_BASE) + path;
}

function fileUrl(path) {
  const url = apiUrl(path);
  if (!API_TOKEN) return url;
  return url + (url.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(API_TOKEN);
}

async function fetchJson(path, options = {}, timeoutMs = 90000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(apiUrl(path), { ...options, signal: controller.signal });
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    if (!response.ok) {
      const message =
        (data && (data.error || data.detail)) ||
        (response.status === 502 || response.status === 503
          ? "Servidor acordando… tente novamente em instantes."
          : "Servidor indisponível (HTTP " + response.status + ").");
      throw new Error(message);
    }
    return data;
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error("O servidor demorou para responder. Tente novamente.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function httpCall(method, ...args) {
  const data = await fetchJson("/api/call", {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ method, args }),
  });
  if (!data || !data.ok) throw new Error((data && data.error) || "Erro no app.");
  return data.result;
}

function callApi(method, ...args) {
  const api = getApi();
  if (api && typeof api[method] === "function") return Promise.resolve(api[method](...args));
  if (isHttpMode()) return httpCall(method, ...args);
  return Promise.reject(new Error("Bridge com o app indisponível."));
}

function callApiTimeout(method, timeoutMs, ...args) {
  return Promise.race([
    callApi(method, ...args),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("bridge " + method + " demorou demais")), timeoutMs);
    }),
  ]);
}

function waitForBridge(timeoutMs) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    (function probe() {
      if (getApi()) return resolve(true);
      if (Date.now() >= deadline) return resolve(false);
      setTimeout(probe, 120);
    })();
  });
}

/* --- Polling de eventos ------------------------------------ */
function startEventPoll() {
  let since = 0;
  let interval = 1400;
  const FAST = 450;
  const SLOW = 2400;

  async function tick() {
    try {
      const data = await fetchJson("/api/events?since=" + since, { headers: apiHeaders() }, 15000);
      if (data && Array.isArray(data.events) && data.events.length) {
        for (const event of data.events) window.audioflow_event(event);
        interval = FAST;
      } else {
        interval = Math.min(interval + 120, SLOW);
      }
      if (data && typeof data.seq === "number") {
        since = data.seq < since ? 0 : data.seq;
      }
    } catch {
      interval = Math.min(interval + 600, 6000);
    }
    setTimeout(tick, interval);
  }
  tick();
}

/* --- Ícones e placeholders --------------------------------- */
const Icons = {
  ok: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  err: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
  info: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  warn: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
};

const MUSIC_PH =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3a9 9 0 0 0-3.6 17.24c.45.08.62-.19.62-.43v-1.5c-2.52.55-3.05-1.22-3.05-1.22-.41-1.05-1-1.33-1-1.33-.82-.56.06-.55.06-.55.9.06 1.38.93 1.38.93.8 1.38 2.11.98 2.63.75.08-.58.31-.98.57-1.2-2-.23-4.1-1-4.1-4.45 0-.98.35-1.79.93-2.42-.1-.23-.4-1.15.08-2.39 0 0 .76-.24 2.48.93a8.6 8.6 0 0 1 4.52 0c1.72-1.17 2.48-.93 2.48-.93.49 1.24.18 2.16.09 2.39.58.63.92 1.44.92 2.42 0 3.45-2.1 4.22-4.1 4.45.32.28.61.82.61 1.66v2.46c0 .24.16.52.62.43A9 9 0 0 0 12 3z"/></svg>';

const DOWNLOAD_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

const SPOTIFY_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.4a.75.75 0 0 1-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.15a.75.75 0 1 1-.34-1.46c4.58-1.05 8.5-.6 11.66 1.33.35.21.46.67.26 1.03zm1.23-2.74a.94.94 0 0 1-1.29.31c-3.23-1.98-8.15-2.56-11.97-1.4a.94.94 0 1 1-.54-1.8c4.36-1.32 9.78-.68 13.49 1.6.44.27.58.85.31 1.29zm.11-2.85C14.08 8.52 7.9 8.31 4.2 9.43a1.12 1.12 0 1 1-.65-2.15c4.25-1.29 11.08-1.04 15.45 1.55a1.12 1.12 0 0 1-1.15 1.92z"/></svg>';

/* --- Estado ------------------------------------------------ */
const STATE = {
  busy: false,
  mode: "link",
  meta: null,
  tracks: new Map(),
  progress: 0,
  cancelTimer: null,
  maxTracks: 50,
  searchQuery: "",
  searchResults: [],
  searchLoading: false,
  searchSeq: 0,
  searchTimer: null,
  searchCache: new Map(),
  recent: [],
};

const trackRows = new Map();
const downloads = new Map();

/* --- Formatação -------------------------------------------- */
function fmtBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes, i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return value.toFixed(value >= 10 || i === 0 ? 0 : 1) + " " + units[i];
}

function fmtSpeed(bytesPerSec) {
  if (!bytesPerSec) return "…";
  return fmtBytes(bytesPerSec) + "/s";
}

function fmtDuration(ms) {
  if (!ms || ms < 0) return "";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes + ":" + String(seconds).padStart(2, "0");
}

function sizedCover(url, size) {
  if (!url) return url;
  if (url.includes("dzcdn.net")) {
    return url.replace(/\/\d+x\d+-/, "/" + size + "x" + size + "-");
  }
  return url;
}

/* --- Status / progresso ------------------------------------ */
function setStatus(mode) {
  const busy = mode === "busy";
  if (el.statusDot) {
    el.statusDot.classList.toggle("status-indicator--busy", busy);
    el.statusDot.classList.toggle("status-indicator--ready", !busy);
  }
  if (el.statusText) el.statusText.textContent = busy ? "Baixando" : "Pronto";
}

function idleLabel() {
  return STATE.mode === "search" ? "Buscar" : "Iniciar";
}

function setDownloadLoading(loading) {
  if (el.downloadBtn) {
    el.downloadBtn.disabled = loading || STATE.busy;
    el.downloadBtn.classList.toggle("btn--loading", loading);
  }
  if (el.downloadLabel) el.downloadLabel.textContent = loading ? "Preparando…" : idleLabel();
  if (el.downloadLoader) el.downloadLoader.hidden = !loading;
}

function setBusy(busy) {
  STATE.busy = busy;
  document.body.classList.toggle("is-busy", busy);
  if (el.stopBtn) el.stopBtn.disabled = !busy;
  if (el.downloadBtn) {
    el.downloadBtn.disabled = busy;
    el.downloadBtn.classList.remove("btn--loading");
  }
  if (el.downloadLoader) el.downloadLoader.hidden = true;
  setStatus(busy ? "busy" : "ready");
  if (!busy && el.downloadLabel) el.downloadLabel.textContent = idleLabel();
  if (el.globalProgress) {
    el.globalProgress.hidden = !busy && STATE.progress <= 0;
  }
}

function setProgress(percent, label) {
  const value = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : STATE.progress;
  STATE.progress = value;
  const indeterminate = STATE.busy && value <= 0;
  if (el.globalProgress) {
    el.globalProgress.classList.toggle("is-indeterminate", indeterminate);
  }
  if (el.globalProgressFill) el.globalProgressFill.style.width = value + "%";
  if (el.globalProgressValue) {
    el.globalProgressValue.textContent = indeterminate ? "…" : Math.round(value) + "%";
  }
  if (el.globalProgress) {
    el.globalProgress.setAttribute("aria-valuenow", String(Math.round(value)));
    el.globalProgress.hidden = !STATE.busy && value <= 0;
  }
  if (label !== undefined && el.globalProgressLabel) {
    el.globalProgressLabel.textContent = label || "";
    el.globalProgressLabel.hidden = !label;
  }
}

/* --- Toasts ------------------------------------------------ */
function toast(kind, message) {
  if (!el.toastContainer) return;
  const node = document.createElement("div");
  node.className = "toast toast--" + kind;
  node.innerHTML = Icons[kind] || Icons.info;
  const span = document.createElement("span");
  span.textContent = message;
  node.appendChild(span);
  el.toastContainer.appendChild(node);
  setTimeout(() => {
    node.classList.add("toast--out");
    setTimeout(() => node.remove(), 280);
  }, 3600);
}

/* --- Formatos e qualidade ---------------------------------- */
const FORMATS = [
  { value: "m4a", label: "M4A", desc: "Nativo" },
  { value: "mp3", label: "MP3", desc: "Universal" },
  { value: "opus", label: "Opus", desc: "Eficiente" },
  { value: "flac", label: "FLAC", desc: "Lossless" },
  { value: "wav", label: "WAV", desc: "Sem perdas" },
];

const QUALITIES = [128, 192, 256, 320];

function renderFormats() {
  if (!el.formatGrid) return;
  el.formatGrid.innerHTML = FORMATS.map((format) =>
    '<label class="format-option">' +
      '<input type="radio" name="format-radio" value="' + format.value + '"' +
        (format.value === el.formatHidden.value ? " checked" : "") + ">" +
      '<span class="format-option__label">' +
        '<span class="format-option__name">' + format.label + "</span>" +
        '<span class="format-option__desc">' + format.desc + "</span>" +
      "</span>" +
    "</label>"
  ).join("");

  el.formatGrid.querySelectorAll('input[name="format-radio"]').forEach((input) => {
    input.addEventListener("change", () => {
      el.formatHidden.value = input.value;
      updateSummary();
      scheduleSave();
    });
  });
  updateSummary();
}

function renderQualities() {
  if (!el.qualitySelector) return;
  el.qualitySelector.innerHTML = QUALITIES.map((quality) =>
    '<label class="quality-option">' +
      '<input type="radio" name="quality-radio" value="' + quality + '"' +
        (quality === parseInt(el.qualityHidden.value, 10) ? " checked" : "") + ">" +
      '<span class="quality-option__label">' + quality + " kbps</span>" +
    "</label>"
  ).join("");

  el.qualitySelector.querySelectorAll('input[name="quality-radio"]').forEach((input) => {
    input.addEventListener("change", () => {
      el.qualityHidden.value = input.value;
      updateSummary();
      scheduleSave();
    });
  });
  updateSummary();
}

function updateFormatOptions(allowed) {
  if (!Array.isArray(allowed) || !el.formatGrid) return;
  el.formatGrid.querySelectorAll(".format-option").forEach((option) => {
    const input = option.querySelector("input");
    option.style.display = allowed.includes(input.value) ? "" : "none";
  });
  if (!allowed.includes(el.formatHidden.value)) {
    el.formatHidden.value = allowed[0] || "m4a";
    renderFormats();
  }
}

function updateQualityOptions(allowed) {
  if (!Array.isArray(allowed) || !el.qualitySelector) return;
  el.qualitySelector.querySelectorAll(".quality-option").forEach((option) => {
    const input = option.querySelector("input");
    option.style.display = allowed.includes(parseInt(input.value, 10)) ? "" : "none";
  });
  if (!allowed.includes(parseInt(el.qualityHidden.value, 10))) {
    el.qualityHidden.value = String(allowed[0] || 192);
    renderQualities();
  }
}

function updateSummary() {
  const format = (el.formatHidden && el.formatHidden.value ? el.formatHidden.value : "m4a").toUpperCase();
  const quality = (el.qualityHidden && el.qualityHidden.value) || "192";
  if (el.summaryFormat) el.summaryFormat.textContent = format;
  if (el.summaryQuality) el.summaryQuality.textContent = quality + " kbps";
  if (el.summaryWatermark) {
    el.summaryWatermark.textContent = el.wmEnabled && el.wmEnabled.checked
      ? "Ativa · " + (el.wmVolume ? el.wmVolume.value : 45) + "%"
      : "Desativada";
  }
  if (el.summaryTracknum) {
    el.summaryTracknum.textContent = el.tracknum && el.tracknum.checked ? "Ligada" : "Desligada";
  }
}

/* --- Meta -------------------------------------------------- */
let metaSeq = 0;
let metaTimer = null;

function metaText(info) {
  const kind = info.type === "playlist" ? "Playlist" : info.type === "album" ? "Álbum" : "Faixa";
  const name = info.name ? " — " + info.name : "";
  let total = "";
  if (info.type !== "track" && info.total) {
    total = " · " + info.total + " " + (info.total === 1 ? "música" : "músicas");
  }
  return kind + name + total;
}

function defaultHint() {
  return STATE.mode === "search"
    ? "Busque por nome, artista ou álbum — sem login"
    : "Cole um link de playlist, álbum ou faixa do Spotify";
}

async function refreshMeta() {
  const seq = ++metaSeq;
  const url = el.input.value.trim();
  if (!url) { setMetaState("empty"); return; }
  if (!SPOTIFY_RE.test(url)) {
    setMetaState("error", "Cole um link do Spotify (playlist, álbum ou faixa).");
    return;
  }
  setMetaState("loading");
  try {
    const info = await callApi("fetch_meta", url);
    if (seq !== metaSeq) return;
    STATE.meta = info;
    setMetaState("success", info);
  } catch (error) {
    if (seq !== metaSeq) return;
    setMetaState("error", (error && error.message) || "Não foi possível analisar este link.");
  }
}

function setMetaState(state, data) {
  if (!el.metaCard) return;
  if (state === "empty") {
    el.metaCard.hidden = true;
    if (el.metaLine) {
      el.metaLine.textContent = defaultHint();
      el.metaLine.className = "url-hint";
    }
    return;
  }
  if (state === "loading") {
    el.metaCard.hidden = true;
    if (el.metaLine) {
      el.metaLine.textContent = "Analisando link…";
      el.metaLine.className = "url-hint meta--loading";
    }
    return;
  }
  if (state === "error") {
    el.metaCard.hidden = true;
    if (el.metaLine) {
      el.metaLine.textContent = data;
      el.metaLine.className = "url-hint meta--error";
    }
    return;
  }

  const info = data;
  el.metaCard.hidden = false;
  if (el.metaLine) {
    el.metaLine.textContent = metaText(info);
    el.metaLine.className = "url-hint meta--success";
  }
  if (el.metaType) {
    el.metaType.textContent = info.type === "playlist" ? "Playlist" : info.type === "album" ? "Álbum" : "Faixa";
  }
  if (el.metaName) el.metaName.textContent = info.name || "";
  if (el.metaCount) {
    el.metaCount.textContent = info.type !== "track" && info.total
      ? info.total + " " + (info.total === 1 ? "música" : "músicas")
      : "";
  }
  if (el.metaCover) {
    if (info.cover) {
      el.metaCover.innerHTML =
        '<img src="' + escapeHtml(sizedCover(info.cover, 120)) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
    } else {
      el.metaCover.innerHTML = MUSIC_PH;
    }
  }
}

/* --- Fila -------------------------------------------------- */
const badgeLabel = { downloading: "Baixando", ok: "Baixada", skip: "Já existia", fail: "Falhou" };

function makeThumb(cover) {
  const thumb = document.createElement("span");
  thumb.className = "track__thumb";
  if (!cover) {
    thumb.innerHTML = MUSIC_PH;
    return thumb;
  }
  const img = document.createElement("img");
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";
  img.onerror = () => { thumb.innerHTML = MUSIC_PH; };
  img.src = sizedCover(cover, 96);
  thumb.appendChild(img);
  return thumb;
}

function makeRow(id) {
  const row = document.createElement("div");
  row.className = "track";
  row.dataset.id = id;

  const thumb = document.createElement("span");
  thumb.className = "track__thumb";
  thumb.innerHTML = MUSIC_PH;

  const name = document.createElement("span");
  name.className = "track__name";

  const badge = document.createElement("span");
  badge.className = "badge";

  row.append(thumb, name, badge);
  return { row, thumb, name, badge, cover: undefined };
}

function updateTrackCount() {
  const total = STATE.tracks.size;
  if (el.countBadge) {
    el.countBadge.hidden = total === 0;
    el.countBadge.textContent = String(total);
  }
  if (el.trackEmpty) el.trackEmpty.hidden = total > 0;
}

function upsertTrack(id, name, status, cover, detail) {
  STATE.tracks.set(id, { name, status, cover, detail });
  let node = trackRows.get(id);
  if (!node) {
    node = makeRow(id);
    trackRows.set(id, node);
    if (el.trackList) el.trackList.appendChild(node.row);
  }
  if (name && node.name.textContent !== name) {
    node.name.textContent = name;
    node.name.title = name;
  }
  if (cover !== node.cover) {
    node.cover = cover;
    node.thumb.replaceWith(makeThumb(cover));
    node.thumb = node.row.querySelector(".track__thumb");
  }
  node.badge.className = "badge badge--" + status;
  node.badge.textContent = badgeLabel[status] || status;
  node.badge.title = status === "fail" && detail ? detail : "";
  node.badge.style.cursor = status === "fail" && detail ? "pointer" : "";
  node.badge.onclick = status === "fail" && detail
    ? (event) => {
        event.stopPropagation();
        toast("error", detail);
      }
    : null;
  updateTrackCount();

  const nearBottom = el.trackList &&
    (el.trackList.scrollHeight - el.trackList.scrollTop - el.trackList.clientHeight < 90);
  if (nearBottom) el.trackList.scrollTop = el.trackList.scrollHeight;
}

function clearTracks() {
  STATE.tracks.clear();
  trackRows.clear();
  if (el.trackList) {
    el.trackList.querySelectorAll(".track").forEach((node) => node.remove());
  }
  if (el.countBadge) {
    el.countBadge.hidden = true;
    el.countBadge.textContent = "0";
  }
  if (el.trackEmpty) {
    el.trackEmpty.hidden = false;
    if (el.trackList) el.trackList.appendChild(el.trackEmpty);
  }
}

/* --- Downloads --------------------------------------------- */
function addDownload(file) {
  if (!file || !file.url) return;
  const url = fileUrl(file.url);
  if (downloads.has(url)) return;
  downloads.set(url, file);
  if (el.downloadsPanel) el.downloadsPanel.hidden = false;

  const item = document.createElement("li");

  const icon = document.createElement("span");
  icon.className = "downloads__icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = DOWNLOAD_ICON;

  const name = document.createElement("span");
  name.className = "downloads__name";
  name.textContent = file.name || "arquivo";
  name.title = file.name || "";

  const right = document.createElement("span");
  right.className = "downloads__right";

  const size = document.createElement("small");
  size.textContent = file.size ? fmtBytes(file.size) : "";

  const link = document.createElement("a");
  link.href = url;
  link.textContent = "Baixar";
  link.setAttribute("download", "");

  right.append(size, link);
  item.append(icon, name, right);
  if (el.downloadsList) el.downloadsList.append(item);
}

function renderDownloads(files, zip) {
  if (Array.isArray(files)) files.forEach(addDownload);
  if (zip && el.downloadZip) {
    el.downloadZip.href = fileUrl(zip);
    el.downloadZip.hidden = false;
  }
}

function resetDownloads() {
  downloads.clear();
  if (el.downloadsList) el.downloadsList.innerHTML = "";
  if (el.downloadsPanel) el.downloadsPanel.hidden = true;
  if (el.downloadZip) {
    el.downloadZip.hidden = true;
    el.downloadZip.removeAttribute("href");
  }
}

/* --- Download ---------------------------------------------- */
function currentSettings() {
  return {
    format: el.formatHidden.value,
    quality: parseInt(el.qualityHidden.value, 10),
    tracknum: el.tracknum ? el.tracknum.checked : false,
    watermark: wmState(),
  };
}

async function startDownload(uriOverride) {
  if (STATE.busy) {
    toast("info", "Aguarde o download atual terminar.");
    return;
  }

  const explicit = typeof uriOverride === "string" && DEEZER_RE.test(uriOverride);
  const url = explicit ? uriOverride : el.input.value.trim();

  if (!explicit) {
    if (!url) {
      toast("error", "Cole um link do Spotify primeiro.");
      el.input.focus();
      return;
    }
    if (!SPOTIFY_RE.test(url)) {
      toast("error", "Cole um link válido do Spotify (playlist, álbum ou faixa).");
      el.input.focus();
      return;
    }
  }

  clearTimeout(STATE.cancelTimer);
  clearTracks();
  resetDownloads();
  setDownloadLoading(true);
  setProgress(0, explicit ? "Preparando faixa…" : "Iniciando…");
  setBusy(true);

  try {
    await callApi("download", url, currentSettings());
    if (el.downloadLabel) el.downloadLabel.textContent = "Baixando…";
  } catch (error) {
    toast("error", (error && error.message) || "Erro ao iniciar o download.");
    setBusy(false);
    setDownloadLoading(false);
    setProgress(0, "");
  }
}

async function stopDownload() {
  if (!STATE.busy) return;
  if (el.stopBtn) el.stopBtn.disabled = true;
  if (el.downloadBtn) el.downloadBtn.disabled = true;
  if (el.downloadLabel) el.downloadLabel.textContent = "Cancelando…";
  setProgress(0, "Cancelando…");
  clearTimeout(STATE.cancelTimer);
  STATE.cancelTimer = setTimeout(() => {
    if (!STATE.busy) return;
    setBusy(false);
    setDownloadLoading(false);
    setProgress(0, "Cancelamento solicitado.");
    toast("info", "Cancelamento solicitado.");
  }, 20000);
  try { await callApi("cancel"); } catch { }
}

/* --- Busca ------------------------------------------------- */
function rememberSearch(query) {
  const clean = query.trim();
  if (!clean) return;
  STATE.recent = [clean, ...STATE.recent.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 5);
  try { localStorage.setItem("audioflow.recentSearches", JSON.stringify(STATE.recent)); } catch { }
  renderRecent();
}

function loadRecent() {
  try {
    const saved = JSON.parse(localStorage.getItem("audioflow.recentSearches") || "[]");
    STATE.recent = Array.isArray(saved)
      ? saved.filter((item) => typeof item === "string" && item.trim()).slice(0, 5)
      : [];
  } catch {
    STATE.recent = [];
  }
}

function renderRecent() {
  if (!el.searchRecent) return;
  const visible = STATE.mode === "search" && !STATE.searchResults.length && !STATE.searchLoading && STATE.recent.length > 0;
  el.searchRecent.hidden = !visible;
  el.searchRecent.innerHTML = "";
  if (!visible) return;

  const label = document.createElement("span");
  label.className = "search-recent__label";
  label.textContent = "Recentes";
  el.searchRecent.appendChild(label);

  STATE.recent.forEach((query) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "search-recent__chip";
    chip.textContent = query;
    chip.addEventListener("click", () => {
      if (el.searchInput) el.searchInput.value = query;
      if (el.searchClear) el.searchClear.hidden = false;
      runSearch(query, true);
    });
    el.searchRecent.appendChild(chip);
  });
}

function showSearchPanel() {
  if (!el.searchPanel) return;
  if (STATE.searchResults.length) {
    el.searchPanel.hidden = false;
    return;
  }
  if (STATE.recent.length) {
    el.searchPanel.hidden = false;
    if (el.searchStatus) el.searchStatus.textContent = "Buscas recentes";
    if (el.searchEmpty) el.searchEmpty.hidden = true;
    renderRecent();
    return;
  }
  el.searchPanel.hidden = true;
}

function renderSearchSkeleton() {
  if (!el.searchResults) return;
  el.searchResults.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 4; i++) {
    const row = document.createElement("div");
    row.className = "search-skeleton";
    row.innerHTML =
      '<span class="search-skeleton__thumb"></span>' +
      '<span><span class="search-skeleton__line"></span><span class="search-skeleton__line search-skeleton__line--short"></span></span>' +
      '<span class="search-skeleton__line"></span>';
    fragment.appendChild(row);
  }
  el.searchResults.appendChild(fragment);
}

function renderSearchResults(results) {
  if (!el.searchResults) return;
  el.searchResults.innerHTML = "";
  const fragment = document.createDocumentFragment();

  results.forEach((item) => {
    const overLimit = Number(item.track_count || 0) > STATE.maxTracks;
    const row = document.createElement("div");
    row.className = "search-result" + (overLimit ? " is-disabled" : "");
    row.dataset.uri = item.uri;
    row.setAttribute("role", "button");
    row.tabIndex = 0;
    row.setAttribute("aria-label", "Baixar " + item.title);
    if (overLimit) {
      row.title = "Essa coleção tem " + item.track_count + " faixas. O limite é " + STATE.maxTracks + ".";
    }

    const cover = document.createElement("span");
    cover.className = "search-result__cover";
    const imageUrl = item.thumb || item.cover;
    if (imageUrl) {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.src = sizedCover(imageUrl, 96);
      img.onerror = () => { cover.innerHTML = MUSIC_PH; };
      cover.appendChild(img);
    } else {
      cover.innerHTML = MUSIC_PH;
    }

    const body = document.createElement("span");
    body.className = "search-result__body";
    const title = document.createElement("span");
    title.className = "search-result__title";
    title.textContent = item.title || "Sem título";
    const subtitle = document.createElement("span");
    subtitle.className = "search-result__sub";
    subtitle.textContent = item.subtitle || "";
    body.append(title, subtitle);

    const meta = document.createElement("span");
    meta.className = "search-result__meta";
    const badge = document.createElement("span");
    badge.className = "search-result__badge" + (item.type === "album" ? " search-result__badge--album" : item.type === "playlist" ? " search-result__badge--playlist" : "");
    badge.textContent = item.type === "album" ? "Álbum" : item.type === "playlist" ? "Playlist" : "Faixa";
    meta.appendChild(badge);
    if (item.duration_ms) {
      const duration = document.createElement("span");
      duration.className = "search-result__dur";
      duration.textContent = fmtDuration(item.duration_ms);
      meta.appendChild(duration);
    } else if (item.track_count) {
      const count = document.createElement("span");
      count.className = "search-result__dur";
      count.textContent = item.track_count + " fx";
      meta.appendChild(count);
    }

    const actions = document.createElement("span");
    actions.className = "search-result__actions";

    if (item.spotify_url) {
      const spotify = document.createElement("a");
      spotify.className = "icon-btn icon-btn--sm search-result__spotify";
      spotify.href = item.spotify_url;
      spotify.target = "_blank";
      spotify.rel = "noopener noreferrer";
      spotify.title = "Abrir no Spotify";
      spotify.setAttribute("aria-label", "Abrir " + item.title + " no Spotify");
      spotify.innerHTML = SPOTIFY_ICON;
      spotify.addEventListener("click", (event) => event.stopPropagation());
      actions.appendChild(spotify);
    }

    const download = document.createElement("button");
    download.type = "button";
    download.className = "icon-btn icon-btn--sm icon-btn--accent search-result__dl";
    const kindLabel = item.type === "album" ? "álbum" : item.type === "playlist" ? "playlist" : "faixa";
    const countLabel = item.type !== "track" && item.track_count ? " (" + item.track_count + " faixas)" : "";
    download.title = overLimit
      ? "Acima do limite de " + STATE.maxTracks + " faixas"
      : "Baixar " + kindLabel + countLabel;
    download.setAttribute("aria-label", "Baixar " + kindLabel + " " + item.title + countLabel);
    download.innerHTML = DOWNLOAD_ICON;
    if (overLimit) download.disabled = true;
    download.addEventListener("click", (event) => {
      event.stopPropagation();
      selectSearchResult(item, row);
    });
    actions.appendChild(download);

    row.append(cover, body, meta, actions);
    row.addEventListener("click", () => selectSearchResult(item, row));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectSearchResult(item, row);
      }
    });

    fragment.appendChild(row);
  });

  el.searchResults.appendChild(fragment);
}

function selectSearchResult(item, row) {
  if (STATE.busy) {
    toast("info", "Aguarde o download atual terminar.");
    return;
  }
  if (Number(item.track_count || 0) > STATE.maxTracks) {
    toast("error", "Essa coleção tem " + item.track_count + " faixas. O limite é " + STATE.maxTracks + ".");
    return;
  }
  if (row) row.classList.add("is-loading");
  rememberSearch(STATE.searchQuery);
  startDownload(item.uri);
}

async function runSearch(rawQuery, immediate) {
  const query = String(rawQuery || "").replace(/\s+/g, " ").trim();
  if (query.length < 2) {
    if (el.searchStatus) el.searchStatus.textContent = "Digite pelo menos 2 caracteres";
    renderRecent();
    return;
  }

  clearTimeout(STATE.searchTimer);
  if (!immediate) {
    STATE.searchTimer = setTimeout(() => runSearch(query, true), 360);
    return;
  }

  const seq = ++STATE.searchSeq;
  STATE.searchQuery = query;
  STATE.searchLoading = true;
  STATE.searchResults = [];

  if (el.searchPanel) el.searchPanel.hidden = false;
  if (el.searchEmpty) el.searchEmpty.hidden = true;
  if (el.searchRecent) el.searchRecent.hidden = true;
  if (el.searchStatus) el.searchStatus.textContent = "Buscando…";
  renderSearchSkeleton();

  try {
    const key = query.toLowerCase();
    let results = STATE.searchCache.get(key);
    if (!results) {
      const data = await fetchJson(
        "/api/search?q=" + encodeURIComponent(query) + "&limit=12",
        { headers: apiHeaders() },
        15000
      );
      results = Array.isArray(data && data.results) ? data.results : [];
      STATE.searchCache.set(key, results);
      if (STATE.searchCache.size > 30) {
        const oldest = STATE.searchCache.keys().next().value;
        STATE.searchCache.delete(oldest);
      }
    }
    if (seq !== STATE.searchSeq) return;

    STATE.searchResults = results;
    renderSearchResults(results);
    if (el.searchStatus) {
      el.searchStatus.textContent = results.length
        ? results.length + (results.length === 1 ? " resultado" : " resultados")
        : "Nenhum resultado";
    }
    if (!results.length && el.searchEmpty) {
      el.searchEmpty.hidden = false;
      el.searchEmpty.textContent = 'Nada encontrado para “' + query + '”. Tente outro nome.';
    }
    rememberSearch(query);
  } catch (error) {
    if (seq !== STATE.searchSeq) return;
    STATE.searchResults = [];
    if (el.searchResults) el.searchResults.innerHTML = "";
    if (el.searchStatus) el.searchStatus.textContent = "Busca indisponível";
    if (el.searchEmpty) {
      el.searchEmpty.hidden = false;
      el.searchEmpty.textContent = (error && error.message) || "Não foi possível buscar agora.";
    }
  } finally {
    if (seq === STATE.searchSeq) {
      STATE.searchLoading = false;
      renderRecent();
    }
  }
}

function setMode(mode) {
  STATE.mode = mode === "search" ? "search" : "link";
  document.body.dataset.mode = STATE.mode;
  if (el.modeSwitch) el.modeSwitch.dataset.mode = STATE.mode;
  if (el.modeLink) {
    el.modeLink.classList.toggle("is-active", STATE.mode === "link");
    el.modeLink.setAttribute("aria-selected", String(STATE.mode === "link"));
  }
  if (el.modeSearch) {
    el.modeSearch.classList.toggle("is-active", STATE.mode === "search");
    el.modeSearch.setAttribute("aria-selected", String(STATE.mode === "search"));
  }
  if (el.urlWrapper) el.urlWrapper.hidden = STATE.mode === "search";
  if (el.searchWrapper) el.searchWrapper.hidden = STATE.mode === "link";
  if (el.paste) el.paste.hidden = STATE.mode === "search";
  if (el.composerHint) {
    el.composerHint.textContent = STATE.mode === "search"
      ? "Busque por nome, artista ou álbum"
      : "Cole um link do Spotify";
  }
  if (!STATE.busy && el.downloadLabel) el.downloadLabel.textContent = idleLabel();
  if (el.metaLine) {
    el.metaLine.textContent = defaultHint();
    el.metaLine.className = "url-hint";
  }
  if (STATE.mode === "link") {
    if (el.searchPanel) el.searchPanel.hidden = true;
  } else {
    if (el.searchInput) el.searchInput.focus();
    showSearchPanel();
  }
}

/* --- Assinatura de áudio ----------------------------------- */
function wmEffects() {
  const effects = [];
  if (el.wmEcho && el.wmEcho.checked) effects.push("echo");
  if (el.wmReverb && el.wmReverb.checked) effects.push("reverb");
  if (el.wmDeep && el.wmDeep.checked) effects.push("deep");
  if (el.wmRadio && el.wmRadio.checked) effects.push("radio");
  return effects;
}

function wmState() {
  return {
    enabled: el.wmEnabled ? el.wmEnabled.checked : false,
    text: (el.wmText && el.wmText.value.trim()) || "Lucas CDs",
    position: (el.wmPosition && el.wmPosition.value) || "middle",
    volume: parseInt(el.wmVolume ? el.wmVolume.value : 45, 10) / 100,
    effects: wmEffects(),
    voice: (el.wmVoice && el.wmVoice.value) || "deep",
    repeat_every: parseFloat(el.wmRepeatEvery ? el.wmRepeatEvery.value : 0) || 0,
    repeat_count: parseInt(el.wmRepeatCount ? el.wmRepeatCount.value : 0, 10) || 0,
  };
}

function wmApplyConfig(wm) {
  if (!wm) return;
  if (el.wmEnabled) el.wmEnabled.checked = Boolean(wm.enabled);
  if (el.wmOptions) el.wmOptions.hidden = !wm.enabled;
  if (wm.text && el.wmText) el.wmText.value = wm.text;
  if (["start", "middle", "end"].includes(wm.position) && el.wmPosition) el.wmPosition.value = wm.position;
  if (typeof wm.volume === "number" && el.wmVolume) {
    el.wmVolume.value = String(Math.round(wm.volume * 100));
    if (el.wmVolumeLabel) el.wmVolumeLabel.textContent = Math.round(wm.volume * 100) + "%";
  }
  if (typeof wm.repeat_every === "number" && el.wmRepeatEvery) el.wmRepeatEvery.value = String(wm.repeat_every);
  if (typeof wm.repeat_count === "number" && el.wmRepeatCount) el.wmRepeatCount.value = String(wm.repeat_count);
  const effects = wm.effects || [];
  if (el.wmEcho) el.wmEcho.checked = effects.includes("echo");
  if (el.wmReverb) el.wmReverb.checked = effects.includes("reverb");
  if (el.wmDeep) el.wmDeep.checked = effects.includes("deep");
  if (el.wmRadio) el.wmRadio.checked = effects.includes("radio");
  if (el.wmVoice) el.wmVoice.value = ["deep", "ultra", "pt"].includes(wm.voice) ? wm.voice : "deep";
  updateSummary();
}

function wmSyncVolumeLabel() {
  if (el.wmVolumeLabel) el.wmVolumeLabel.textContent = (el.wmVolume ? el.wmVolume.value : 45) + "%";
}

let wmPreviewAudio = null;

function wmPreviewReset() {
  if (el.wmPreview) {
    el.wmPreview.classList.remove("is-playing");
    el.wmPreview.classList.remove("is-loading");
  }
  if (el.wmPreviewLabel) el.wmPreviewLabel.textContent = "Ouvir exemplo";
  if (el.wmPreviewLoader) el.wmPreviewLoader.hidden = true;
}

function wmPreviewStop() {
  if (wmPreviewAudio && !wmPreviewAudio.paused) wmPreviewAudio.pause();
  wmPreviewReset();
}

async function playWmPreview() {
  if (wmPreviewAudio && !wmPreviewAudio.paused) {
    wmPreviewStop();
    return;
  }
  const text = (el.wmText && el.wmText.value.trim()) || "Lucas CDs";
  const params = new URLSearchParams({
    text,
    voice: (el.wmVoice && el.wmVoice.value) || "deep",
    effects: wmEffects().join(","),
    volume: String(parseInt(el.wmVolume ? el.wmVolume.value : 45, 10) / 100),
  });
  const url = fileUrl("/api/watermark/preview?" + params.toString());

  if (el.wmPreview) {
    el.wmPreview.disabled = true;
    el.wmPreview.classList.add("is-loading");
  }
  if (el.wmPreviewLabel) el.wmPreviewLabel.textContent = "Gerando…";
  if (el.wmPreviewLoader) el.wmPreviewLoader.hidden = false;

  try {
    if (!wmPreviewAudio) {
      wmPreviewAudio = new Audio();
      wmPreviewAudio.preload = "none";
      wmPreviewAudio.addEventListener("ended", wmPreviewReset);
      wmPreviewAudio.addEventListener("pause", wmPreviewReset);
      wmPreviewAudio.addEventListener("error", () => {
        wmPreviewReset();
        toast("error", "Não foi possível gerar o exemplo agora.");
      });
    }
    wmPreviewAudio.src = url;
    await wmPreviewAudio.play();
    if (el.wmPreview) {
      el.wmPreview.classList.remove("is-loading");
      el.wmPreview.classList.add("is-playing");
    }
    if (el.wmPreviewLabel) el.wmPreviewLabel.textContent = "Parar";
  } catch {
    wmPreviewReset();
    toast("error", "Não foi possível tocar o exemplo. Tente novamente.");
  } finally {
    if (el.wmPreview) {
      el.wmPreview.disabled = false;
      if (el.wmPreviewLoader) el.wmPreviewLoader.hidden = true;
    }
  }
}

/* --- Eventos do backend ------------------------------------ */
window.audioflow_event = function (payload) {
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { return; }
  }
  if (!payload || typeof payload !== "object") return;

  switch (payload.type) {
    case "queued":
      setBusy(true);
      if (el.downloadLabel) el.downloadLabel.textContent = "Baixando…";
      setProgress(0, payload.message || "Na fila…");
      break;

    case "meta": {
      const info = {
        type: payload.kind || "playlist",
        name: payload.name || "",
        total: payload.total || 0,
        cover: payload.cover || null,
      };
      STATE.meta = info;
      setMetaState("success", info);
      break;
    }

    case "file_ready":
      addDownload(payload);
      break;

    case "track_start":
      setBusy(true);
      if (el.downloadLabel) el.downloadLabel.textContent = "Baixando…";
      upsertTrack(payload.id, payload.name, "downloading", payload.cover);
      break;

    case "track_ok":
    case "track_done":
      upsertTrack(payload.id, payload.name, "ok", payload.cover);
      break;

    case "track_skip":
      upsertTrack(payload.id, payload.name, "skip", payload.cover);
      break;

    case "track_fail":
      upsertTrack(payload.id, payload.name, "fail", payload.cover, payload.detail);
      break;

    case "progress":
      setProgress(typeof payload.percent === "number" ? payload.percent : undefined, payload.label);
      break;

    case "finish": {
      clearTimeout(STATE.cancelTimer);
      const cancelled = Boolean(payload.cancelled) || /^cancelado/i.test(payload.summary || "");
      const files = Array.isArray(payload.files) ? payload.files : [];
      const failed = Number(payload.failed || 0);
      const ok = Number(payload.ok || 0);
      const skipped = Number(payload.skipped || 0);
      setBusy(false);
      document.querySelectorAll(".search-result.is-loading").forEach((row) => row.classList.remove("is-loading"));
      if (cancelled) {
        setProgress(0, payload.summary || "Download cancelado.");
        toast("info", payload.summary || "Download cancelado.");
      } else {
        const success = files.length > 0 || ok + skipped > 0;
        setProgress(success ? 100 : 0, payload.summary || "Concluído.");
        if (failed && !success) {
          toast("error", payload.summary || "Nenhuma faixa foi baixada.");
        } else if (failed) {
          toast("warn", payload.summary || "Concluído com falhas.");
        } else {
          toast("success", payload.summary || "Download concluído.");
        }
      }
      renderDownloads(files, payload.zip);
      break;
    }

    case "expired":
      resetDownloads();
      toast("info", payload.message || "Os arquivos expiraram.");
      break;

    case "error":
      clearTimeout(STATE.cancelTimer);
      setBusy(false);
      setDownloadLoading(false);
      setProgress(0, "");
      document.querySelectorAll(".search-result.is-loading").forEach((row) => row.classList.remove("is-loading"));
      toast("error", payload.message || "Ocorreu um erro.");
      break;
  }
};

/* --- Configuração ------------------------------------------ */
let saveTimer = null;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    callApi("save_config", {
      format: el.formatHidden.value,
      quality: parseInt(el.qualityHidden.value, 10),
      tracknum: el.tracknum ? el.tracknum.checked : false,
      watermark: wmState(),
    }).catch(() => {});
  }, 400);
}

function applyAndroidConfig() {
  const wmSection = el.wmEnabled ? el.wmEnabled.closest(".settings-section") : null;
  if (wmSection) wmSection.hidden = true;
  if (el.wmOptions) el.wmOptions.hidden = true;
  updateFormatOptions(["m4a", "opus"]);
  if (!["m4a", "opus"].includes(el.formatHidden.value)) {
    el.formatHidden.value = "m4a";
    renderFormats();
  }
  window.__android = true;
}

function applyWebConfig(config) {
  window.__web = true;
  document.body.classList.add("is-web");
  if (el.webNotice) el.webNotice.hidden = false;
  const wmSection = el.wmEnabled ? el.wmEnabled.closest(".settings-section") : null;
  if (wmSection) wmSection.hidden = false;
  if (el.wmOptions) el.wmOptions.hidden = !(el.wmEnabled && el.wmEnabled.checked);
  if (Array.isArray(config && config.convert_formats)) updateFormatOptions(config.convert_formats);
  if (Array.isArray(config && config.qualities)) updateQualityOptions(config.qualities);
  if (config && config.quality) {
    el.qualityHidden.value = String(config.quality);
    renderQualities();
  }
}

async function loadConfig() {
  try {
    if (!isHttpMode()) {
      const ready = await waitForBridge(10000);
      if (!ready) return;
    }
    const config = await callApiTimeout("get_config", 5000);
    if (config) {
      if (typeof config.max_tracks === "number" && config.max_tracks > 0) {
        STATE.maxTracks = config.max_tracks;
      }
      if (config.format) {
        el.formatHidden.value = config.format;
        renderFormats();
      }
      if (config.quality) {
        el.qualityHidden.value = String(config.quality);
        renderQualities();
      }
      if (config.tracknum != null && el.tracknum) el.tracknum.checked = Boolean(config.tracknum);
      if (config.platform === "android") applyAndroidConfig();
      else if (config.platform === "web") applyWebConfig(config);
      if (config.watermark) wmApplyConfig(config.watermark);
      updateSummary();
    }
  } catch {
    /* configuração é opcional; a UI já está pronta */
  }
}

/* --- Listeners --------------------------------------------- */
if (el.input) {
  el.input.addEventListener("input", () => {
    if (el.clear) el.clear.hidden = !el.input.value;
    clearTimeout(metaTimer);
    metaTimer = setTimeout(refreshMeta, 450);
  });
}

if (el.clear) {
  el.clear.addEventListener("click", () => {
    el.input.value = "";
    el.clear.hidden = true;
    refreshMeta();
    el.input.focus();
  });
}

if (el.paste) {
  el.paste.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      el.input.value = text.trim();
      el.clear.hidden = !el.input.value;
      refreshMeta();
    } catch {
      toast("error", "Não foi possível acessar a área de transferência.");
    }
  });
}

if (el.input) {
  el.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      startDownload();
    }
  });
}

if (el.downloadBtn) {
  el.downloadBtn.addEventListener("click", () => {
    if (STATE.mode === "search") {
      if (!el.searchInput.value.trim()) {
        el.searchInput.focus();
        toast("info", "Digite o nome de uma música, artista ou álbum.");
        return;
      }
      runSearch(el.searchInput.value, true);
    } else {
      startDownload();
    }
  });
}

if (el.stopBtn) el.stopBtn.addEventListener("click", stopDownload);

if (el.settingsToggle) {
  el.settingsToggle.addEventListener("click", () => {
    const open = !el.settingsPanel.classList.contains("settings-panel--open");
    if (open) openSettings(); else closeSettings();
  });
}

if (el.summarySettings) {
  el.summarySettings.addEventListener("click", openSettings);
}

if (el.settingsClose) el.settingsClose.addEventListener("click", closeSettings);
if (el.settingsBackdrop) el.settingsBackdrop.addEventListener("click", closeSettings);
if (el.settingsPanel) {
  el.settingsPanel.addEventListener("click", (event) => {
    if (event.target === el.settingsPanel) closeSettings();
  });
}
if (el.settingsDrawer) {
  el.settingsDrawer.addEventListener("click", (event) => event.stopPropagation());
}

function openSettings() {
  if (!el.settingsPanel) return;
  el.settingsPanel.classList.add("settings-panel--open");
  if (el.settingsToggle) el.settingsToggle.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
  if (el.settingsClose) setTimeout(() => el.settingsClose.focus(), 120);
}

function closeSettings() {
  if (!el.settingsPanel) return;
  el.settingsPanel.classList.remove("settings-panel--open");
  if (el.settingsToggle) el.settingsToggle.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}

if (el.tracksToggle) {
  el.tracksToggle.addEventListener("click", () => {
    const open = el.tracksBody.classList.toggle("tracks-panel__body--open");
    el.tracksToggle.setAttribute("aria-expanded", String(open));
  });
}

/* modo */
if (el.modeLink) el.modeLink.addEventListener("click", () => setMode("link"));
if (el.modeSearch) el.modeSearch.addEventListener("click", () => setMode("search"));
if (el.tipSearch) {
  el.tipSearch.addEventListener("click", (event) => {
    event.preventDefault();
    setMode("search");
    if (el.searchInput) el.searchInput.focus();
    document.getElementById("composer").scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

/* busca */
if (el.searchInput) {
  el.searchInput.addEventListener("input", () => {
    if (el.searchClear) el.searchClear.hidden = !el.searchInput.value;
    if (!el.searchInput.value.trim()) {
      STATE.searchResults = [];
      STATE.searchSeq++;
      if (el.searchResults) el.searchResults.innerHTML = "";
      showSearchPanel();
      return;
    }
    runSearch(el.searchInput.value, false);
  });

  el.searchInput.addEventListener("focus", () => {
    if (!el.searchInput.value.trim()) showSearchPanel();
    else if (STATE.searchResults.length && el.searchPanel) el.searchPanel.hidden = false;
  });

  el.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch(el.searchInput.value, true);
    } else if (event.key === "Escape") {
      if (el.searchPanel) el.searchPanel.hidden = true;
      el.searchInput.blur();
    }
  });
}

if (el.searchClear) {
  el.searchClear.addEventListener("click", () => {
    el.searchInput.value = "";
    el.searchClear.hidden = true;
    STATE.searchResults = [];
    STATE.searchSeq++;
    if (el.searchResults) el.searchResults.innerHTML = "";
    showSearchPanel();
    el.searchInput.focus();
  });
}

if (el.searchClose) {
  el.searchClose.addEventListener("click", () => {
    if (el.searchPanel) el.searchPanel.hidden = true;
  });
}

/* atalhos */
document.addEventListener("keydown", (event) => {
  const target = event.target;
  const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
  if (event.key === "Escape") {
    if (el.settingsPanel && el.settingsPanel.classList.contains("settings-panel--open")) {
      closeSettings();
    } else if (el.searchPanel && !el.searchPanel.hidden) {
      el.searchPanel.hidden = true;
    }
    return;
  }
  if (!typing && event.key === "/") {
    event.preventDefault();
    setMode("search");
    if (el.searchInput) el.searchInput.focus();
  }
});

/* assinatura */
if (el.wmPreview) el.wmPreview.addEventListener("click", playWmPreview);
if (el.wmEnabled) {
  el.wmEnabled.addEventListener("change", () => {
    if (el.wmOptions) el.wmOptions.hidden = !el.wmEnabled.checked;
    updateSummary();
    scheduleSave();
  });
}
if (el.wmVolume) {
  el.wmVolume.addEventListener("input", () => {
    wmSyncVolumeLabel();
    updateSummary();
    scheduleSave();
  });
}
[el.wmText, el.wmPosition, el.wmEcho, el.wmReverb, el.wmDeep, el.wmRadio, el.wmVoice, el.wmRepeatEvery, el.wmRepeatCount].forEach((node) => {
  if (!node) return;
  node.addEventListener("change", () => {
    wmPreviewStop();
    updateSummary();
    scheduleSave();
  });
});
if (el.wmText) el.wmText.addEventListener("input", scheduleSave);
if (el.wmRepeatEvery) el.wmRepeatEvery.addEventListener("input", scheduleSave);
if (el.wmRepeatCount) el.wmRepeatCount.addEventListener("input", scheduleSave);
if (el.tracknum) {
  el.tracknum.addEventListener("change", () => {
    updateSummary();
    scheduleSave();
  });
}

/* --- Boot -------------------------------------------------- */
(function init() {
  loadRecent();
  renderFormats();
  renderQualities();
  updateSummary();
  setStatus("ready");

  if (isHttpMode()) {
    startEventPoll();
    if (!LOCAL_HOST && !API_BASE) {
      toast("error", "API não configurada. Defina window.AUDIOFLOW_API_BASE no config.js.");
    }
  }

  loadConfig();
})();
