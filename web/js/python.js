// Python 실행기: Web Worker 안의 Pyodide를 호출하고, 제한 시간을 넘기면 작업자를 재시작합니다.
import { PYTHON_TIMEOUT_MS } from './config.js';

export class PythonRunner {
  constructor(getIndexURL, onStatus = () => {}) {
    this.getIndexURL = getIndexURL;
    this.onStatus = onStatus;
    this.worker = null;
    this.seq = 0;
    this.pending = new Map();
    this.queue = Promise.resolve();
    this.files = []; // 재시작 후 다시 넣을 업로드 파일
  }

  _spawn() {
    // 단일 HTML 버전은 작업자 코드를 페이지 안에 담아 Blob으로 실행 (file://에서도 동작)
    const src = globalThis.__BDT_WORKER_SRC__;
    this.worker = src
      ? new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), { type: 'module' })
      : new Worker(new URL('./py-worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => {
      const p = this.pending.get(e.data.id);
      if (p) { this.pending.delete(e.data.id); clearTimeout(p.timer); p.resolve(e.data); }
    };
    this.worker.onerror = (e) => {
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.resolve({ ok: false, error: e.message || 'Python 작업자 오류' }); }
      this.pending.clear();
      this.worker.terminate();
      this.worker = null;
      this.ready = false;
    };
  }

  _call(msg, timeout = PYTHON_TIMEOUT_MS) {
    if (!this.worker) this._spawn();
    const id = ++this.seq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.worker.terminate();
        this.worker = null;
        this.ready = false;
        this.onStatus('err', '시간 초과로 Python을 재시작했어요 (변수는 초기화됨)');
        resolve({ ok: false, error: `실행 시간이 ${Math.round(timeout / 1000)}초를 넘어 중단했습니다. 무한 루프나 너무 큰 연산이 없는지 확인하세요. Python 환경이 초기화되어 이전 변수는 사라졌습니다.` });
      }, timeout);
      this.pending.set(id, { resolve, timer });
      this.worker.postMessage({ ...msg, id, indexURL: this.getIndexURL() });
    });
  }

  // 같은 작업자에서 순서대로 실행되도록 직렬화
  _enqueue(fn) {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => {});
    return next;
  }

  init() {
    return this._enqueue(async () => {
      if (this.ready) return { ok: true };
      this.onStatus('busy', 'Python과 실습 패키지를 내려받는 중이에요. 첫 실행은 연결 상태에 따라 시간이 걸릴 수 있어요.');
      const r = await this._call({ op: 'init' }, 180_000);
      if (r.ok) {
        for (const f of this.files) await this._call({ op: 'writeFile', name: f.name, bytes: f.bytes });
        this.ready = true;
        this.onStatus('ready', 'Python 준비됨');
      } else {
        this.onStatus('err', `Python을 불러오지 못했어요: ${r.error}`);
      }
      return r;
    });
  }

  async run(code, ns = 'learner') {
    if (!this.ready) { const r = await this.init(); if (!r.ok) return { out: [], value: null, runtimeError: true, error: 'Python 준비에 실패했어요. 인터넷 연결을 확인한 뒤 실행을 다시 눌러주세요.' }; }
    return this._enqueue(async () => {
      this.onStatus('busy', ns === 'tutor' ? '튜터가 계산 중…' : '실행 중…');
      const r = await this._call({ op: 'run', code, ns });
      if (!this.worker) { this.ready = false; } else { this.onStatus('ready', 'Python 준비됨'); }
      if (!r.ok) return { out: [], value: null, runtimeError: true, error: r.error };
      return { out: r.out, value: r.value, error: r.error };
    });
  }

  async writeFile(name, bytes) {
    if (!this.ready) {
      const result = await this.init();
      if (!result.ok) return result;
    }
    return this._enqueue(async () => {
      const result = await this._call({ op: 'writeFile', name, bytes });
      if (result.ok) this.files = this.files.filter((file) => file.name !== name).concat({ name, bytes });
      return result;
    });
  }
}

export function formatRun(res, limit) {
  let s = res.out.map((o) => (o.stream === 'stderr' ? `[stderr] ${o.text}` : o.text)).join('\n');
  if (res.value != null) s += (s ? '\n' : '') + res.value;
  if (res.error) s += (s ? '\n' : '') + `[오류]\n${res.error}`;
  if (limit && s.length > limit) s = s.slice(0, limit) + `\n…(출력 ${s.length - limit}자 생략)`;
  return s || '(출력 없음)';
}
