// PDF 위에 펜 / 형광펜 / 텍스트 / 지우개로 표시하는 주석 레이어.
// 좌표는 PDF 포인트(회전 0 기준)로 저장하고, 페이지마다 SVG 오버레이로 그린다.
const NS = 'http://www.w3.org/2000/svg';
const FONT = '"Pretendard","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
const TOOLS = ['pen', 'hl', 'text', 'erase'];
const DEFAULT_COLORS = { pen: '#e5322d', hl: '#ffd500', text: '#1f2330' };

let ctx; // { storageKey, getScale, getBaseSizes }
let data = {}; // { [page]: [annotation] }
let history = [], hIdx = -1;
let tool = null;
const colors = { ...DEFAULT_COLORS };
const svgs = new Map();
let uid = 0;

const store = (v) => { try { v === null ? localStorage.removeItem(ctx.storageKey) : localStorage.setItem(ctx.storageKey, v); } catch {} };
const load = () => { try { return localStorage.getItem(ctx.storageKey); } catch { return null; } };

export function initAnno(opts) {
  ctx = opts;
  try { data = JSON.parse(load() || '{}'); } catch { data = {}; }
  history = [JSON.stringify(data)]; hIdx = 0;
}

export const isAnnoTool = (t) => TOOLS.includes(t);
export const hasAnno = () => Object.values(data).some((a) => a.length);
export function setAnnoTool(t) { tool = isAnnoTool(t) ? t : null; svgs.forEach((s) => s.classList.toggle('on', !!tool)); }
export function getToolColor(t) { return colors[t]; }
export function setToolColor(t, c) { colors[t] = c; }

function commit() {
  history = history.slice(0, hIdx + 1);
  history.push(JSON.stringify(data)); hIdx = history.length - 1;
  store(hasAnno() ? history[hIdx] : null);
  ctx.onChange?.();
}
function restore() {
  data = JSON.parse(history[hIdx]);
  store(hasAnno() ? history[hIdx] : null);
  svgs.forEach((_, n) => draw(n));
  ctx.onChange?.();
}
export const undo = () => { if (hIdx > 0) { hIdx--; restore(); } };
export const redo = () => { if (hIdx < history.length - 1) { hIdx++; restore(); } };
export function clearAll() {
  if (!hasAnno() || !confirm('모든 표시를 지울까요?')) return;
  data = {}; commit(); svgs.forEach((_, n) => draw(n));
}

function el(name, attrs = {}) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
const pathD = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + (pts.length === 1 ? ` L${pts[0][0] + 0.1} ${pts[0][1]}` : '');

function node(a) {
  let e;
  if (a.t === 'pen') e = el('path', { d: pathD(a.pts), fill: 'none', stroke: a.c, 'stroke-width': a.w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  else if (a.t === 'hl') e = el('rect', { x: a.x, y: a.y, width: a.w, height: a.h, fill: a.c, 'fill-opacity': 0.35 });
  else { e = el('text', { x: a.x, y: a.y, fill: a.c, 'font-size': a.size, 'font-family': FONT, 'dominant-baseline': 'hanging' }); e.style.whiteSpace = 'pre'; e.textContent = a.s; }
  e.dataset.id = a.id;
  return e;
}
function draw(n) {
  const svg = svgs.get(n); if (!svg) return;
  svg.replaceChildren(...(data[n] || []).map(node));
}

// 페이지가 (다시) 렌더링될 때마다 호출
export function mountAnno(pageEl, n) {
  const [W, H] = ctx.getBaseSizes()[n - 1];
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', class: 'annoLayer' });
  svg.classList.toggle('on', !!tool);
  svgs.set(n, svg);
  pageEl.appendChild(svg);
  draw(n);

  const pt = (e) => {
    const r = svg.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  let cur = null, live = null;

  const eraseAt = (e) => {
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-id]');
    if (!t || !svg.contains(t)) return false;
    const list = data[n] || [];
    const i = list.findIndex((a) => a.id === t.dataset.id);
    if (i < 0) return false;
    list.splice(i, 1); draw(n); return true;
  };

  svg.addEventListener('pointerdown', (e) => {
    if (!tool || e.button !== 0) return;
    e.preventDefault();
    const [x, y] = pt(e);
    if (tool === 'erase') { cur = { erased: eraseAt(e) }; svg.setPointerCapture(e.pointerId); return; }
    if (tool === 'text') { startText(pageEl, svg, n, x, y, W, H); return; }
    svg.setPointerCapture(e.pointerId);
    cur = tool === 'pen' ? { t: 'pen', c: colors.pen, w: 2.2, pts: [[x, y]] } : { t: 'hl', c: colors.hl, x0: x, y0: y, x, y, w: 0, h: 0 };
    live = node({ ...cur, id: 'live' }); svg.appendChild(live);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!cur) return;
    if (tool === 'erase') { if (eraseAt(e)) cur.erased = true; return; }
    const [x, y] = pt(e);
    if (cur.t === 'pen') { cur.pts.push([x, y]); live.setAttribute('d', pathD(cur.pts)); }
    else {
      cur.x = Math.min(cur.x0, x); cur.y = Math.min(cur.y0, y); cur.w = Math.abs(x - cur.x0); cur.h = Math.abs(y - cur.y0);
      live.setAttribute('x', cur.x); live.setAttribute('y', cur.y); live.setAttribute('width', cur.w); live.setAttribute('height', cur.h);
    }
  });
  const end = () => {
    if (!cur) return;
    const c = cur; cur = null; live?.remove(); live = null;
    if (tool === 'erase') { if (c.erased) commit(); return; }
    if (c.t === 'hl' && (c.w < 2 || c.h < 2)) return;
    const a = c.t === 'pen' ? { t: 'pen', c: c.c, w: c.w, pts: c.pts } : { t: 'hl', c: c.c, x: c.x, y: c.y, w: c.w, h: c.h };
    a.id = 'a' + Date.now() + '_' + uid++;
    (data[n] ||= []).push(a); draw(n); commit();
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
}

function startText(pageEl, svg, n, x, y, W, H) {
  pageEl.querySelector('.annoInput')?.blur();
  const size = 16, k = ctx.getScale();
  const input = document.createElement('input');
  input.className = 'annoInput';
  Object.assign(input.style, { left: (x / W) * 100 + '%', top: (y / H) * 100 + '%', fontSize: size * k + 'px', color: colors.text });
  input.placeholder = '텍스트 입력';
  pageEl.appendChild(input);
  setTimeout(() => input.focus(), 0);
  let done = false;
  const finish = (save) => {
    if (done) return; done = true;
    const s = input.value.trim();
    input.remove();
    if (save && s) {
      (data[n] ||= []).push({ id: 'a' + Date.now() + '_' + uid++, t: 'text', c: colors.text, x, y, size, s });
      draw(n); commit();
    }
  };
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
  input.addEventListener('blur', () => finish(true));
}

// 표시를 입힌 PDF 저장 (한글 등 모든 글자가 깨지지 않도록 투명 PNG로 합성)
export async function exportPdf(url, filename) {
  const { PDFDocument } = await import('pdf-lib');
  const bytes = await (await fetch(url)).arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const K = 3;
  const sizes = ctx.getBaseSizes();
  for (const [key, list] of Object.entries(data)) {
    if (!list.length) continue;
    const page = doc.getPage(+key - 1);
    if (page.getRotation().angle !== 0) continue;
    const [W, H] = sizes[+key - 1];
    const c = document.createElement('canvas'); c.width = W * K; c.height = H * K;
    const g = c.getContext('2d');
    g.scale(K, K); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const a of list) {
      if (a.t === 'pen') { g.strokeStyle = a.c; g.lineWidth = a.w; g.beginPath(); a.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); if (a.pts.length === 1) g.lineTo(a.pts[0][0] + 0.1, a.pts[0][1]); g.stroke(); }
      else if (a.t === 'hl') { g.globalAlpha = 0.35; g.fillStyle = a.c; g.fillRect(a.x, a.y, a.w, a.h); g.globalAlpha = 1; }
      else { g.fillStyle = a.c; g.font = `${a.size}px ${FONT}`; g.textBaseline = 'top'; g.fillText(a.s, a.x, a.y); }
    }
    const png = await new Promise((r) => c.toBlob(r, 'image/png')).then((b) => b.arrayBuffer());
    const img = await doc.embedPng(png);
    const { width, height } = page.getSize();
    page.drawImage(img, { x: 0, y: 0, width, height });
  }
  const out = await doc.save();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([out], { type: 'application/pdf' }));
  a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
