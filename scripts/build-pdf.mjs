// portfolio/index.html 을 Chrome(headless)로 인쇄해서 public/portfolio.pdf 를 만든다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SRC = path.join(root, 'portfolio', 'index.html');
export const OUT = path.join(root, 'public', 'portfolio.pdf');

function findBrowser() {
  const c = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = c.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Chrome/Edge를 찾지 못했습니다. CHROME_PATH 환경변수에 경로를 지정하세요.');
  return found;
}

let running = null, again = false;
export async function buildPdf() {
  if (running) { again = true; return running; }
  running = (async () => {
    const tmp = path.join(os.tmpdir(), 'portfolio-pdf-' + Date.now() + '.pdf');
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-chrome-'));
    const args = ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer', '--allow-file-access-from-files',
      `--user-data-dir=${profile}`, `--print-to-pdf=${tmp}`, '--run-all-compositor-stages-before-draw', pathToFileURL(SRC).href];
    await new Promise((resolve, reject) => {
      const p = spawn(findBrowser(), args, { stdio: 'ignore' });
      const t = setTimeout(() => { p.kill(); reject(new Error('PDF 생성 시간 초과')); }, 60000);
      p.on('exit', () => { clearTimeout(t); resolve(); });
      p.on('error', reject);
    });
    fs.rmSync(profile, { recursive: true, force: true });
    if (!fs.existsSync(tmp)) throw new Error('PDF가 생성되지 않았습니다.');
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.copyFileSync(tmp, OUT); fs.rmSync(tmp, { force: true });
    return OUT;
  })();
  try { return await running; }
  finally { running = null; if (again) { again = false; buildPdf().catch(() => {}); } }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildPdf().then((o) => console.log('PDF 생성 완료:', o)).catch((e) => { console.error(e.message); process.exit(1); });
}
