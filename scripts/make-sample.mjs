import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'node:fs';
const doc = await PDFDocument.create();
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const reg = await doc.embedFont(StandardFonts.Helvetica);
const W = 595, H = 842;
const pages = [
  ['PORTFOLIO', 'Your Name', 'Backend Developer'],
  ['ABOUT', 'Write a short introduction here.', 'Replace public/portfolio.pdf with your own PDF.'],
  ['PROJECT 01', 'Project title', 'Role / Period / Stack'],
  ['PROJECT 02', 'Project title', 'Role / Period / Stack'],
  ['CONTACT', 'you@example.com', 'github.com/your-id'],
];
pages.forEach(([a, b, c], i) => {
  const p = doc.addPage([W, H]);
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });
  p.drawRectangle({ x: 48, y: H - 120, width: 60, height: 6, color: rgb(0.29, 0.38, 0.97) });
  p.drawText(a, { x: 48, y: H - 170, size: 40, font: bold, color: rgb(0.1, 0.1, 0.12) });
  p.drawText(b, { x: 48, y: H - 220, size: 18, font: reg, color: rgb(0.3, 0.3, 0.35) });
  p.drawText(c, { x: 48, y: H - 248, size: 14, font: reg, color: rgb(0.5, 0.5, 0.55) });
  p.drawText(`${i + 1} / ${pages.length}`, { x: W - 90, y: 40, size: 10, font: reg, color: rgb(0.6, 0.6, 0.65) });
});
fs.writeFileSync('public/portfolio.pdf', await doc.save());
console.log('ok');
