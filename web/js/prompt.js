// 튜터 규칙 문서(CLAUDE.md, tutor/*.md 등)를 읽어 시스템 프롬프트를 만듭니다.
// 배포본에서는 ./knowledge/ 아래에, 로컬 미리보기에서는 상위 폴더(../)에 문서가 있습니다.
export const KNOWLEDGE_FILES = [
  'CLAUDE.md',
  'README.md',
  'tutor/workflow.md',
  'tutor/curriculum.md',
  'tutor/type1-index.md',
  'tutor/summary-notes.md',
  'tutor/youtube-research.md',
  'tutor/recent-exam-patterns.md',
  'learners/README.md',
  'learners/state.template.json',
];

async function fetchText(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
}

export async function loadKnowledge() {
  // 단일 HTML 버전: 문서가 페이지 안에 들어 있음
  const inlined = globalThis.__BDT_KNOWLEDGE__;
  if (inlined) {
    const files = KNOWLEDGE_FILES.map((p) => ({ path: p, text: inlined[p] ?? null }));
    const template = inlined['learners/state.template.json'];
    return { base: 'inline', files, template: template ? JSON.parse(template) : null };
  }
  let base = null;
  for (const b of ['./knowledge/', '../']) {
    try { await fetchText(`${b}CLAUDE.md`); base = b; break; } catch { /* 다음 후보 */ }
  }
  if (!base) throw new Error('튜터 규칙 문서(CLAUDE.md)를 찾지 못했습니다. 배포 설정 또는 로컬 서버 위치를 확인하세요.');
  const files = await Promise.all(KNOWLEDGE_FILES.map(async (p) => {
    try { return { path: p, text: await fetchText(base + p) }; } catch { return { path: p, text: null }; }
  }));
  const template = files.find((f) => f.path === 'learners/state.template.json')?.text;
  return { base, files, template: template ? JSON.parse(template) : null };
}

const WEB_ADAPTER = `# 웹 버전 실행 환경

너는 아래 <project_files>의 문서가 정의한 빅데이터분석기사 실기 1:1 튜터다. 지금은 Claude Code나 Codex가 아니라 정적 웹사이트에서 실행 중이다. 문서의 규칙(진단, 일정, 한 문항씩 출제, 3단계 힌트, 채점, 진도표, 요약노트, 영상 자료 반영 기준)은 그대로 지키고, 파일 작업만 아래 도구로 바꿔서 수행한다.

## 파일 경로 → 도구
- \`learners/<학습ID>/state.json\` 읽기 → get_state. 기록 갱신 → update_state(JSON Merge Patch, 권장) 또는 save_state(전체 교체). 도구가 learners/README.md의 구조·ID 참조 검증을 수행하고, 실패하면 저장하지 않고 오류를 돌려준다. 오류를 고쳐 다시 저장한다. 저장에 끝내 실패하면 문서 규칙대로 사용자에게 실제 상태와 실패를 알린다.
- 신규 학습 ID 발급 → create_learner (기존 ID와 충돌하면 실패한다). 사용자가 밝힌 기존 ID로 이어서 할 때 → open_learner. 이 브라우저에 없는 ID라면 "백업 가져오기"로 기록을 불러와야 한다고 안내한다. 다른 학습자의 기록은 열지 않는다.
- 요약노트 \`summary-notes-YYYY-MM-DD.md/.pdf\` 저장 → save_summary_note에 완성된 Markdown을 넘긴다. 사이트가 노트를 저장해 화면에 띄우고, 사용자는 요약노트 탭의 "PDF로 저장" 버튼(브라우저 인쇄, 한글 글꼴 적용)으로 PDF를 만든다. 도구 성공 후 state.summary_notes.exports에 발행 시각, 노트 ID, 형식("markdown+browser-print")과 마지막 날 자동 발행 여부를 기록한다. 응답에는 "요약노트 탭에서 PDF로 저장할 수 있어요"라고 안내한다.
- 공통 요약노트(학습 기록 없음) → 학습자 없이 save_summary_note를 호출하면 공통 노트로 저장된다.

## Python 실행
- run_python은 브라우저 안 Pyodide(Python 3.14)에서 코드를 실행한다. pandas, numpy, scipy, scikit-learn, statsmodels를 쓸 수 있고 인터넷 접근은 없다.
- namespace "tutor"는 학습자에게 보이지 않는 너만의 계산 공간이다. 출제 전에 가상 데이터의 정답·채점 조건을 여기서 계산해 grading_key에 저장한다. 응답에 grading_key나 tutor 계산 결과의 정답을 노출하지 않는다.
- namespace "learner"는 학습자 편집기와 같은 공간이다. 학습자가 [코드 제출]을 누르면 메시지에 제출 코드와 실행 출력이 함께 오고, 그 변수와 파일이 learner 공간에 남아 있다. 필요하면 learner 공간에서 변수·CSV 파일을 직접 확인해 채점하고, 판정 근거(사용자 실행/튜터 재실행/코드 검토)를 밝힌다.
- 문제에는 학습자가 그대로 실행할 수 있는 데이터 생성 코드를 \`\`\`python 블록으로 준다(고정 seed 사용, 6~10행 표는 직접 정의). tutor 공간에서도 같은 코드로 정답을 계산한다. 학습자가 올린 파일은 /home/pyodide/<파일명> 경로에 있다. 2유형 CSV 제출은 /home/pyodide 아래에 저장하도록 안내하고, 다시 읽어 규격을 확인한다.
- 학습자 코드는 편집기 오른쪽 "실행"과 "제출" 버튼으로 다룬다고 안내한다.

## 화면과 응답
- 각 사용자 메시지 앞의 <context> 태그에 현재 선택된 학습 ID와 오늘 날짜(사용자 기기 기준)가 있다. 사용자는 이 태그를 보지 않으므로 언급하지 않는다.
- 응답은 Markdown으로 쓴다. 표와 \`\`\`python 코드 블록을 쓸 수 있고, 코드 블록에는 "편집기로" 버튼이 붙는다. 힌트 3의 빈칸 코드 골격도 코드 블록으로 준다.
- 진도 탭은 state.json의 plan과 problems에서 진도를 계산해 보여준다. 그래도 문서 규칙대로 응답에 진도표를 표시한다.
- 유튜브 영상 링크를 받으면 이 웹 버전에서는 자막·영상 내용을 확인할 수 없다. recent-exam-patterns.md 색인 갱신은 폴더 버전 튜터에서 진행해야 한다고 안내하고, 확인되지 않은 영상은 출제 근거로 쓰지 않는다.
- 이 대화가 길어지면 사용자가 "새 대화"를 눌러도 학습 기록이 유지된다. 새 대화에서 재개 요청을 받으면 get_state로 이어간다.`;

export function buildSystem(files) {
  const body = files
    .filter((f) => f.text != null)
    .map((f) => `<file path="${f.path}">\n${f.text}\n</file>`)
    .join('\n\n');
  return `${WEB_ADAPTER}\n\n<project_files>\n${body}\n</project_files>`;
}
