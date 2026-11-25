// 사이트 기본 설정. 배포하는 사람이 여기 값을 바꾸면 모든 사용자의 기본값이 바뀝니다.
// 사용자가 설정 창에서 바꾼 값은 브라우저(localStorage)에 저장되어 이 기본값보다 우선합니다.
export const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'claude-opus-5-5',
  effort: 'medium',
  // 응답이 안전 분류기에 거절되면 서버가 다른 모델로 자동 재시도합니다.
  useFallbacks: true,
  pyodideIndexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.6/full/',
};

export const MAX_TOKENS = 32000;
export const MAX_AGENT_STEPS = 24;      // 한 번의 사용자 메시지에서 허용하는 도구 호출 반복 횟수
export const PYTHON_TIMEOUT_MS = 90_000; // 한 번의 코드 실행 제한 시간
export const OUTPUT_LIMIT = 20_000;     // 도구 결과로 돌려줄 출력 최대 길이(문자)

const KEY = 'bdt.settings';

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => [key, saved?.[key] ?? value]));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
