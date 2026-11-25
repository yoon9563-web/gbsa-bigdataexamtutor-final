// 학습 기록(state.json) 저장소. learners/README.md 규칙을 브라우저 저장소로 옮긴 것입니다.
import { kv } from './kv.js';

export const ID_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;
export const STATUSES = ['planned', 'active', 'independent_correct', 'assisted_correct', 'reviewed', 'skipped'];
export const DONE = ['independent_correct', 'assisted_correct', 'reviewed'];

let template = null;
export function setTemplate(t) { template = t; }

function freshState(id) {
  const base = template ? structuredClone(template) : {
    schema_version: 1, learner_id: null,
    profile: { available_days: [], daily_minutes: null, goals: {}, experience: null },
    diagnosis: {}, plan: { days: [] }, problems: {}, active_problem_id: null,
    concept_evidence: {}, review_queue: [], updated_at: null,
  };
  base.learner_id = id;
  base.summary_notes ??= { pending_offers: [], entries: [], exports: [] };
  base.updated_at = new Date().toISOString();
  return base;
}

export async function listLearners() {
  const keys = await kv.keys();
  return keys.filter((k) => typeof k === 'string' && k.startsWith('state:')).map((k) => k.slice(6)).sort();
}

export async function getState(id) {
  return (await kv.get(`state:${id}`)) ?? null;
}

export async function createLearner(id) {
  if (!ID_RE.test(id)) return { ok: false, error: '학습 ID는 영문 소문자·숫자·하이픈 2~32자로, 소문자나 숫자로 시작해야 합니다.' };
  if (await getState(id)) return { ok: false, error: `학습 ID "${id}"는 이미 있습니다. 다른 ID를 쓰거나 open_learner로 여세요.` };
  const st = freshState(id);
  await kv.set(`state:${id}`, st);
  return { ok: true, state: st };
}

// RFC 7396 JSON Merge Patch: 객체는 병합, null은 삭제, 배열·값은 교체.
export function mergePatch(target, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return structuredClone(patch);
  const out = (target && typeof target === 'object' && !Array.isArray(target)) ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = mergePatch(out[k], v);
  }
  return out;
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// learners/README.md의 구조·ID 참조 규칙 검증. 오류 목록을 돌려줍니다.
export function validateState(st, expectedId) {
  const e = [];
  if (!isObj(st)) return ['state는 객체여야 합니다.'];
  if (st.schema_version !== 1) e.push('schema_version은 1이어야 합니다.');
  if (st.learner_id !== expectedId) e.push(`learner_id는 "${expectedId}"여야 합니다.`);
  for (const k of ['profile', 'diagnosis', 'plan', 'problems', 'concept_evidence']) {
    if (!isObj(st[k])) e.push(`${k}는 객체여야 합니다.`);
  }
  if (!Array.isArray(st.review_queue)) e.push('review_queue는 배열이어야 합니다.');
  const problems = isObj(st.problems) ? st.problems : {};
  const days = st.plan?.days;
  if (!Array.isArray(days)) e.push('plan.days는 배열이어야 합니다.');
  else {
    const seen = new Set();
    days.forEach((d, i) => {
      if (!isObj(d)) { e.push(`plan.days[${i}]는 객체여야 합니다.`); return; }
      for (const k of ['day', 'minutes', 'problem_ids', 'concepts']) if (!(k in d)) e.push(`plan.days[${i}]에 ${k}가 없습니다.`);
      if (!Array.isArray(d.problem_ids)) return;
      for (const pid of d.problem_ids) {
        if (seen.has(pid)) e.push(`문항 ID "${pid}"가 계획에 두 번 이상 배치되었습니다.`);
        seen.add(pid);
        if (!problems[pid]) e.push(`plan.days[${i}]의 문항 "${pid}"가 problems에 없습니다.`);
      }
    });
  }
  for (const [pid, p] of Object.entries(problems)) {
    if (!isObj(p)) { e.push(`problems.${pid}는 객체여야 합니다.`); continue; }
    if (![1, 2, 3].includes(p.type)) e.push(`problems.${pid}.type은 1, 2, 3 중 하나여야 합니다.`);
    if (!STATUSES.includes(p.status)) e.push(`problems.${pid}.status "${p.status}"는 허용되지 않습니다 (${STATUSES.join(', ')}).`);
    if (!Number.isInteger(p.hints_used) || p.hints_used < 0 || p.hints_used > 3) e.push(`problems.${pid}.hints_used는 0~3 정수여야 합니다.`);
    if (!Array.isArray(p.attempts)) e.push(`problems.${pid}.attempts는 배열이어야 합니다.`);
  }
  if (st.active_problem_id != null && !problems[st.active_problem_id]) e.push(`active_problem_id "${st.active_problem_id}"가 problems에 없습니다.`);
  const activeCount = Object.values(problems).filter((p) => p?.status === 'active').length;
  if (activeCount > 1) e.push(`status가 active인 문항이 ${activeCount}개입니다. 최대 하나여야 합니다.`);
  if (st.summary_notes != null) {
    for (const k of ['pending_offers', 'entries', 'exports']) {
      if (!Array.isArray(st.summary_notes[k])) e.push(`summary_notes.${k}는 배열이어야 합니다.`);
    }
  }
  return e;
}

// 최신 상태를 읽고 → 검증 → 저장. 검증 실패면 저장하지 않습니다.
export async function writeState(id, next) {
  const errors = validateState(next, id);
  if (errors.length) return { ok: false, errors };
  next.updated_at = new Date().toISOString();
  await kv.set(`state:${id}`, next);
  return { ok: true, state: next };
}

export async function patchState(id, patch) {
  const cur = await getState(id);
  if (!cur) return { ok: false, errors: [`학습 ID "${id}"의 기록이 없습니다.`] };
  return writeState(id, mergePatch(cur, patch));
}

// 진도 계산 (tutor/workflow.md의 진도표 규칙)
export function computeProgress(st) {
  if (!st) return null;
  const problems = st.problems || {};
  const days = st.plan?.days || [];
  const planned = days.flatMap((d) => d.problem_ids || []);
  const row = (ids) => {
    const ps = ids.map((id) => problems[id]).filter(Boolean).filter((p) => p.status !== 'skipped');
    const c = (s) => ps.filter((p) => p.status === s).length;
    const done = c('independent_correct') + c('assisted_correct') + c('reviewed');
    return { planned: ps.length, done, independent: c('independent_correct'), assisted: c('assisted_correct'), reviewed: c('reviewed') };
  };
  const byType = (ids) => [1, 2, 3].map((t) => ({ type: t, ...row(ids.filter((id) => problems[id]?.type === t)) }));
  // "오늘" = 미완료 문항이 남은 첫 날 (없으면 마지막 날)
  let todayIdx = days.findIndex((d) => (d.problem_ids || []).some((id) => problems[id] && !DONE.includes(problems[id].status) && problems[id].status !== 'skipped'));
  if (todayIdx < 0) todayIdx = days.length - 1;
  const today = days[todayIdx];
  const todayIds = today?.problem_ids || [];
  return {
    today, todayIdx,
    todayRows: byType(todayIds), todayTotal: row(todayIds),
    allRows: byType(planned), allTotal: row(planned),
    active: st.active_problem_id ? { id: st.active_problem_id, ...problems[st.active_problem_id] } : null,
  };
}

export const pct = (r) => (r.planned === 0 ? '배정 없음' : `${Math.round((r.done / r.planned) * 100)}%`);

// 요약노트
export async function saveNote(id, note) {
  const key = `notes:${id || '_common'}`;
  const list = (await kv.get(key)) || [];
  list.push(note);
  await kv.set(key, list);
  return list.length;
}
export async function getNotes(id) {
  const own = (await kv.get(`notes:${id || '_common'}`)) || [];
  const common = id ? ((await kv.get('notes:_common')) || []) : [];
  return [...own, ...common.map((n) => ({ ...n, common: true }))];
}

// 백업
export async function exportAll() {
  const keys = await kv.keys();
  const data = {};
  for (const k of keys) if (typeof k === 'string' && /^(state|notes|chat):/.test(k)) data[k] = await kv.get(k);
  return { app: 'bigdata-tutor', version: 1, exported_at: new Date().toISOString(), data };
}

export async function importAll(backup, { overwrite }) {
  if (backup?.app !== 'bigdata-tutor' || !isObj(backup.data)) throw new Error('이 사이트의 백업 파일이 아닙니다.');
  let written = 0, skipped = 0;
  for (const [k, v] of Object.entries(backup.data)) {
    if (!/^(state|notes|chat):/.test(k)) continue;
    if (!overwrite && (await kv.get(k)) !== undefined) { skipped++; continue; }
    await kv.set(k, v);
    written++;
  }
  return { written, skipped };
}
