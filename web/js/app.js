// 화면 연결: 채팅, 학습자 선택, 코드 편집기, 진도, 요약노트, 설정, 백업
import { marked } from '../vendor/marked.mjs';
import DOMPurify from '../vendor/purify.mjs';
import { loadSettings, saveSettings } from './config.js';
import { kv } from './kv.js';
import * as store from './state.js';
import { loadKnowledge, buildSystem } from './prompt.js';
import { PythonRunner, formatRun } from './python.js';
import { Tutor, explainError } from './agent.js';

const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
  }
  for (const k of kids) n.append(k);
  return n;
};
const NEW = '_new';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 무시 */ } };

let settings = loadSettings();
let system = '';
let currentId = null;
let busy = false;
let pendingLesson = '';

const py = new PythonRunner(() => settings.pyodideIndexURL, (kind, text) => {
  const s = $('#pyStatus');
  s.textContent = text;
  s.className = `py-status ${kind}`;
});

const host = {
  learnerId: () => currentId,
  async selectLearner(id, { keepChat } = {}) {
    if (keepChat) {
      const existing = await kv.get(`chat:${id}`);
      if (existing?.messages?.length && id !== currentId) await kv.set(`chat-archive:${id}:${Date.now()}`, existing);
      await kv.set(`chat:${id}`, { messages: tutor.messages });
      if (!currentId) await kv.del(`chat:${NEW}`);
    }
    currentId = id;
    lsSet('bdt.lastLearner', id);
    await refreshLearners();
    renderProgress();
    renderNotes();
  },
  async saveChat(messages) {
    await kv.set(`chat:${currentId || NEW}`, { messages });
  },
  onStateChange: () => renderProgress(),
  onNote: (note) => { renderNotes(note.id); showTab('notes'); },
  onLearnerRun: (code, res) => showOutput(res, '튜터가 learner 공간에서 실행'),
};

const tutor = new Tutor({ settings: () => settings, system: () => system, py, host });

// ---------- 마크다운 ----------
function md(text) {
  const html = DOMPurify.sanitize(marked.parse(text, { gfm: true, breaks: false }));
  const wrap = el('div');
  wrap.innerHTML = html;
  wrap.querySelectorAll('pre > code').forEach((code) => {
    const cls = code.className || '';
    if (/language-(python|py)\b/.test(cls) || !/language-/.test(cls)) {
      const btn = el('button', { class: 'copy-to-editor', type: 'button', title: '코드 편집기로 복사' }, '편집기로');
      btn.addEventListener('click', () => { $('#editor').value = code.textContent; showTab('code'); $('#editor').focus(); });
      code.parentElement.append(btn);
    }
  });
  return wrap;
}

// ---------- 채팅 렌더링 ----------
const msgs = $('#messages');
const scrollDown = () => { msgs.scrollTop = msgs.scrollHeight; };
const stripCtx = (s) => s.replace(/^<context[^>]*\/>\n?/, '');

const TOOL_LABEL = {
  get_state: () => '학습 기록 확인',
  create_learner: (i) => `학습 ID 발급 · ${i.learner_id}`,
  open_learner: (i) => `학습 기록 열기 · ${i.learner_id}`,
  update_state: () => '학습 기록 저장',
  save_state: () => '학습 기록 전체 저장',
  run_python: (i) => (i.namespace === 'tutor' ? '튜터 계산 (비공개)' : '학습자 코드 실행'),
  save_summary_note: (i) => `요약노트 저장 · ${i.title || ''}`,
};
const chip = (b, err) => el('span', { class: `tool-chip${err ? ' err' : ''}`, 'data-tool-id': b.id || '' }, `${err ? '⚠ ' : '• '}${(TOOL_LABEL[b.name] || (() => b.name))(b.input || {})}${err ? ' 실패' : ''}`);

const findChip = (b) => [...msgs.querySelectorAll('.tool-chip')].find((c) => c.dataset.toolId === b.id);

function addUserBubble(text) { msgs.append(el('div', { class: 'msg user' }, text)); scrollDown(); }
function addNotice(text, err) { msgs.append(el('div', { class: `msg notice${err ? ' err' : ''}` }, text)); scrollDown(); }

function renderAssistant(content, errIds = new Set()) {
  const bubble = el('div', { class: 'msg assistant' });
  for (const b of content) {
    if (b.type === 'text' && b.text.trim()) bubble.append(...md(b.text).childNodes);
    else if (b.type === 'tool_use') bubble.append(chip(b, errIds.has(b.id)));
  }
  return bubble.childNodes.length ? bubble : null;
}

function renderHistory(messages) {
  msgs.innerHTML = '';
  const errIds = new Set(messages.flatMap((m) => (m.role === 'user' && Array.isArray(m.content) ? m.content : []))
    .filter((c) => c.type === 'tool_result' && c.is_error).map((c) => c.tool_use_id));
  for (const m of messages) {
    if (m.role === 'user') {
      const blocks = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content;
      for (const b of blocks) if (b.type === 'text') addUserBubble(stripCtx(b.text));
    } else {
      const n = renderAssistant(m.content, errIds);
      if (n) msgs.append(n);
    }
  }
  if (!messages.length) showWelcome();
  scrollDown();
}

function showWelcome() {
  const node = $('#welcomeTpl').content.cloneNode(true);
  const resume = node.querySelector('#welcomeResume');
  node.querySelector('#practiceStart').addEventListener('click', openPythonPractice);
  const connect = node.querySelector('#connectAI');
  connect.addEventListener('click', openSettings);
  connect.hidden = hasConnection();
  if (currentId) {
    resume.textContent = '';
    resume.append(el('button', { class: 'starter', 'data-say': `내 학습 ID는 ${currentId}이야. 지난 수업 이어서 해줘.` }, `학습 ID ${currentId}로 지난 수업 이어서 하기`));
  } else {
    resume.textContent = '이미 학습 ID가 있다면 위의 학습 ID 목록에서 고르거나 “내 학습 ID는 study01이야. 이어서 해줘”라고 보내세요.';
  }
  msgs.append(node);
}

// ---------- 전송 ----------
function setBusy(b) {
  busy = b;
  $('#sendBtn').disabled = b;
  $('#submitBtn').disabled = b;
  $('#stopBtn').hidden = !b;
}

async function send(text) {
  text = text.trim();
  if (!text || busy) return;
  if (!hasConnection()) {
    pendingLesson = text;
    $('#input').value = text;
    openSettings();
    return;
  }
  msgs.querySelector('.welcome')?.remove();
  addUserBubble(text);
  setBusy(true);
  py.init(); // Python을 미리 불러온다 (기다리지 않음)

  let bubble = null, textBuf = '', textNode = null, raf = 0;
  const ensureBubble = () => {
    if (!bubble) {
      bubble = el('div', { class: 'msg assistant' }, el('span', { class: 'typing' }, el('i'), el('i'), el('i')));
      msgs.append(bubble);
      scrollDown();
    }
    return bubble;
  };
  const flush = () => {
    raf = 0;
    if (!textNode) { textNode = el('div'); ensureBubble().querySelector('.typing')?.remove(); bubble.prepend(textNode); }
    textNode.replaceChildren(...md(textBuf).childNodes);
    scrollDown();
  };
  const ui = {
    onStep() { bubble = null; textBuf = ''; textNode = null; ensureBubble(); },
    onText(d) { textBuf += d; if (!raf) raf = requestAnimationFrame(flush); },
    onToolStart(b) { findChip(b)?.classList.add('running'); },
    onToolEnd(b, result, isErr) {
      const existing = findChip(b);
      existing?.classList.remove('running');
      if (!isErr) return;
      if (existing) existing.replaceWith(chip(b, true)); else ensureBubble().append(chip(b, true));
    },
    onDone(msg) {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      const n = renderAssistant(msg.content);
      if (n) bubble.replaceWith(n); else bubble.remove();
      bubble = n || null;
    },
    onNotice: addNotice,
  };
  try {
    await tutor.send(text, ui);
  } catch (err) {
    if (bubble && !bubble.textContent.trim()) bubble.remove();
    addNotice(explainError(err), true);
    if (err?.message === 'NO_KEY') openSettings();
  } finally {
    setBusy(false);
    renderProgress();
  }
}

$('#composer').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#input').value; $('#input').value = ''; send(v); });
$('#input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#composer').requestSubmit(); }
});
$('#stopBtn').addEventListener('click', () => tutor.stop());
document.addEventListener('click', (e) => {
  const say = e.target.closest('[data-say]');
  if (say) send(say.getAttribute('data-say'));
});

// ---------- 코드 편집기 ----------
const editor = $('#editor');
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const { selectionStart: s, selectionEnd: t } = editor;
    editor.setRangeText('    ', s, t, 'end');
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault(); runEditor();
  }
});
editor.addEventListener('focus', () => py.init(), { once: true });

function showOutput(res, label) {
  const out = $('#output');
  out.innerHTML = '';
  if (label) out.append(el('div', { class: 'muted' }, `— ${label} —`));
  for (const o of res.out) out.append(el('span', { class: o.stream === 'stderr' ? 'stderr' : '' }, o.text + '\n'));
  if (res.value != null) out.append(el('span', {}, res.value + '\n'));
  if (res.error) out.append(el('span', { class: 'stderr' }, res.error));
  if (!res.out.length && res.value == null && !res.error) out.append(el('span', { class: 'muted' }, '(출력 없음)'));
}

async function runEditor(code = editor.value) {
  const runButton = $('#runBtn');
  if (runButton.disabled) return;
  runButton.disabled = true;
  try {
    const res = await py.run(code, 'learner');
    showOutput(res);
    return res;
  } finally { $('#runBtn').disabled = false; }
}
$('#runBtn').addEventListener('click', () => runEditor());
$('#clearOut').addEventListener('click', () => { $('#output').innerHTML = ''; });
$('#submitBtn').addEventListener('click', async () => {
  if (busy) return;
  const code = editor.value;
  const res = await runEditor(code);
  if (!res || res.runtimeError) return;
  const out = formatRun(res, 6000);
  send(`[코드 제출]\n\`\`\`python\n${code}\n\`\`\`\n\n실행 출력:\n\`\`\`\n${out}\n\`\`\``);
});
$('#fileInput').addEventListener('change', async (e) => {
  for (const f of e.target.files) {
    const result = await py.writeFile(f.name, await f.arrayBuffer());
    if (!result.ok) {
      $('#output').append(el('div', { class: 'stderr' }, result.error));
      continue;
    }
    $('#output').append(el('div', { class: 'muted' }, `파일 올림: /home/pyodide/${f.name}`));
  }
  e.target.value = '';
});

// ---------- 탭 ----------
function showTab(name) {
  document.querySelectorAll('.tab').forEach((t) => { const on = t.dataset.tab === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
  document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== `panel-${name}`; });
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
function openPythonPractice() {
  showTab('code');
  $('.side').scrollIntoView({ block: 'start' });
}
$('#jumpToCode').addEventListener('click', openPythonPractice);
$('#jumpToChat').addEventListener('click', () => {
  $('#composer').scrollIntoView({ block: 'nearest' });
});

// ---------- 진도 ----------
async function renderProgress() {
  const view = $('#progressView');
  view.innerHTML = '';
  if (!currentId) { view.append(el('p', { class: 'empty' }, '학습 ID가 정해지면 여기에 진도가 표시됩니다.')); return; }
  const st = await store.getState(currentId);
  const p = store.computeProgress(st);
  if (!p) { view.append(el('p', { class: 'empty' }, '기록이 없습니다.')); return; }
  const prof = st.profile || {};
  const dl = el('dl', { class: 'kv' });
  const add = (k, v) => { if (v != null && v !== '') dl.append(el('dt', {}, k), el('dd', {}, String(v))); };
  add('학습 ID', st.learner_id);
  add('공부 가능일', Array.isArray(prof.available_days) && prof.available_days.length ? `${prof.available_days.length}일` : null);
  add('하루 시간', prof.daily_minutes ? `${prof.daily_minutes}분` : null);
  if (p.active) add('현재 문항', `${p.active.title || p.active.id} · 힌트 ${p.active.hints_used ?? 0}/3`);
  add('마지막 저장', st.updated_at ? new Date(st.updated_at).toLocaleString('ko-KR') : null);
  view.append(dl);

  const table = (title, rows, total) => {
    const tb = el('table', {}, el('thead', {}, el('tr', {}, ...['범위', '완료/계획', '독립', '도움 후', '해설'].map((h) => el('th', {}, h)))));
    const body = el('tbody');
    for (const r of rows) body.append(el('tr', {}, el('td', {}, `${r.type}유형`), el('td', {}, `${r.done}/${r.planned} (${store.pct(r)})`), el('td', {}, String(r.independent)), el('td', {}, String(r.assisted)), el('td', {}, String(r.reviewed))));
    body.append(el('tr', {}, el('td', {}, el('strong', {}, '전체')), el('td', {}, `${total.done}/${total.planned} (${store.pct(total)})`), el('td', {}, String(total.independent)), el('td', {}, String(total.assisted)), el('td', {}, String(total.reviewed))));
    tb.append(body);
    const ratio = total.planned ? total.done / total.planned : 0;
    return [el('h3', {}, title), el('div', { class: 'bar' }, Object.assign(el('span'), { style: `width:${Math.round(ratio * 100)}%` })), tb];
  };
  if (p.today) view.append(...table(`오늘 (${p.today.day})`, p.todayRows, p.todayTotal));
  view.append(...table('전 일정', p.allRows, p.allTotal));

  const days = st.plan?.days || [];
  if (days.length) {
    view.append(el('h3', {}, '일정'));
    const ul = el('ul', { class: 'day-list' });
    for (const d of days) ul.append(el('li', {}, `${d.day} · ${d.minutes}분 · ${(d.problem_ids || []).length}문항 · ${(d.concepts || []).join(', ')}`));
    view.append(ul);
  } else {
    view.append(el('p', { class: 'empty' }, '아직 계획이 없습니다. 진단을 마치면 날짜별 계획이 생깁니다.'));
  }
}

// ---------- 요약노트 ----------
let notesCache = [];
async function renderNotes(selectId) {
  notesCache = await store.getNotes(currentId);
  const list = $('#notesList');
  list.innerHTML = '';
  if (!notesCache.length) { list.append(el('p', { class: 'empty' }, '요약노트가 아직 없어요. 채팅에서 “요약노트 만들어줘”라고 요청하세요.')); $('#noteView').innerHTML = ''; return; }
  const sorted = [...notesCache].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pick = selectId || sorted[0].id;
  for (const n of sorted) {
    const item = el('div', { class: `note-item${n.id === pick ? ' active' : ''}`, tabindex: '0' },
      el('div', {}, el('div', {}, n.title), el('small', {}, `${new Date(n.created_at).toLocaleString('ko-KR')}${n.common ? ' · 공통' : ''}`)));
    item.addEventListener('click', () => renderNotes(n.id));
    list.append(item);
  }
  const note = notesCache.find((n) => n.id === pick);
  const view = $('#noteView');
  view.innerHTML = '';
  const actions = el('div', { class: 'row-actions' },
    el('button', { class: 'btn primary small', type: 'button', onclick: () => printNote(note) }, 'PDF로 저장'),
    el('button', { class: 'btn ghost small', type: 'button', onclick: () => download(`${note.filename || 'summary-notes'}.md`, note.markdown, 'text/markdown') }, 'Markdown 받기'));
  view.append(actions, ...md(note.markdown).childNodes);
  view.querySelectorAll('.copy-to-editor').forEach((b) => b.remove());
}

function printNote(note) {
  const w = window.open('', '_blank');
  if (!w) { addNotice('팝업이 차단되어 PDF 창을 열지 못했어요. 이 사이트의 팝업을 허용해 주세요.', true); return; }
  const body = DOMPurify.sanitize(marked.parse(note.markdown, { gfm: true }));
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${note.filename || note.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&family=Nanum+Gothic+Coding&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: "Noto Sans KR", sans-serif; color: #111; font-size: 11pt; line-height: 1.6; background: #fff; }
  h1 { font-size: 18pt; border-bottom: 2px solid #2459d6; padding-bottom: 4px; }
  h2 { font-size: 14pt; margin-top: 18pt; break-after: avoid; }
  h3 { font-size: 12pt; break-after: avoid; }
  pre { background: #f4f6fa; border: 1px solid #dde3ee; border-radius: 6px; padding: 8px 10px; white-space: pre-wrap; word-break: break-word; break-inside: avoid; }
  code { font-family: "Nanum Gothic Coding", monospace; font-size: 9.5pt; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; break-inside: avoid; }
  th, td { border: 1px solid #ccd3df; padding: 3px 6px; text-align: left; }
  th { background: #eef2f8; }
</style></head><body>${body}</body></html>`);
  w.document.close();
  const go = () => { w.focus(); w.print(); };
  (w.document.fonts?.ready || Promise.resolve()).then(() => setTimeout(go, 300));
}

function download(name, text, type = 'application/json') {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- 학습자 선택 ----------
async function refreshLearners() {
  const ids = await store.listLearners();
  const sel = $('#learnerSelect');
  sel.innerHTML = '';
  sel.append(el('option', { value: '' }, '새 학습자'));
  for (const id of ids) sel.append(el('option', { value: id }, id));
  sel.value = currentId || '';
}

async function loadChatFor(id) {
  const chat = await kv.get(`chat:${id || NEW}`);
  tutor.messages = chat?.messages || [];
  renderHistory(tutor.messages);
}

$('#learnerSelect').addEventListener('change', async (e) => {
  if (busy) { e.target.value = currentId || ''; return; }
  currentId = e.target.value || null;
  lsSet('bdt.lastLearner', currentId || '');
  await loadChatFor(currentId);
  renderProgress();
  renderNotes();
});

$('#newChatBtn').addEventListener('click', async () => {
  if (busy) return;
  if (tutor.messages.length && !confirm('지금 대화를 보관하고 새 대화를 시작할까요? 학습 기록과 요약노트는 그대로 유지됩니다.')) return;
  const key = currentId || NEW;
  if (tutor.messages.length) await kv.set(`chat-archive:${key}:${Date.now()}`, { messages: tutor.messages });
  tutor.messages = [];
  await kv.set(`chat:${key}`, { messages: [] });
  renderHistory([]);
});

// ---------- 설정 ----------
const dlg = $('#settingsDlg');
function hasConnection() {
  return Boolean(settings.apiKey);
}

function openSettings() {
  const form = $('#settingsForm');
  for (const [key, value] of Object.entries(settings)) {
    const input = form.elements[key];
    if (!input) continue;
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = value ?? '';
  }
  $('#connectionError').textContent = '';
  dlg.returnValue = '';
  dlg.showModal();
}

$('#settingsBtn').addEventListener('click', openSettings);
$('#disconnectBtn').addEventListener('click', () => {
  settings = { ...settings, apiKey: '' };
  const saved = saveSettings(settings);
  const connect = $('#connectAI');
  if (connect) connect.hidden = false;
  dlg.close('cancel');
  addNotice(saved ? '저장된 연결 정보를 지웠어요.' : '현재 탭에서 연결을 지웠어요. 브라우저 저장소의 정보는 지우지 못했어요.', !saved);
});
$('#settingsForm').addEventListener('submit', (event) => {
  if (event.submitter?.value !== 'save') return;
  const form = event.currentTarget;
  const next = { ...settings };
  for (const key of Object.keys(settings)) {
    const input = form.elements[key];
    if (!input) continue;
    next[key] = input.type === 'checkbox' ? input.checked : input.value.trim();
  }
  if (!next.apiKey) {
    event.preventDefault();
    $('#connectionError').textContent = 'Anthropic API 키를 입력해 주세요.';
    return;
  }

  if (next.pyodideIndexURL && !next.pyodideIndexURL.endsWith('/')) next.pyodideIndexURL += '/';
  settings = next;
  if (!saveSettings(settings)) addNotice('설정을 저장할 수 없어 이번 방문에만 적용됩니다.', true);
});
dlg.addEventListener('close', () => {
  const lesson = pendingLesson;
  pendingLesson = '';
  if (dlg.returnValue !== 'save') return;
  const connect = $('#connectAI');
  if (connect) connect.hidden = hasConnection();
  if (lesson && hasConnection()) {
    $('#input').value = '';
    void send(lesson);
  }
});

// ---------- 백업 ----------
$('#backupBtn').addEventListener('click', () => $('#backupDlg').showModal());
$('#exportBtn').addEventListener('click', async () => {
  const data = await store.exportAll();
  download(`bigdata-tutor-backup-${new Date().toLocaleDateString('sv-SE')}.json`, JSON.stringify(data, null, 2));
});
$('#exportStateBtn').addEventListener('click', async () => {
  if (!currentId) { alert('먼저 학습 ID를 선택하세요.'); return; }
  download('state.json', JSON.stringify(await store.getState(currentId), null, 2));
});
$('#importInput').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f || busy) return;
  try {
    const data = JSON.parse(await f.text());
    const dialog = $('#importChoiceDlg');
    dialog.returnValue = 'cancel';
    const choice = await new Promise((resolve) => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true });
      dialog.showModal();
    });
    if (choice === 'cancel' || busy) return;
    const r = await store.importAll(data, { overwrite: choice === 'overwrite' });
    await refreshLearners();
    alert(`가져오기 완료: ${r.written}개 항목 저장, ${r.skipped}개 건너뜀`);
    await loadChatFor(currentId);
    renderProgress(); renderNotes();
  } catch (err) {
    alert(`가져오지 못했어요: ${err.message}`);
  }
});

// ---------- 시작 ----------
(async function init() {
  try {
    const k = await loadKnowledge();
    system = buildSystem(k.files);
    store.setTemplate(k.template);
    const missing = k.files.filter((f) => f.text == null).map((f) => f.path);
    if (missing.length) console.warn('불러오지 못한 문서:', missing);
  } catch (err) {
    addNotice(err.message, true);
    $('#sendBtn').disabled = true;
  }
  const ids = await store.listLearners();
  const last = lsGet('bdt.lastLearner');
  currentId = last && ids.includes(last) ? last : null;
  await refreshLearners();
  await loadChatFor(currentId);
  renderProgress();
  renderNotes();
  
})();
