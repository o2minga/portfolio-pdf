# 백민하 포트폴리오

데이터 분석가 지망생 백민하의 포트폴리오입니다. 제출용 PDF는 [`public/portfolio.pdf`](public/portfolio.pdf)이고, 아래 내용은 PDF와 같습니다.

- 소개: 제주대학교 전산통계학과 졸업 · 우리WON 청년IT아카데미 1기 · 제주대학교 × UPSTAGE AI 중급 부트캠프
- 관심 분야: 보험·금융 서비스 데이터 분석, 고객에게 맞는 상품 추천과 안내
- 기술: Python · R · SQL · HTML · CSS
- 연락처: o2.mingha@gmail.com
- GitHub: https://github.com/o2minga
- 포트폴리오 저장소: https://github.com/o2minga/portfolio-pdf

## 프로젝트

| # | 프로젝트 | 기간 | 형태 | 내 담당 | 상태 | 핵심 기술 |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | [ForWON: 금융 업무의 막힌 순간까지 이해하는 AI 가이드](https://github.com/eunbii0/bank-guide-server) | 2026.10 | 5인 팀 | 기획 · UI/UX · 고객 페이지 개발 | 핵심 흐름 구현 | Spring Boot · Spring AI · OpenAI API · React / Vite · JPA · SQL (MySQL) · HTML · CSS |
| 02 | SK하이닉스 주가 예측: Transformer 기반 시계열 모델 | 2025.03 ~ 2025.06 | 4인 팀 | 데이터 엔지니어링 · 전처리 | 모델 학습·검증·해석 완료 | Python · PyTorch · Transformer · FFT 주기성 · SHAP · LIME |
| 03 | 제주 관광객 수요 예측: 시계열 분석으로 12개월 앞을 보다 | 2024.11 ~ 2024.12 | 개인 (1인) | 데이터 탐색부터 예측까지 분석 전 과정 | 12개월 예측 완료 · 검정 재확인 예정 | R · 시계열 분해 · ADF 검정 · ACF·PACF · SARIMA |
| 04 | [제주 4·3 기록을 스토리 웹페이지로: AI 워크플로우 구축](https://github.com/o2minga/jeju43-storyweb-agent) | 2026.08 | 2인 팀 | 에이전트·스킬·오케스트레이터 설계 · 웹 연동·검증 | 웹 반영까지 구현 · 이미지·오디오 자동화 예정 | AI 에이전트 · 스킬 · 오케스트레이션 · Supabase · Leaflet · HTML · CSS |

> 팀 프로젝트(01, 02, 04)는 팀 전체 결과를 정리한 것이며, 제가 직접 맡은 부분은 표의 "내 담당" 열과 PDF 각 페이지 맨 위 "내 담당" 칸에 적었습니다. 03은 개인 프로젝트입니다.

각 프로젝트의 문제, 해결 방법, 확인한 결과, 한계와 다음 개선은 PDF의 해당 페이지(총 8쪽: 표지 1, ForWON 2~3, SK하이닉스 4, 제주 관광객 5~6, 제주 4·3 7~8)에 있습니다. 구현된 것과 예정인 것은 표의 "상태" 열에, 확인하지 못한 내용은 각 페이지의 "미확인" 표시에 구분해 두었습니다.

---

# 포트폴리오 PDF 제작 도구

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
