# 빅분기 실기 튜터 · 웹 버전

폴더용 튜터(CLAUDE.md + tutor/*.md 규칙)를 그대로 시스템 프롬프트로 써서, 브라우저에서 같은 수업을 진행하는 정적 웹사이트입니다. 서버 없이 GitHub Pages에 올릴 수 있습니다.

## 구조

```text
빅데이터분석기사/
├── CLAUDE.md, README.md, tutor/, learners/   기존 튜터 규칙 (웹 튜터도 이 문서를 그대로 읽음)
├── web/                       웹사이트
│   ├── index.html             화면
│   ├── css/style.css
│   ├── js/app.js              화면 연결 (채팅, 학습자 선택, 편집기, 진도, 요약노트, 설정, 백업)
│   ├── js/agent.js            튜터 엔진: Claude API 호출 + 도구 실행 루프
│   ├── js/prompt.js           규칙 문서를 읽어 시스템 프롬프트 생성 (+ 웹 환경 안내)
│   ├── js/state.js            state.json 저장·검증·진도 계산·백업
│   ├── js/python.js, py-worker.js   Pyodide(브라우저 Python) 실행기
│   ├── js/config.js           기본 설정 (모델, 프록시 주소 등)
│   ├── js/kv.js               브라우저 저장소(IndexedDB)
│   └── vendor/                Anthropic SDK 1.6.0, marked, DOMPurify (번들 파일)
├── proxy/                     (선택) API 키를 숨기는 Cloudflare Worker
└── .github/workflows/pages.yml   GitHub Pages 자동 배포
```

## 폴더 버전과 무엇이 같은가 / 다른가

| 폴더 버전 (Claude Code·Codex) | 웹 버전 |
|---|---|
| CLAUDE.md, tutor/*.md를 읽고 수업 | 같은 문서를 배포 시 묶어 시스템 프롬프트로 사용. 문서만 고치면 웹 튜터도 바뀜 |
| `learners/<ID>/state.json` 파일 | 브라우저 저장소의 같은 구조 JSON. 저장 전 learners/README.md 규칙(ID 중복, 참조, 상태값, 힌트 0~3)을 검증 |
| 로컬 Python으로 실행·채점 | 브라우저 안 Pyodide (pandas, numpy, scipy, scikit-learn, statsmodels). 튜터 전용 비공개 계산 공간과 학습자 공간을 분리 |
| 요약노트 Markdown → PDF 도구 | 튜터가 Markdown 작성 → 요약노트 탭의 "PDF로 저장"(브라우저 인쇄, 한글 글꼴) |
| 다른 기기에서 이어하기 = 폴더 복사 | 상단 "백업"에서 JSON 내보내기·가져오기 |
| 유튜브 영상 검토와 색인 갱신 | 지원하지 않음 (폴더 버전에서 진행). 확인 안 된 영상은 출제 근거에서 제외하는 규칙은 동일 |

## 로컬에서 미리 보기

프로젝트 폴더(빅데이터분석기사)에서 간단한 웹 서버를 켜고 `/web/`을 엽니다. 파일을 더블클릭해서 열면(file://) 동작하지 않습니다.

```bash
cd 빅데이터분석기사
python -m http.server 8000
# 브라우저에서 http://localhost:8000/web/ 열기
```

처음 열면 오른쪽 위 **설정**에서 Anthropic API 키를 입력합니다 ([Anthropic Console](https://console.anthropic.com/)에서 발급). 키는 그 브라우저에만 저장됩니다.

## GitHub에 올리고 배포하기

1. GitHub에서 새 저장소를 만들고 이 폴더 전체를 `main` 브랜치에 push합니다. `.gitignore`가 개인 학습 기록(`learners/<ID>/`)과 `notes/`를 제외합니다.
2. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿉니다.
3. push할 때마다 `.github/workflows/pages.yml`이 `web/`과 튜터 문서를 묶어 배포합니다. 주소는 `https://<GitHub ID>.github.io/<저장소 이름>/`입니다.

데이터마님 유료 문제 본문·정답이나 구매 계정 정보는 저장소에 넣지 마세요. 저장소를 공개하면 tutor/ 문서도 공개됩니다.

## API 키 방식

- **기본: 사용자가 자기 키 입력.** 브라우저가 Anthropic API를 직접 호출합니다 (`anthropic-dangerous-direct-browser-access` 헤더 사용). 사용료는 각 사용자 부담입니다.
- **선택: 운영자 키를 숨긴 프록시.** `proxy/README.md`대로 Cloudflare Worker를 배포하고, 설정의 "프록시 주소"에 넣거나 `js/config.js`의 `apiBaseURL`에 넣어 모든 사용자 기본값으로 만듭니다. 비용은 운영자 부담이므로 출처 제한·접속 코드·사용량 한도를 꼭 거세요.

## 기본 설정

`js/config.js`에서 바꿉니다.

- 모델: `claude-opus-5-5`, 사고 깊이(effort) `medium`. 설정 창에서 사용자별로 바꿀 수 있습니다.
- 거절 시 자동 재시도: 켜짐 (`server-side-fallback-2026-07-01`, `fallbacks: "default"`). 안전 분류기가 응답을 거절하면 서버가 다른 모델로 이어서 답합니다. 프록시나 계정에서 이 베타가 막히면 설정에서 끄세요.
- 시스템 프롬프트는 자동 프롬프트 캐싱(`cache_control`)으로 반복 비용을 줄입니다. 대화가 길어지면 상단 **새 대화**로 시작해도 학습 기록은 유지됩니다.
- Python: Pyodide 314.0.6 (jsDelivr CDN). 처음 실행할 때 수십 MB를 내려받아 30초 정도 걸립니다.

## 알려진 한계

- 학습 기록은 브라우저별로 저장됩니다. 브라우저 데이터를 지우면 사라지므로 백업을 권장합니다.
- 코드 실행은 브라우저 안에서만 이뤄지고 인터넷 접근이 없습니다. 실제 시험 데이터 파일은 편집기의 "파일 올리기"로 넣습니다.
- 90초 넘는 실행은 중단되고 Python 환경이 초기화됩니다.

## 파일 하나로 된 HTML 버전

`dist/bigdata-tutor.html`은 사이트 전체(화면, 튜터 엔진, 튜터 규칙 문서)를 파일 하나에 담은 버전입니다. 더블클릭으로 열어도 동작하고, 제출이나 공유용으로 씁니다. 인터넷 연결(Python 실행 도구·글꼴)과 API 키는 똑같이 필요합니다.
튜터 문서나 web/ 코드를 고친 뒤 다시 만들려면 프로젝트 폴더에서 `npm install --no-save esbuild` 후 `node tools/build-single-html.mjs`를 실행합니다.
