/* ============================================================
   AudioFlow — Frontend logic (OPTIMIZED)
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
  downloadBtn: $("download-btn"),
  downloadLabel: $("download-label"),
  downloadLoader: $("download-btn").querySelector(".btn__loader"),
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
  heroCover: $("meta-cover"),
  appVersion: $("app-version"),
  checkUpdateBtn: $("check-update-btn"),
  updateModal: $("update-modal"),
  updateTitle: $("update-modal-title"),
  updateSubtitle: $("update-modal-subtitle"),
  updateSize: $("update-size"),
  updateNotes: $("update-notes"),
  updateError: $("update-error"),
  updateProgress: $("update-progress"),
  updateProgressFill: $("update-progress-fill"),
  updateProgressMeta: $("update-progress-meta"),
  updateLater: $("update-later-btn"),
  updateNow: $("update-now-btn"),
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
  wmPreviewLoader: $("wm-preview").querySelector(".btn__loader"),
  wmRepeatEvery: $("wm-repeat-every"),
  wmRepeatCount: $("wm-repeat-count"),
  formatGrid: $("format-grid"),
  qualitySelector: $("quality-selector"),
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
    const r = await fetch(apiUrl(path), { ...options, signal: controller.signal });
    let data = null;
    try { data = await r.json(); } catch { data = null; }
    if (!r.ok) {
      const message =
        (data && (data.error || data.detail)) ||
        (r.status === 502 || r.status === 503
          ? "Servidor acordando… tente novamente em instantes."
          : "Servidor indisponível (HTTP " + r.status + ").");
      throw new Error(message);
    }
    return data;
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new Error("O servidor demorou para responder. Tente novamente.");
    }
    throw err;
  } finally { clearTimeout(timer); }
}

async function httpCall(method, ...args) {
  const data = await fetchJson("/api/call", {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ method, args }),
  });
  if (!data || !data.ok) { throw new Error((data && data.error) || "Erro no app."); }
  return data.result;
}

function callApi(method, ...args) {
  const api = getApi();
  if (api && typeof api[method] === "function") { return Promise.resolve(api[method](...args)); }
  if (isHttpMode()) return httpCall(method, ...args);
  return Promise.reject(new Error("Bridge com o app indisponível."));
}

function startEventPoll() {
  let since = 0;
  let pollInterval = 1500;
  const FAST_POLL = 500;
  const SLOW_POLL = 2000;

  async function tick() {
    try {
      const data = await fetchJson("/api/events?since=" + since, { headers: apiHeaders() }, 15000);
      if (data && Array.isArray(data.events) && data.events.length) {
        for (const ev of data.events) window.audioflow_event(ev);
        pollInterval = FAST_POLL;
      } else {
        pollInterval = Math.min(pollInterval + 100, SLOW_POLL);
      }
      if (data && typeof data.seq === "number") {
        since = data.seq < since ? 0 : data.seq;
      }
    } catch { }
    setTimeout(tick, pollInterval);
  }
  tick();
}

const Icons = {
  ok: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  err: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
  info: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  warn: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
};

const MUSIC_PH = '<svg class="track__thumb--ph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3a9 9 0 0 0-3.6 17.24c.45.08.62-.19.62-.43v-1.5c-2.52.55-3.05-1.22-3.05-1.22-.41-1.05-1-1.33-1-1.33-.82-.56.06-.55.06-.55.9.06 1.38.93 1.38.93.8 1.38 2.11.98 2.63.75.08-.58.31-.98.57-1.2-2-.23-4.1-1-4.1-4.45 0-.98.35-1.79.93-2.42-.1-.23-.4-1.15.08-2.39 0 0 .76-.24 2.48.93a8.6 8.6 0 0 1 4.52 0c1.72-1.17 2.48-.93 2.48-.93.49 1.24.18 2.16.09 2.39.58.63.92 1.44.92 2.42 0 3.45-2.1 4.22-4.1 4.45.32.28.61.82.61 1.66v2.46c0 .24.16.52.62.43A9 9 0 0 0 12 3z"/></svg>';

const STATE = {
  busy: false,
  meta: null,
  tracks: new Map(),
  progress: 0,
  cancelTimer: null,
};

const trackRows = new Map();
const downloads = new Map();

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, function(c) {
    var map = { "&": "&", "<": "<", ">": ">", '"': "\"", "'": "'" };
    return map[c];
  });
}

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

function setStatus(mode) {
  const busy = mode === "busy";
  if (el.statusDot) {
    el.statusDot.classList.toggle("status-indicator--busy", busy);
    el.statusDot.classList.toggle("status-indicator--ready", !busy);
  }
  if (el.statusText) el.statusText.textContent = busy ? "Baixando" : "Pronto";
}

function setDownloadLoading(loading) {
  if (el.downloadBtn) {
    el.downloadBtn.disabled = loading || STATE.busy;
    el.downloadBtn.classList.toggle("btn--loading", loading);
  }
  if (el.downloadLabel) el.downloadLabel.textContent = loading ? "Preparando…" : "Iniciar";
  if (el.downloadLoader) el.downloadLoader.hidden = !loading;
}

function setBusy(busy) {
  STATE.busy = busy;
  if (el.stopBtn) el.stopBtn.disabled = !busy;
  if (el.downloadBtn) el.downloadBtn.disabled = busy;
  if (el.downloadBtn) el.downloadBtn.classList.remove("btn--loading");
  setStatus(busy ? "busy" : "ready");
  if (!busy && el.downloadLabel) el.downloadLabel.textContent = "Iniciar";
  if (el.globalProgress) {
    el.globalProgress.hidden = !busy && STATE.progress <= 0;
    el.globalProgress.classList.toggle("global-progress--active", busy && STATE.progress < 100);
  }
}

function setProgress(percent, label) {
  const p = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : STATE.progress;
  STATE.progress = p;
  if (el.globalProgressFill) el.globalProgressFill.style.width = p + "%";
  if (el.globalProgress) {
    el.globalProgress.setAttribute("aria-valuenow", String(Math.round(p)));
    el.globalProgress.hidden = !STATE.busy && p <= 0;
    el.globalProgress.classList.toggle("global-progress--active", STATE.busy && p < 100);
  }
  if (label !== undefined) {
    if (el.globalProgressLabel) {
      el.globalProgressLabel.textContent = label || "";
      el.globalProgressLabel.hidden = !label;
    }
  }
}

function toast(kind, message) {
  const node = document.createElement("div");
  node.className = "toast toast--" + kind;
  node.innerHTML = (Icons[kind] || Icons.info) + "<span>" + escapeHtml(message) + "</span>";
  el.toastContainer.appendChild(node);
  setTimeout(function() {
    node.classList.add("toast--out");
    setTimeout(function() { node.remove(); }, 260);
  }, 3500);
}

const FORMATS = [
  { value: "m4a", label: "M4A", desc: "Nativo" },
  { value: "mp3", label: "MP3", desc: "Universal" },
  { value: "opus", label: "Opus", desc: "Eficiente" },
  { value: "flac", label: "FLAC", desc: "Lossless" },
  { value: "wav", label: "WAV", desc: "Não comprimido" },
];

const QUALITIES = [128, 192, 256, 320];

function renderFormats() {
  if (!el.formatGrid) return;
  el.formatGrid.innerHTML = FORMATS.map(function(f) {
    return '<label class="format-option">' +
      '<input type="radio" name="format-radio" value="' + f.value + '" ' + (f.value === el.formatHidden.value ? "checked" : "") + '>' +
      '<span class="format-option__label">' +
        '<span class="format-option__name">' + f.label + '</span>' +
        '<span class="format-option__desc">' + f.desc + '</span>' +
      '</span>' +
    '</label>';
  }).join("");

  el.formatGrid.querySelectorAll('input[name="format-radio"]').forEach(function(input) {
    input.addEventListener("change", function() {
      el.formatHidden.value = input.value;
      scheduleSave();
    });
  });
}

function renderQualities() {
  if (!el.qualitySelector) return;
  el.qualitySelector.innerHTML = QUALITIES.map(function(q) {
    return '<label class="quality-option">' +
      '<input type="radio" name="quality-radio" value="' + q + '" ' + (q === parseInt(el.qualityHidden.value, 10) ? "checked" : "") + '>' +
      '<span class="quality-option__label">' + q + ' kbps</span>' +
    '</label>';
  }).join("");

  el.qualitySelector.querySelectorAll('input[name="quality-radio"]').forEach(function(input) {
    input.addEventListener("change", function() {
      el.qualityHidden.value = input.value;
      scheduleSave();
    });
  });
}

function updateFormatOptions(allowed) {
  if (!Array.isArray(allowed)) return;
  el.formatGrid.querySelectorAll(".format-option").forEach(function(opt) {
    const input = opt.querySelector("input");
    const allowedValue = allowed.includes(input.value);
    opt.style.display = allowedValue ? "" : "none";
  });
  if (!allowed.includes(el.formatHidden.value)) {
    el.formatHidden.value = allowed[0] || "m4a";
    renderFormats();
  }
}

function updateQualityOptions(allowed) {
  if (!Array.isArray(allowed)) return;
  el.qualitySelector.querySelectorAll(".quality-option").forEach(function(opt) {
    const input = opt.querySelector("input");
    const allowedValue = allowed.includes(parseInt(input.value, 10));
    opt.style.display = allowedValue ? "" : "none";
  });
  if (!allowed.includes(parseInt(el.qualityHidden.value, 10))) {
    el.qualityHidden.value = String(allowed[0] || 192);
    renderQualities();
  }
}

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

async function refreshMeta() {
  const seq = ++metaSeq;
  const url = el.input.value.trim();
  if (!url) { setMetaState("empty"); return; }
  if (!SPOTIFY_RE.test(url)) { setMetaState("error", "Cole um link do Spotify (playlist, álbum ou faixa)."); return; }
  setMetaState("loading");
  try {
    const info = await callApi("fetch_meta", url);
    if (seq !== metaSeq) return;
    STATE.meta = info;
    setMetaState("success", info);
  } catch (e) {
    if (seq !== metaSeq) return;
    setMetaState("error", e?.message || "Não foi possível analisar este link.");
  }
}

function setMetaState(state, data) {
  if (!el.metaCard) return;
  if (state === "empty") {
    el.metaCard.hidden = true;
    if (el.metaLine) { el.metaLine.textContent = "Cole um link de playlist, álbum ou faixa do Spotify"; el.metaLine.className = "url-hint"; }
    return;
  }
  el.metaCard.hidden = false;
  if (state === "loading") {
    if (el.metaLine) { el.metaLine.textContent = "Analisando link…"; el.metaLine.className = "url-hint meta--loading"; }
    return;
  }
  if (state === "error") {
    if (el.metaLine) { el.metaLine.textContent = data; el.metaLine.className = "url-hint meta--error"; }
    return;
  }
  const info = data;
  if (el.metaLine) { el.metaLine.textContent = metaText(info); el.metaLine.className = "url-hint meta--success"; }
  if (el.metaType) el.metaType.textContent = info.type === "playlist" ? "Playlist" : info.type === "album" ? "Álbum" : "Faixa";
  if (el.metaName) el.metaName.textContent = info.name || "";
  if (el.metaCount) el.metaCount.textContent = info.type !== "track" && info.total ? info.total + " " + (info.total === 1 ? "música" : "músicas") : "";
  if (info.cover && el.metaCover) { el.metaCover.innerHTML = '<img src="' + escapeHtml(info.cover) + '" alt="Capa" loading="lazy">'; }
  else if (el.metaCover) { el.metaCover.innerHTML = MUSIC_PH; }
}

const badgeLabel = { downloading: "Baixando", ok: "Baixada", skip: "Já existia", fail: "Falhou" };

function makeThumb(cover) {
  const thumb = document.createElement("span");
  thumb.className = "track__thumb";
  if (!cover) { thumb.innerHTML = MUSIC_PH; return thumb; }
  const img = document.createElement("img");
  img.alt = ""; img.loading = "lazy";
  img.onerror = function() { thumb.innerHTML = MUSIC_PH; };
  img.src = cover;
  thumb.appendChild(img);
  return thumb;
}

function makeRow(id) {
  const row = document.createElement("div");
  row.className = "track"; row.dataset.id = id;
  const thumb = document.createElement("span");
  thumb.className = "track__thumb"; thumb.innerHTML = MUSIC_PH;
  const name = document.createElement("span");
  name.className = "track__name";
  const badge = document.createElement("span");
  badge.className = "badge";
  row.append(thumb, name, badge);
  return { row: row, thumb: thumb, name: name, badge: badge, cover: undefined };
}

function updateTrackCount() {
  const n = STATE.tracks.size;
  if (el.countBadge) { el.countBadge.hidden = n === 0; el.countBadge.textContent = String(n); }
  if (el.trackEmpty) el.trackEmpty.hidden = n > 0;
}

function upsertTrack(id, name, status, cover) {
  STATE.tracks.set(id, { name: name, status: status, cover: cover });
  let node = trackRows.get(id);
  if (!node) {
    node = makeRow(id);
    trackRows.set(id, node);
    if (el.trackList) el.trackList.appendChild(node.row);
  }
  if (name && node.name.textContent !== name) { node.name.textContent = name; node.name.title = name; }
  if (cover !== node.cover) { node.cover = cover; node.thumb.replaceWith(makeThumb(cover)); node.thumb = node.row.querySelector(".track__thumb"); }
  node.badge.className = "badge badge--" + status;
  node.badge.textContent = badgeLabel[status] || status;
  updateTrackCount();
  const nearBottom = el.trackList && (el.trackList.scrollHeight - el.trackList.scrollTop - el.trackList.clientHeight < 90);
  if (nearBottom) el.trackList.scrollTop = el.trackList.scrollHeight;
}

function clearTracks() {
  STATE.tracks.clear(); trackRows.clear();
  if (el.trackList) el.trackList.querySelectorAll(".track").forEach(function(node) { node.remove(); });
  if (el.countBadge) { el.countBadge.hidden = true; el.countBadge.textContent = "0"; }
  if (el.trackEmpty) { el.trackEmpty.hidden = false; if (el.trackList) el.trackList.appendChild(el.trackEmpty); }
}

function addDownload(file) {
  if (!file || !file.url) return;
  const url = fileUrl(file.url);
  if (downloads.has(url)) return;
  downloads.set(url, file);
  if (el.downloadsPanel) el.downloadsPanel.hidden = false;

  const item = document.createElement("li");
  const icon = document.createElement("span");
  icon.className = "downloads__icon"; icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  const name = document.createElement("span");
  name.className = "downloads__name"; name.textContent = file.name || "arquivo"; name.title = file.name || "";
  const right = document.createElement("span");
  right.className = "downloads__right";
  const size = document.createElement("small"); size.textContent = file.size ? fmtBytes(file.size) : "";
  const link = document.createElement("a"); link.href = url; link.textContent = "Baixar"; link.setAttribute("download", "");
  right.append(size, link);
  item.append(icon, name, right);
  if (el.downloadsList) el.downloadsList.append(item);
}

function renderDownloads(files, zip) {
  if (Array.isArray(files)) files.forEach(addDownload);
  if (zip && el.downloadZip) { el.downloadZip.href = fileUrl(zip); el.downloadZip.hidden = false; }
}

function resetDownloads() {
  downloads.clear();
  if (el.downloadsList) el.downloadsList.innerHTML = "";
  if (el.downloadsPanel) el.downloadsPanel.hidden = true;
  if (el.downloadZip) { el.downloadZip.hidden = true; el.downloadZip.removeAttribute("href"); }
}

async function startDownload() {
  if (STATE.busy) return;
  const url = el.input.value.trim();
  if (!url) { toast("error", "Cole um link do Spotify primeiro."); setDownloadLoading(false); el.input.focus(); return; }
  if (!SPOTIFY_RE.test(url)) { toast("error", "Cole um link válido do Spotify (playlist, álbum ou faixa)."); setDownloadLoading(false); el.input.focus(); return; }

  const settings = { format: el.formatHidden.value, quality: parseInt(el.qualityHidden.value, 10), tracknum: el.tracknum?.checked ?? false, watermark: wmState() };

  clearTimeout(STATE.cancelTimer);
  clearTracks(); resetDownloads();
  setDownloadLoading(true); setProgress(0, "Iniciando…"); setBusy(true);

  try { await callApi("download", url, settings); if (el.downloadLabel) el.downloadLabel.textContent = "Baixando…"; }
  catch (e) { toast("error", e?.message || "Erro ao iniciar o download."); setBusy(false); setDownloadLoading(false); setProgress(0, ""); }
}

async function stopDownload() {
  if (!STATE.busy) return;
  if (el.stopBtn) el.stopBtn.disabled = true;
  if (el.downloadBtn) el.downloadBtn.disabled = true
  if (el.downloadLabel) el.downloadLabel.textContent = "Cancelando…";
  setProgress(0, "Cancelando…");
  clearTimeout(STATE.cancelTimer);
  STATE.cancelTimer = setTimeout(function() { if (!STATE.busy) return; setBusy(false); setDownloadLoading(false); setProgress(0, "Cancelamento solicitado."); toast("info", "Cancelamento solicitado."); }, 20000);
  try { await callApi("cancel"); } catch { }
}

const Update = { info: null, state: "idle" };

function updateModalOpen() { if (el.updateModal) el.updateModal.hidden = false; }
function updateModalClose() { if (el.updateModal) el.updateModal.hidden = true; }

function updateSetState(state) {
  Update.state = state;
  const downloading = state === "downloading", ready = state === "ready", error = state === "error";
  if (el.updateError) el.updateError.hidden = !error;
  if (el.updateProgress) el.updateProgress.hidden = !downloading;
  if (el.updateNotes) el.updateNotes.hidden = !(state === "available" || state === "ready");
  const canDismiss = !downloading;
  if (el.updateLater) { el.updateLater.disabled = !canDismiss; el.updateLater.hidden = downloading; }
  if (el.updateNow) { el.updateNow.hidden = false; el.updateNow.disabled = false; }
  if (state === "available") { if (el.updateTitle) el.updateTitle.textContent = "Nova versão disponível"; if (el.updateNow) el.updateNow.textContent = "Atualizar agora"; }
  else if (state === "downloading") { if (el.updateTitle) el.updateTitle.textContent = "Baixando atualização…"; if (el.updateNow) el.updateNow.hidden = true; }
  else if (state === "ready") { if (el.updateTitle) el.updateTitle.textContent = "Atualização pronta"; if (el.updateNow) el.updateNow.textContent = "Instalar e reiniciar"; }
  else if (state === "error") { if (el.updateTitle) el.updateTitle.textContent = "Falha na atualização"; if (el.updateNow) el.updateNow.textContent = "Tentar novamente"; }
}

function updateShowInfo(info) {
  Update.info = info;
  if (el.updateSubtitle) el.updateSubtitle.textContent = "AudioFlow " + (info.current || "v?") + " → " + info.version;
  const size = fmtBytes(info.size);
  if (el.updateSize) el.updateSize.textContent = size ? "Tamanho do download: " + size + ". As notas da versão:" : "As notas da versão:";
  if (info.notes) { if (el.updateNotes) { el.updateNotes.hidden = false; el.updateNotes.textContent = info.notes; } } else { if (el.updateNotes) el.updateNotes.hidden = true; }
  updateSetState("available"); updateModalOpen();
}

function updateSetError(message) { if (el.updateError) el.updateError.textContent = message || "Não foi possível atualizar agora."; updateSetState("error"); }
function updateSetProgress(percent, downloaded, total, speed) { if (el.updateProgressFill) el.updateProgressFill.style.width = Math.max(0, Math.min(100, percent)) + "%"; const base = fmtBytes(downloaded) + " de " + fmtBytes(total); if (el.updateProgressMeta) el.updateProgressMeta.textContent = speed ? base + " · " + fmtSpeed(speed) : base; }

async function updateStartDownload() { updateSetState("downloading"); if (el.updateProgressFill) el.updateProgressFill.style.width = "0%"; if (el.updateProgressMeta) el.updateProgressMeta.textContent = "Conectando…"; try { await callApi("download_update"); } catch (e) { updateSetError(e?.message || "Não foi possível baixar a atualização."); } }
async function updateInstall() { try { await callApi("install_update"); if (el.updateTitle) el.updateTitle.textContent = "Aplicando atualização…"; if (el.updateNow) el.updateNow.disabled = true; if (el.updateLater) el.updateLater.disabled = true; toast("info", "Aplicando atualização… o app vai reiniciar."); } catch (e) { updateSetError(e?.message || "Não foi possível aplicar a atualização."); } }

if (el.updateNow) el.updateNow.addEventListener("click", function() { if (Update.state === "downloading") return; if (Update.state === "ready") { updateInstall(); return; } if (Update.state === "error" || Update.state === "available") { updateStartDownload(); return; } });
if (el.updateLater) el.updateLater.addEventListener("click", function() { if (Update.state === "downloading") return; callApi("dismiss_update", Update.info).catch(function() {}); updateModalClose(); });
if (el.checkUpdateBtn) el.checkUpdateBtn.addEventListener("click", function() { toast("info", "Verificando atualizações…"); callApi("check_update_async").catch(function() {}); });

function updateHandleEvent(payload) {
  switch (payload.type) {
    case "update_available": updateShowInfo(payload); break;
    case "update_download_progress": updateSetProgress(payload.percent, payload.downloaded, payload.total, payload.speed); break;
    case "update_download_done": updateSetState("ready"); break;
    case "update_download_error": updateSetError(payload.message); break;
    case "update_error": break;
  }
}

function wmEffects() { const out = []; if (el.wmEcho?.checked) out.push("echo"); if (el.wmReverb?.checked) out.push("reverb"); if (el.wmDeep?.checked) out.push("deep"); if (el.wmRadio?.checked) out.push("radio"); return out; }
function wmState() { return { enabled: el.wmEnabled?.checked ?? false, text: el.wmText?.value.trim() || "Lucas CDs", position: el.wmPosition?.value || "middle", volume: parseInt(el.wmVolume?.value, 10) / 100, effects: wmEffects(), voice: el.wmVoice?.value || "deep", repeat_every: parseFloat(el.wmRepeatEvery?.value) || 0, repeat_count: parseInt(el.wmRepeatCount?.value, 10) || 0 }; }
function wmApplyConfig(wm) { if (!wm) return; if (el.wmEnabled) el.wmEnabled.checked = Boolean(wm.enabled); if (el.wmOptions) el.wmOptions.hidden = !wm.enabled; if (wm.text && el.wmText) el.wmText.value = wm.text; if (["start","middle","end"].includes(wm.position) && el.wmPosition) el.wmPosition.value = wm.position; if (typeof wm.volume === "number" && el.wmVolume) { el.wmVolume.value = String(Math.round(wm.volume * 100)); if (el.wmVolumeLabel) el.wmVolumeLabel.textContent = Math.round(wm.volume * 100) + "%"; } if (typeof wm.repeat_every === "number" && el.wmRepeatEvery) el.wmRepeatEvery.value = String(wm.repeat_every); if (typeof wm.repeat_count === "number" && el.wmRepeatCount) el.wmRepeatCount.value = String(wm.repeat_count); const effects = wm.effects || []; if (el.wmEcho) el.wmEcho.checked = effects.includes("echo"); if (el.wmReverb) el.wmReverb.checked = effects.includes("reverb"); if (el.wmDeep) el.wmDeep.checked = effects.includes("deep"); if (el.wmRadio) el.wmRadio.checked = effects.includes("radio"); if (el.wmVoice) el.wmVoice.value = ["deep","ultra","pt"].includes(wm.voice) ? wm.voice : "deep"; }
function wmSyncVolumeLabel() { if (el.wmVolumeLabel) el.wmVolumeLabel.textContent = (el.wmVolume?.value ?? 45) + "%"; }

let wmPreviewAudio = null;
function wmPreviewReset() { if (el.wmPreview) el.wmPreview.classList.remove("is-playing"); if (el.wmPreviewLabel) el.wmPreviewLabel.textContent = "Ouvir exemplo"; if (el.wmPreviewLoader) el.wmPreviewLoader.hidden = true; }
function wmPreviewStop() { if (wmPreviewAudio && !wmPreviewAudio.paused) wmPreviewAudio.pause(); wmPreviewReset(); }
async function playWmPreview() { if (wmPreviewAudio && !wmPreviewAudio.paused) { wmPreviewStop(); return; } const text = el.wmText?.value.trim() || "Lucas CDs"; const params = new URLSearchParams({ text: text, voice: el.wmVoice?.value || "deep", effects: wmEffects().join(","), volume: String(parseInt(el.wmVolume?.value, 10) / 100) }); const url = fileUrl("/api/watermark/preview?" + params.toString()); if (el.wmPreview) { el.wmPreview.disabled = true; el.wmPreview.classList.add("is-loading"); } if (el.wmPreviewLabel) el.wmPreviewLabel.textContent = "Gerando…"; if (el.wmPreviewLoader) el.wmPreviewLoader.hidden = false; try { if (!wmPreviewAudio) { wmPreviewAudio = new Audio(); wmPreviewAudio.preload = "none"; wmPreviewAudio.addEventListener("ended", wmPreviewReset); wmPreviewAudio.addEventListener("pause", wmPreviewReset); wmPreviewAudio.addEventListener("error", function() { wmPreviewReset(); toast("error", "Não foi possível gerar o exemplo agora."); }); } wmPreviewAudio.src = url; await wmPreviewAudio.play(); if (el.wmPreview) { el.wmPreview.classList.remove("is-loading"); el.wmPreview.classList.add("is-playing"); } if (el.wmPreviewLabel) el.wmPreviewLabel.textContent = "Parar"; } catch { wmPreviewReset(); toast("error", "Não foi possível tocar o exemplo. Tente novamente."); } finally { if (el.wmPreview) { el.wmPreview.disabled = false; if (el.wmPreviewLoader) el.wmPreviewLoader.hidden = true; } } }
if (el.wmPreview) el.wmPreview.addEventListener("click", playWmPreview);
if (el.wmEnabled) el.wmEnabled.addEventListener("change", function() { if (el.wmOptions) el.wmOptions.hidden = !el.wmEnabled.checked; scheduleSave(); });
if (el.wmVolume) el.wmVolume.addEventListener("input", function() { wmSyncVolumeLabel(); scheduleSave(); });
[el.wmText, el.wmPosition, el.wmEcho, el.wmReverb, el.wmDeep, el.wmRadio, el.wmVoice, el.wmRepeatEvery, el.wmRepeatCount].forEach(function(node) { node?.addEventListener("change", function() { wmPreviewStop(); scheduleSave(); }); });
if (el.wmText) el.wmText.addEventListener("input", scheduleSave);
if (el.wmRepeatEvery) el.wmRepeatEvery.addEventListener("input", scheduleSave);
if (el.wmRepeatCount) el.wmRepeatCount.addEventListener("input", scheduleSave);

window.audioflow_event = function(payload) { if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch { return; } } if (!payload || typeof payload !== "object") return; switch (payload.type) { case "queued": setBusy(true); if (el.downloadLabel) el.downloadLabel.textContent = "Baixando…"; setProgress(0, payload.message || "Na fila…"); break; case "meta": { const info = { type: payload.kind || "playlist", name: payload.name || "", total: payload.total || 0, cover: payload.cover || null }; STATE.meta = info; if (info.cover && el.heroCover) { el.heroCover.innerHTML = '<img src="' + escapeHtml(info.cover) + '" alt="Capa" loading="lazy">'; } if (el.metaLine) { el.metaLine.textContent = metaText(info); el.metaLine.className = "url-hint meta--success"; } if (el.metaCard) el.metaCard.hidden = false; if (el.metaType) el.metaType.textContent = info.type === "playlist" ? "Playlist" : info.type === "album" ? "Álbum" : "Faixa"; if (el.metaName) el.metaName.textContent = info.name || ""; if (el.metaCount) el.metaCount.textContent = info.type !== "track" && info.total ? info.total + " " + (info.total === 1 ? "música" : "músicas") : ""; break; } case "file_ready": addDownload(payload); break; case "track_start": setBusy(true); if (el.downloadLabel) el.downloadLabel.textContent = "Baixando…"; upsertTrack(payload.id, payload.name, "downloading", payload.cover); break; case "track_ok": case "track_done": upsertTrack(payload.id, payload.name, "ok", payload.cover); break; case "track_skip": upsertTrack(payload.id, payload.name, "skip", payload.cover); break; case "track_fail": upsertTrack(payload.id, payload.name, "fail", payload.cover); break; case "progress": setProgress(typeof payload.percent === "number" ? payload.percent : undefined, payload.label); break; case "finish": { clearTimeout(STATE.cancelTimer); const cancelled = Boolean(payload.cancelled) || /^cancelado/i.test(payload.summary || ""); setBusy(false); if (cancelled) { setProgress(0, payload.summary || "Download cancelado."); toast("info", payload.summary || "Download cancelado."); } else { setProgress(100, payload.summary || "Concluído."); toast("success", payload.summary || "Download concluído."); } renderDownloads(payload.files || [], payload.zip); break; } case "expired": resetDownloads(); toast("info", payload.message || "Os arquivos expiraram."); break; case "error": clearTimeout(STATE.cancelTimer); setBusy(false); setDownloadLoading(false); setProgress(0, ""); toast("error", payload.message || "Ocorreu um erro."); break; } updateHandleEvent(payload); };

/* Passive event listeners for better scroll performance */
if (el.input) el.input.addEventListener("input", function() { if (el.clear) el.clear.hidden = !el.input.value; clearTimeout(metaTimer); metaTimer = setTimeout(refreshMeta, 450); }, { passive: true });
if (el.clear) el.clear.addEventListener("click", function() { el.input.value = ""; el.clear.hidden = true; refreshMeta(); });
if (el.paste) el.paste.addEventListener("click", async function() { try { const text = await navigator.clipboard.readText(); el.input.value = text; el.clear.hidden = !text; refreshMeta(); } catch { toast("error", "Não foi possível acessar a área de transferência."); } });
if (el.input) el.input.addEventListener("keydown", function(e) { if (e.key === "Enter") { e.preventDefault(); startDownload(); } });
if (el.downloadBtn) el.downloadBtn.addEventListener("click", startDownload);
if (el.stopBtn) el.stopBtn.addEventListener("click", stopDownload);

if (el.settingsToggle) el.settingsToggle.addEventListener("click", function(e) { e.stopPropagation(); const open = el.settingsPanel.classList.toggle("settings-panel--open"); el.settingsToggle.setAttribute("aria-expanded", String(open)); });
if (el.settingsClose) el.settingsClose.addEventListener("click", function() { el.settingsPanel.classList.remove("settings-panel--open"); el.settingsToggle.setAttribute("aria-expanded", "false"); });
if (el.settingsPanel) el.settingsPanel.addEventListener("click", function(e) { if (e.target === el.settingsPanel) { el.settingsPanel.classList.remove("settings-panel--open"); if (el.settingsToggle) el.settingsToggle.setAttribute("aria-expanded", "false"); } });
if (el.settingsDrawer) el.settingsDrawer.addEventListener("click", function(e) { e.stopPropagation(); });

if (el.tracksToggle) el.tracksToggle.addEventListener("click", function() { const open = el.tracksBody.classList.toggle("tracks-panel__body--open"); el.tracksToggle.setAttribute("aria-expanded", String(open)); });

let saveTimer = null;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(function() { callApi("save_config", { format: el.formatHidden.value, quality: parseInt(el.qualityHidden.value, 10), tracknum: el.tracknum?.checked ?? false, watermark: wmState() }).catch(function() {}); }, 400); }
[el.tracknum].forEach(function(node) { node?.addEventListener("change", scheduleSave); });

async function waitForBridge(timeoutMs) { return new Promise(function(resolve) { const deadline = Date.now() + timeoutMs; function probe() { if (getApi()) return resolve(true); if (Date.now() >= deadline) return resolve(false); setTimeout(probe, 120); } probe(); }); }
function bridgeReady() { return isHttpMode() || !!getApi(); }
function callApiTimeout(method, timeoutMs, ...args) { return Promise.race([ callApi(method, ...args), new Promise(function(_, reject) { setTimeout(function() { reject(new Error("bridge " + method + " demorou demais")); }, timeoutMs); }) ]); }

function applyAndroidConfig(config) { if (el.checkUpdateBtn) el.checkUpdateBtn.hidden = true; const wmSwitch = el.wmEnabled?.closest(".settings-section"); if (wmSwitch) wmSwitch.hidden = true; if (el.wmOptions) el.wmOptions.hidden = true; Array.from(el.formatHidden.options).forEach(function(opt) { if (!["m4a","opus"].includes(opt.value)) opt.hidden = true; }); if (!["m4a","opus"].includes(el.formatHidden.value)) { el.formatHidden.value = "m4a"; renderFormats(); } window.__android = true; }
function applyWebConfig(config) { Array.from(el.formatHidden.options).forEach(function(opt) { opt.hidden = false; }); window.__web = true; document.body.classList.add("is-web"); if (el.webNotice) el.webNotice.hidden = false; if (el.formatGrid) el.formatGrid.style.display = "grid"; if (el.qualitySelector) el.qualitySelector.style.display = "flex"; const wmSwitch = el.wmEnabled?.closest(".settings-section"); if (wmSwitch) wmSwitch.hidden = false; if (el.wmOptions) el.wmOptions.hidden = !el.wmEnabled?.checked; if (Array.isArray(config?.convert_formats)) updateFormatOptions(config.convert_formats); else { updateFormatOptions(["m4a","opus"]); } if (Array.isArray(config?.qualities)) updateQualityOptions(config.qualities); if (config?.quality) { el.qualityHidden.value = String(config.quality); renderQualities(); } }

(async function init() { window.__initRan = true; let android = false; const deadline = Date.now() + 60000; while (Date.now() < deadline) { if (bridgeReady()) { try { const config = await callApiTimeout("get_config", 3000); if (config) { if (config.format) { el.formatHidden.value = config.format; renderFormats(); } if (config.quality) { el.qualityHidden.value = String(config.quality); renderQualities(); } if (config.tracknum != null && el.tracknum) el.tracknum.checked = Boolean(config.tracknum); if (config.platform === "android") { applyAndroidConfig(config); android = true; } else if (config.platform === "web") { applyWebConfig(config); } if (config.watermark) wmApplyConfig(config.watermark); } } catch { } try { const version = await callApiTimeout("get_app_version", 3000); if (version) { if (el.appVersion) el.appVersion.textContent = version; window.__versionSet = true; break; } } catch { } } await new Promise(function(r) { setTimeout(r, 1000); }); } renderFormats(); renderQualities(); if (isHttpMode()) { startEventPoll(); if (!LOCAL_HOST && !API_BASE) toast("error", "API não configurada. Defina window.AUDIOFLOW_API_BASE no config.js."); } callApi("check_update_async").catch(function() {}); setStatus("ready"); })();