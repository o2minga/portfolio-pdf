# portfolio-pdf

HTML로 작성한 포트폴리오를 PDF로 만들고, 웹 PDF 뷰어로 보여주는 프로젝트입니다.

## 주요 기능

- `portfolio/index.html`을 Chrome(headless)으로 인쇄해 `public/portfolio.pdf` 생성
- [pdf.js](https://mozilla.github.io/pdf.js/) 기반 웹 뷰어
  - 페이지 썸네일, 확대/축소(폭 맞춤 등), 회전, 현재 페이지 표시
  - 라이트/다크 테마 전환
  - 펜 · 형광펜 · 텍스트 · 지우개 주석 (실행 취소/다시 실행, 주석 포함 PDF 내보내기)
- 개발 서버에서 `portfolio/` 폴더 변경 시 PDF 자동 재생성 및 새로고침

## 기술 스택

Vite, pdf.js (`pdfjs-dist`), pdf-lib, Pretendard

## 시작하기

```bash
npm install
npm run dev
```

> PDF 생성에는 Chrome 또는 Edge가 필요합니다. 자동으로 찾지 못하면 `CHROME_PATH` 환경변수에 실행 파일 경로를 지정하세요.

## 스크립트

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 (`portfolio/` 변경 시 PDF 자동 재생성) |
| `npm run pdf` | `portfolio/index.html`에서 `public/portfolio.pdf`만 생성 |
| `npm run build` | PDF 생성 후 `dist/`에 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run sample` | 샘플 PDF 생성 |

## 폴더 구조

```
portfolio/        포트폴리오 원본 (index.html, style.css, assets, fonts, reference)
public/           생성된 portfolio.pdf
scripts/          PDF 생성 / 샘플 스크립트
src/              뷰어 (main.js, annotate.js, style.css)
```

## 내용 수정하기

1. `portfolio/index.html`, `portfolio/style.css`, `portfolio/assets/`를 수정합니다.
2. `npm run dev` 중이면 저장 시 PDF가 자동으로 다시 만들어집니다.
3. 직접 만든 PDF를 쓰려면 `public/portfolio.pdf`를 교체하면 됩니다.
