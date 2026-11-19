import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import { initAnno, mountAnno, setAnnoTool, isAnnoTool, undo, redo, clearAll, exportPdf, hasAnno, getToolColor, setToolColor } from './annotate.js';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const PDF_URL = '/portfolio.pdf';
const DOWNLOAD_NAME = '백민하_포트폴리오.pdf';
const $ = (id) => document.getElementById(id);
const viewer = $('viewer'), pagesEl = $('pages'), thumbsEl = $('thumbs');

let pdf, scaleMode = 'fit-width', scale = 1, rotation = 0, current = 1;
let pageEls = [], thumbEls = [], baseSizes = [], textCache = [];
let renderObserver;

const dpr = () => window.devicePixelRatio || 1;
const safe = (k, v) => { try { v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch {} };

// ---------- theme ----------
const savedTheme = (() => { try { return localStorage.getItem('theme'); } catch { return null; } })();
document.documentElement.dataset.theme = savedTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
$('btnTheme').onclick = () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t; safe('theme', t);
};

// ---------- load ----------
async function init() {
  try {
    pdf = await pdfjs.getDocument({ url: PDF_URL + '?t=' + Date.now() }).promise;
  } catch (e) {
    console.error(e);
    $('loading').textContent = 'PDF를 불러오지 못했습니다: ' + (e?.message || e);
    return;
  }
  const meta = await pdf.getMetadata().catch(() => null);
  const title = meta?.info?.Title;
  if (title) { document.title = title; $('docName').textContent = title + '.pdf'; }
  $('pageCount').textContent = pdf.numPages;
  $('pageInput').max = pdf.numPages;

  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    const v = p.getViewport({ scale: 1 });
    baseSizes.push([v.width, v.height]);
  }
  initAnno({ storageKey: 'anno:' + PDF_URL, getScale: () => scale, getBaseSizes: () => baseSizes, onChange: updateEditUi });
  buildPages();
  buildThumbs();
  applyZoom(scaleMode);
  $('loading').classList.add('hidden');
  updateStatus();
}

function buildPages() {
  renderObserver = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) renderPage(+en.target.dataset.n);
  }, { root: viewer, rootMargin: '600px 0px' });
  for (let i = 1; i <= pdf.numPages; i++) {
    const d = document.createElement('div');
    d.className = 'page'; d.dataset.n = i;
    pagesEl.appendChild(d); pageEls.push(d);
    renderObserver.observe(d);
  }
}

function pageSize(i) {
  const [w, h] = baseSizes[i];
  return rotation % 180 ? [h, w] : [w, h];
}

function layoutPages() {
  pageEls.forEach((el, i) => {
    const [w, h] = pageSize(i);
    el.style.width = w * scale + 'px'; el.style.height = h * scale + 'px';
    el.dataset.rendered = '';
    el.replaceChildren();
  });
  pageEls.forEach((el) => {
    const r = el.getBoundingClientRect(), vr = viewer.getBoundingClientRect();
    if (r.bottom > vr.top - 600 && r.top < vr.bottom + 600) renderPage(+el.dataset.n);
  });
}

const rendering = new Map();
async function renderPage(n) {
  const el = pageEls[n - 1];
  const key = `${scale}|${rotation}`;
  if (el.dataset.rendered === key || rendering.get(n) === key) return;
  rendering.set(n, key);
  const page = await pdf.getPage(n);
  const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
  const canvas = document.createElement('canvas');
  const r = dpr();
  canvas.width = Math.floor(viewport.width * r); canvas.height = Math.floor(viewport.height * r);
  canvas.style.width = viewport.width + 'px'; canvas.style.height = viewport.height + 'px';
  await page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: r !== 1 ? [r, 0, 0, r, 0, 0] : null }).promise;
  if (rendering.get(n) !== key) return; // zoom changed meanwhile

  const textDiv = document.createElement('div');
  textDiv.className = 'textLayer';
  textDiv.style.setProperty('--scale-factor', viewport.scale);
  textDiv.style.setProperty('--total-scale-factor', viewport.scale);
  const linkDiv = document.createElement('div');
  linkDiv.className = 'linkLayer';
  el.replaceChildren(canvas, textDiv, linkDiv);
  el.dataset.rendered = key;
  mountAnno(el, n);

  try {
    const tl = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textDiv, viewport });
    await tl.render();
    if (activeQuery) highlight(textDiv, activeQuery);
  } catch {}
  try {
    const annots = await page.getAnnotations({ intent: 'display' });
    for (const a of annots) {
      if (a.subtype !== 'Link') continue;
      const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(a.rect);
      const link = document.createElement('a');
      Object.assign(link.style, { left: Math.min(x1, x2) + 'px', top: Math.min(y1, y2) + 'px', width: Math.abs(x2 - x1) + 'px', height: Math.abs(y2 - y1) + 'px' });
      if (a.url) { link.href = a.url; link.target = '_blank'; link.rel = 'noopener'; }
      else if (a.dest) {
        link.href = '#'; link.onclick = async (e) => {
          e.preventDefault();
          const dest = typeof a.dest === 'string' ? await pdf.getDestination(a.dest) : a.dest;
          if (dest) goTo((await pdf.getPageIndex(dest[0])) + 1);
        };
      }
      linkDiv.appendChild(link);
    }
  } catch {}
}

// ---------- thumbnails ----------
function buildThumbs() {
  const io = new IntersectionObserver(async (entries) => {
    for (const en of entries) {
      if (!en.isIntersecting || en.target.dataset.done) continue;
      en.target.dataset.done = 1;
      const n = +en.target.dataset.n;
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: 120 / base.width });
      const c = en.target.querySelector('canvas');
      const r = dpr();
      c.width = vp.width * r; c.height = vp.height * r;
      c.style.width = vp.width + 'px'; c.style.height = vp.height + 'px';
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp, transform: [r, 0, 0, r, 0, 0] }).promise;
    }
  }, { root: $('sidebar') });
  for (let i = 1; i <= pdf.numPages; i++) {
    const [w, h] = baseSizes[i - 1];
    const t = document.createElement('div');
    t.className = 'thumb'; t.dataset.n = i;
    t.innerHTML = `<canvas style="width:120px;height:${(120 * h) / w}px"></canvas><div>${i}</div>`;
    t.onclick = () => goTo(i);
    thumbsEl.appendChild(t); thumbEls.push(t); io.observe(t);
  }
}

// ---------- zoom / navigation ----------
function computeScale(mode) {
  if (mode === 'fit-width' || mode === 'fit-page') {
    const [w, h] = pageSize(current - 1);
    const aw = viewer.clientWidth - 56, ah = viewer.clientHeight - 56;
    return mode === 'fit-width' ? aw / w : Math.min(aw / w, ah / h);
  }
  return parseFloat(mode);
}
function applyZoom(mode) {
  const anchor = current;
  scaleMode = mode;
  scale = Math.max(0.2, Math.min(4, computeScale(mode)));
  rendering.clear();
  layoutPages();
  const sel = $('zoomSelect');
  if (![...sel.options].some((o) => o.value === String(mode))) {
    let o = sel.querySelector('option[data-custom]');
    if (!o) { o = document.createElement('option'); o.dataset.custom = 1; sel.appendChild(o); }
    o.value = String(mode); o.textContent = Math.round(scale * 100) + '%';
  }
  sel.value = String(mode);
  goTo(anchor, true);
  updateStatus();
}
const zoomBy = (f) => applyZoom(String(+(scale * f).toFixed(3)));
function goTo(n, instant) {
  n = Math.max(1, Math.min(pdf.numPages, n));
  viewer.scrollTo({ top: pageEls[n - 1].offsetTop - 14, behavior: instant ? 'auto' : 'smooth' });
  setCurrent(n);
}
function setCurrent(n) {
  current = n;
  $('pageInput').value = n;
  thumbEls.forEach((t, i) => t.classList.toggle('active', i === n - 1));
  thumbEls[n - 1]?.scrollIntoView({ block: 'nearest' });
  updateStatus();
}
viewer.addEventListener('scroll', () => {
  const mid = viewer.scrollTop + viewer.clientHeight / 3;
  let n = 1;
  for (let i = 0; i < pageEls.length; i++) if (pageEls[i].offsetTop <= mid) n = i + 1;
  if (n !== current) setCurrent(n);
}, { passive: true });

function updateStatus() {
  if (!pdf) return;
  $('statusLeft').textContent = `${$('docName').textContent} · ${pdf.numPages} 페이지`;
  $('statusRight').textContent = `${current} / ${pdf.numPages} · ${Math.round(scale * 100)}%`;
}

// ---------- toolbar ----------
$('btnPrev').onclick = () => goTo(current - 1);
$('btnNext').onclick = () => goTo(current + 1);
$('pageInput').onchange = (e) => goTo(+e.target.value || 1);
$('btnZoomIn').onclick = () => zoomBy(1.2);
$('btnZoomOut').onclick = () => zoomBy(1 / 1.2);
$('zoomSelect').onchange = (e) => applyZoom(e.target.value);
$('btnSidebar').onclick = () => $('sidebar').classList.toggle('closed');
$('btnRotate').onclick = () => { if (isAnnoTool(tool)) setTool('hand'); rotation = (rotation + 90) % 360; applyZoom(scaleMode); };
$('btnDownload').onclick = () => { const a = document.createElement('a'); a.href = PDF_URL; a.download = DOWNLOAD_NAME; a.click(); };
$('btnPrint').onclick = () => {
  const w = window.open(PDF_URL, '_blank');
  w?.addEventListener('load', () => w.print());
};
$('btnFullscreen').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());

let tool = 'hand';
function setTool(t) {
  if (isAnnoTool(t) && rotation !== 0) { rotation = 0; applyZoom(scaleMode); }
  tool = t;
  viewer.classList.toggle('hand', t === 'hand');
  viewer.classList.toggle('editing', isAnnoTool(t));
  setAnnoTool(t);
  document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
  const ci = $('colorInput');
  ci.hidden = !(t === 'pen' || t === 'hl' || t === 'text');
  if (!ci.hidden) ci.value = getToolColor(t);
}
document.querySelectorAll('[data-tool]').forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
$('colorInput').oninput = (e) => setToolColor(tool, e.target.value);
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
$('btnClear').onclick = clearAll;
$('btnSave').onclick = async () => {
  const b = $('btnSave'); b.disabled = true;
  try { await exportPdf(PDF_URL, 'portfolio-edited.pdf'); } catch (e) { alert('저장 실패: ' + (e?.message || e)); }
  b.disabled = false;
};
function updateEditUi() { $('btnClear').disabled = !hasAnno(); }
updateEditUi();
setTool('hand');

// drag to pan (hand tool)
let drag = null;
viewer.addEventListener('mousedown', (e) => {
  if (!viewer.classList.contains('hand') || e.button !== 0) return;
  drag = { x: e.clientX, y: e.clientY, l: viewer.scrollLeft, t: viewer.scrollTop };
  viewer.classList.add('dragging');
});
window.addEventListener('mousemove', (e) => {
  if (!drag) return;
  viewer.scrollLeft = drag.l - (e.clientX - drag.x); viewer.scrollTop = drag.t - (e.clientY - drag.y);
});
window.addEventListener('mouseup', () => { drag = null; viewer.classList.remove('dragging'); });

// ctrl+wheel zoom
viewer.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); } }, { passive: false });

// resize -> refit
let rt;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => { if (pdf && scaleMode.startsWith('fit')) applyZoom(scaleMode); }, 150);
});

// ---------- search ----------
let activeQuery = '', hits = [], hitIdx = -1;
function highlight(textDiv, q) {
  textDiv.querySelectorAll('span').forEach((s) => {
    s.classList.toggle('hit', s.textContent.toLowerCase().includes(q));
  });
}
async function runSearch(q) {
  q = q.trim().toLowerCase();
  activeQuery = q; hits = []; hitIdx = -1;
  pageEls.forEach((el) => { const t = el.querySelector('.textLayer'); if (t) highlight(t, q || '\u0000'); });
  if (!q) { $('searchCount').textContent = ''; return; }
  for (let i = 1; i <= pdf.numPages; i++) {
    if (!textCache[i]) {
      const c = await (await pdf.getPage(i)).getTextContent();
      textCache[i] = c.items.map((x) => x.str).join(' ').toLowerCase();
    }
    if (textCache[i].includes(q)) hits.push(i);
  }
  $('searchCount').textContent = hits.length ? `${hits.length}개 페이지` : '결과 없음';
  if (hits.length) { hitIdx = 0; goTo(hits[0]); }
}
let st;
$('searchInput').addEventListener('input', (e) => { clearTimeout(st); st = setTimeout(() => runSearch(e.target.value), 250); });
$('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && hits.length) { hitIdx = (hitIdx + (e.shiftKey ? -1 : 1) + hits.length) % hits.length; goTo(hits[hitIdx]); }
  if (e.key === 'Escape') { e.target.value = ''; runSearch(''); e.target.blur(); }
});

// ---------- keyboard ----------
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); $('searchInput').focus(); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y') && !e.target.matches('input, select')) { e.preventDefault(); (e.key === 'y' || e.shiftKey) ? redo() : undo(); return; }
  if (e.target.matches('input, select')) return;
  const k = e.key;
  if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); goTo(current + 1); }
  else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); goTo(current - 1); }
  else if (k === 'Home') goTo(1);
  else if (k === 'End') goTo(pdf.numPages);
  else if (k === '+' || k === '=') zoomBy(1.2);
  else if (k === '-') zoomBy(1 / 1.2);
  else if (k === '0') applyZoom('fit-width');
  else if (k === 's') $('btnSidebar').click();
  else if (k === 'h') setTool('hand');
  else if (k === 'v') setTool('select');
  else if (k === 'p') setTool('pen');
  else if (k === 'm') setTool('hl');
  else if (k === 't') setTool('text');
  else if (k === 'e') setTool('erase');
  else if (k === 'Escape') setTool('hand');
  else if (k === 'r') $('btnRotate').click();
  else if (k === 'f') $('btnFullscreen').click();
});

init();
