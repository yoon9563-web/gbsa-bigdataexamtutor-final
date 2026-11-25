// web/ 사이트를 파일 하나(dist/bigdata-tutor.html)로 묶습니다. 더블클릭으로 열어도 동작합니다.
// 사용법 (프로젝트 폴더에서):  npm install --no-save esbuild  →  node tools/build-single-html.mjs
// Python 실행용 Pyodide와 글꼴은 인터넷(CDN)에서 불러옵니다.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (p) => path.join(root, p);
const KNOWLEDGE = [
  'CLAUDE.md', 'README.md', 'tutor/workflow.md', 'tutor/curriculum.md', 'tutor/type1-index.md',
  'tutor/summary-notes.md', 'tutor/youtube-research.md', 'tutor/recent-exam-patterns.md',
  'learners/README.md', 'learners/state.template.json',
];

const LT = '<';
const SCRIPT = 'scr' + 'ipt';
const open = (tag, attrs = '') => `${LT}${tag}${attrs}>`;
const close = (tag) => `${LT}/${tag}>`;

const bundle = await build({ entryPoints: [r('web/js/app.js')], bundle: true, format: 'esm', minify: true, write: false, platform: 'browser' });
const appJs = bundle.outputFiles[0].text;
const workerSrc = await readFile(r('web/js/py-worker.js'), 'utf8');
const css = await readFile(r('web/css/style.css'), 'utf8');
const knowledge = {};
for (const p of KNOWLEDGE) knowledge[p] = await readFile(r(p), 'utf8');

// 닫는 script 태그나 HTML 주석 시작 문자열이 코드 안에 있어도 HTML 파싱이 끊기지 않게 처리
const safe = (s) => s
  .replace(new RegExp(LT + '/' + SCRIPT, 'gi'), LT + '\\/' + SCRIPT)
  .replace(new RegExp(LT + '!--', 'g'), LT + '\\!--');
const json = (v) => safe(JSON.stringify(v));

const cssLink = `${LT}link rel="stylesheet" href="css/style.css">`;
const appTag = `${open(SCRIPT, ' type="module" src="js/app.js"')}${close(SCRIPT)}`;

let html = await readFile(r('web/index.html'), 'utf8');
if (!html.includes(cssLink) || !html.includes(appTag)) throw new Error('index.html에서 바꿀 부분을 찾지 못했습니다');
html = html.replace(cssLink, () => `${open('style')}\n${css}\n${close('style')}`);
html = html.replace(appTag, () =>
  `${open(SCRIPT)}window.__BDT_KNOWLEDGE__ = ${json(knowledge)};\nwindow.__BDT_WORKER_SRC__ = ${json(workerSrc)};${close(SCRIPT)}\n` +
  `${open(SCRIPT, ' type="module"')}\n${safe(appJs)}\n${close(SCRIPT)}`);

await mkdir(r('dist'), { recursive: true });
await writeFile(r('dist/bigdata-tutor.html'), html);
console.log(`dist/bigdata-tutor.html (${(html.length / 1024).toFixed(0)} KB)`);
