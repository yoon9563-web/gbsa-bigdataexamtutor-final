// 튜터 엔진: Claude Messages API + 브라우저 도구(학습 기록, Python, 요약노트)로 수업 루프를 돌립니다.
import Anthropic from '../vendor/anthropic-sdk.mjs';
import { MAX_TOKENS, MAX_AGENT_STEPS, OUTPUT_LIMIT } from './config.js';
import * as store from './state.js';
import { formatRun } from './python.js';

const t = (name, description, properties, required) => ({
  name, description, eager_input_streaming: true,
  input_schema: { type: 'object', properties, required, additionalProperties: false },
});

export const TOOLS = [
  t('get_state', '학습자의 state.json을 읽는다. learner_id를 생략하면 현재 선택된 학습자를 읽는다. 기록이 없으면 null을 돌려준다.',
    { learner_id: { type: 'string', description: '학습 ID (생략 시 현재 학습자)' } }, []),
  t('create_learner', '신규 학습자 기록을 state.template.json으로 만들고 현재 학습자로 선택한다. 이미 있는 ID면 실패한다.',
    { learner_id: { type: 'string', description: '영문 소문자·숫자·하이픈 2~32자' } }, ['learner_id']),
  t('open_learner', '사용자가 밝힌 기존 학습 ID를 현재 학습자로 선택하고 그 기록을 돌려준다. 이 브라우저에 없으면 실패한다.',
    { learner_id: { type: 'string' } }, ['learner_id']),
  t('update_state', '현재 학습자의 state.json에 JSON Merge Patch(RFC 7396)를 적용해 저장한다. 객체는 병합, null은 키 삭제, 배열은 통째로 교체된다. 저장 전 구조·ID 참조를 검증하고, 실패하면 저장하지 않고 오류 목록을 돌려준다.',
    { patch: { type: 'object', description: '병합할 부분 객체. 예: {"problems": {"d1-t1-01": {"status": "active"}}, "active_problem_id": "d1-t1-01"}' } }, ['patch']),
  t('save_state', '현재 학습자의 state.json 전체를 교체 저장한다. 구조를 크게 바꿀 때만 쓰고, 보통은 update_state를 쓴다.',
    { state: { type: 'object', description: 'state.json 전체' } }, ['state']),
  t('run_python', '브라우저 Pyodide에서 Python 코드를 실행하고 stdout/stderr/마지막 식의 값을 돌려준다. namespace "tutor"는 학습자에게 보이지 않는 계산 공간, "learner"는 학습자 편집기와 같은 공간이다.',
    {
      code: { type: 'string' },
      namespace: { type: 'string', enum: ['tutor', 'learner'] },
    }, ['code', 'namespace']),
  t('save_summary_note', '완성된 요약노트 Markdown을 저장하고 요약노트 탭에 띄운다. 학습자가 선택되지 않았으면 공통 노트로 저장된다. 사용자는 탭에서 PDF로 저장한다.',
    {
      title: { type: 'string' },
      filename: { type: 'string', description: '예: summary-notes-2026-11-25' },
      markdown: { type: 'string' },
    }, ['title', 'filename', 'markdown']),
];

function validateInput(tool, input) {
  const def = TOOLS.find((d) => d.name === tool);
  if (!def) return `알 수 없는 도구 ${tool}`;
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return '입력이 객체가 아닙니다.';
  const props = def.input_schema.properties;
  for (const r of def.input_schema.required) if (!(r in input)) return `필수 입력 ${r}가 없습니다.`;
  for (const [k, v] of Object.entries(input)) {
    const p = props[k];
    if (!p) return `알 수 없는 입력 ${k}`;
    const ok = p.type === 'object' ? (v && typeof v === 'object' && !Array.isArray(v)) : typeof v === p.type;
    if (!ok) return `${k}의 형식이 ${p.type}가 아닙니다.`;
    if (p.enum && !p.enum.includes(v)) return `${k}는 ${p.enum.join('/')} 중 하나여야 합니다.`;
  }
  return null;
}

const json = (v) => JSON.stringify(v, null, 1);

export class Tutor {
  /**
   * @param {object} o
   * @param {() => object} o.settings
   * @param {() => string} o.system
   * @param {import('./python.js').PythonRunner} o.py
   * @param {object} o.host  화면/저장 연결: learnerId(), selectLearner(id), onNote(note), onStateChange()
   */
  constructor({ settings, system, py, host }) {
    Object.assign(this, { settings, system, py, host });
    this.messages = [];
    this.abort = null;
  }

  client() {
    const s = this.settings();
    if (!s.apiKey) throw new Error('NO_KEY');
    return new Anthropic({
      apiKey: s.apiKey,
      dangerouslyAllowBrowser: true,
      maxRetries: 2,
    });
  }

  async runTool(name, input) {
    const id = this.host.learnerId();
    switch (name) {
      case 'get_state': {
        const target = input.learner_id || id;
        if (!target) return '현재 선택된 학습자가 없습니다. 신규 학습자는 create_learner, 기존 학습자는 open_learner를 쓰세요.';
        if (input.learner_id && input.learner_id !== id) return '다른 학습자의 기록은 열 수 없습니다. 사용자가 그 ID를 밝혔다면 open_learner를 쓰세요.';
        return json(await store.getState(target));
      }
      case 'create_learner': {
        const r = await store.createLearner(input.learner_id);
        if (!r.ok) return { error: r.error };
        await this.host.selectLearner(input.learner_id, { keepChat: true });
        return `학습자 "${input.learner_id}"를 만들고 선택했습니다.\n${json(r.state)}`;
      }
      case 'open_learner': {
        const st = await store.getState(input.learner_id);
        if (!st) return { error: `이 브라우저에 "${input.learner_id}" 기록이 없습니다. 다른 기기에서 공부했다면 상단 "백업"에서 백업 파일을 가져오도록 안내하세요.` };
        await this.host.selectLearner(input.learner_id, { keepChat: true });
        return `학습자 "${input.learner_id}"를 선택했습니다.\n${json(st)}`;
      }
      case 'update_state':
      case 'save_state': {
        if (!id) return { error: '현재 선택된 학습자가 없습니다. create_learner 또는 open_learner를 먼저 호출하세요.' };
        const r = name === 'update_state' ? await store.patchState(id, input.patch) : await store.writeState(id, input.state);
        if (!r.ok) return { error: `저장하지 않았습니다. 검증 오류:\n- ${r.errors.join('\n- ')}` };
        this.host.onStateChange();
        return `저장했습니다 (updated_at ${r.state.updated_at}).`;
      }
      case 'run_python': {
        const res = await this.py.run(input.code, input.namespace);
        if (input.namespace === 'learner') this.host.onLearnerRun?.(input.code, res);
        return formatRun(res, OUTPUT_LIMIT);
      }
      case 'save_summary_note': {
        const note = { id: `note-${Date.now()}`, title: input.title, filename: input.filename, markdown: input.markdown, created_at: new Date().toISOString(), learner_id: id || null };
        await store.saveNote(id, note);
        this.host.onNote(note);
        return `노트 ID ${note.id}로 저장했고 요약노트 탭에 표시했습니다. 사용자는 "PDF로 저장" 버튼으로 PDF를 만들 수 있습니다.`;
      }
      default:
        return { error: `알 수 없는 도구 ${name}` };
    }
  }

  pushUser(content) {
    const last = this.messages[this.messages.length - 1];
    // 직전 요청이 중단돼 user 메시지가 연속되면 하나로 합친다 (답이 없는 마지막 user 메시지에만 해당)
    if (last && last.role === 'user') {
      const toBlocks = (c) => (typeof c === 'string' ? [{ type: 'text', text: c }] : c);
      last.content = [...toBlocks(last.content), ...toBlocks(content)];
    } else {
      this.messages.push({ role: 'user', content });
    }
  }

  stop() { this.abort?.abort(); }

  /** 사용자 메시지 하나를 처리한다. ui: { onStep(), onText(d), onToolStart(b), onToolEnd(b, result, isError), onDone(msg), onNotice(text, isErr) } */
  async send(text, ui) {
    const client = this.client();
    const s = this.settings();
    const now = new Date();
    const ctx = `<context learner_id="${this.host.learnerId() || '(미선택)'}" today="${now.toLocaleDateString('sv-SE')}" weekday="${now.toLocaleDateString('ko-KR', { weekday: 'long' })}" />`;
    this.pushUser([{ type: 'text', text: `${ctx}\n${text}` }]);
    await this.host.saveChat(this.messages);

    for (let step = 0; step < MAX_AGENT_STEPS; step++) {
      const params = {
        model: s.model,
        max_tokens: MAX_TOKENS,
        system: this.system(),
        tools: TOOLS,
        messages: this.messages,
        thinking: { type: 'adaptive' },
        output_config: { effort: s.effort },
        cache_control: { type: 'ephemeral' },
      };
      if (s.useFallbacks) {
        params.betas = ['server-side-fallback-2026-07-01'];
        params.fallbacks = 'default';
      }
      ui.onStep();
      this.abort = new AbortController();
      let msg;
      try {
        const stream = client.beta.messages.stream(params, { signal: this.abort.signal });
        stream.on('text', (d) => ui.onText(d));
        msg = await stream.finalMessage();
      } catch (err) {
        this.abort = null;
        if (err instanceof SyntaxError) {
          // 도구 입력 JSON이 깨진 경우: 한 번 더 시도
          ui.onNotice('도구 입력을 해석하지 못해 다시 시도합니다.', true);
          continue;
        }
        throw err;
      }
      this.abort = null;
      this.messages.push({ role: 'assistant', content: msg.content });
      await this.host.saveChat(this.messages, msg.usage);
      ui.onDone(msg);

      if (msg.stop_reason === 'refusal') {
        ui.onNotice('이 요청에는 답할 수 없다는 응답을 받았어요. 질문을 바꿔 다시 시도해 주세요.', true);
        // 잘린 tool_use가 있으면 다음 요청이 깨지지 않도록 오류 결과를 채운다
        const pending = msg.content.filter((b) => b.type === 'tool_use');
        if (pending.length) this.pushUser(pending.map((b) => ({ type: 'tool_result', tool_use_id: b.id, is_error: true, content: '응답이 중단되어 실행하지 않았습니다.' })));
        await this.host.saveChat(this.messages);
        return;
      }
      if (msg.stop_reason === 'pause_turn') continue;
      const uses = msg.content.filter((b) => b.type === 'tool_use');
      if (!uses.length) return;

      const results = [];
      for (const b of uses) {
        if (msg.stop_reason === 'max_tokens') {
          results.push({ type: 'tool_result', tool_use_id: b.id, is_error: true, content: '출력 한도에 걸려 도구 입력이 잘렸습니다. 실행하지 않았습니다. 더 작게 나눠서 다시 호출하세요.' });
          continue;
        }
        const bad = validateInput(b.name, b.input);
        if (bad) {
          results.push({ type: 'tool_result', tool_use_id: b.id, is_error: true, content: `입력 검증 실패: ${bad}. 실행하지 않았습니다.` });
          ui.onToolEnd(b, bad, true);
          continue;
        }
        ui.onToolStart(b);
        let out;
        try { out = await this.runTool(b.name, b.input); } catch (e) { out = { error: String(e?.message || e) }; }
        const isErr = typeof out === 'object' && out?.error;
        const content = isErr ? out.error : String(out);
        results.push({ type: 'tool_result', tool_use_id: b.id, content, ...(isErr ? { is_error: true } : {}) });
        ui.onToolEnd(b, content, !!isErr);
      }
      this.pushUser(results);
      await this.host.saveChat(this.messages);
    }
    ui.onNotice('도구 호출이 너무 많이 반복돼 이번 응답을 멈췄어요. "계속"이라고 보내면 이어갑니다.', true);
  }
}

export function explainError(err) {
  if (err?.message === 'NO_KEY') return '설정에서 내 Anthropic API 키를 먼저 입력해 주세요.';
  if (err instanceof Anthropic.APIUserAbortError || err?.name === 'AbortError') return '응답을 중지했어요.';
  if (err instanceof Anthropic.AuthenticationError) return 'API 키가 올바르지 않아요. 설정에서 키를 확인해 주세요.';
  if (err instanceof Anthropic.PermissionDeniedError) return '이 키로는 해당 모델을 쓸 권한이 없어요. 설정에서 모델이나 키를 확인해 주세요.';
  if (err instanceof Anthropic.NotFoundError) return '모델 이름을 찾을 수 없어요. 설정의 모델 이름을 확인해 주세요.';
  if (err instanceof Anthropic.RateLimitError) return '요청이 너무 많아요. 잠시 후 다시 보내 주세요.';
  if (err instanceof Anthropic.BadRequestError) return `요청 형식 오류: ${err.message}`;
  if (err instanceof Anthropic.InternalServerError) return 'Claude 서버가 잠시 응답하지 않아요. 잠시 후 다시 시도해 주세요.';
  if (err instanceof Anthropic.APIConnectionError) return '네트워크 연결에 실패했어요. 인터넷 연결를 확인해 주세요.';
  return `오류: ${err?.message || err}`;
}
