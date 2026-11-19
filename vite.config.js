import path from 'node:path';
import { buildPdf } from './scripts/build-pdf.mjs';

// portfolio/ 폴더의 파일이 바뀌면 PDF를 다시 만들고 브라우저를 새로고침한다.
function livePdf() {
  return {
    name: 'live-pdf',
    configureServer(server) {
      const dir = path.resolve('portfolio');
      let timer;
      const run = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          try {
            const t = Date.now();
            await buildPdf();
            server.config.logger.info(`[pdf] portfolio.pdf 다시 생성 (${Date.now() - t}ms)`);
            server.ws.send({ type: 'full-reload' });
          } catch (e) { server.config.logger.error('[pdf] ' + e.message); }
        }, 300);
      };
      server.watcher.add(dir);
      server.watcher.on('all', (_, file) => {
        const f = path.resolve(file);
        if (f.startsWith(dir) && !f.includes(path.join('portfolio', 'reference'))) run();
      });
      run(); // 서버 시작 시 한 번 생성
    },
  };
}

export default { plugins: [livePdf()] };
