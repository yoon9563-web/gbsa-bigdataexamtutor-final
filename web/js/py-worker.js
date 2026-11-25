// Web Worker: Pyodide(브라우저용 Python)를 메인 화면과 분리해서 실행합니다.
// 'learner'(학습자 편집기)와 'tutor'(튜터의 비공개 계산) 네임스페이스를 따로 둡니다.
let pyodide = null;
let loading = null;
const namespaces = new Map();

async function ensure(indexURL) {
  if (pyodide) return pyodide;
  loading ??= (async () => {
    const { loadPyodide } = await import(`${indexURL}pyodide.mjs`);
    const py = await loadPyodide({ indexURL });
    await py.loadPackage(['numpy', 'pandas']);
    pyodide = py;
    return py;
  })().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

function ns(name) {
  if (!namespaces.has(name)) {
    const d = pyodide.globals.get('dict')();
    d.set('__name__', '__main__');
    namespaces.set(name, d);
  }
  return namespaces.get(name);
}

async function run(code, nsName) {
  const out = [];
  pyodide.setStdout({ batched: (s) => out.push({ stream: 'stdout', text: s }) });
  pyodide.setStderr({ batched: (s) => out.push({ stream: 'stderr', text: s }) });
  let value = null;
  let error = null;
  try {
    await pyodide.loadPackagesFromImports(code, { messageCallback: () => {}, errorCallback: () => {} });
    const r = await pyodide.runPythonAsync(code, { globals: ns(nsName) });
    if (r !== undefined && r !== null) {
      value = typeof r === 'object' && r.toString ? r.toString() : String(r);
      if (r && typeof r.destroy === 'function') r.destroy();
    }
  } catch (err) {
    error = String(err?.message || err);
  }
  return { out, value, error };
}

self.onmessage = async (e) => {
  const { id, op, indexURL } = e.data;
  try {
    await ensure(indexURL);
    if (op === 'init') {
      self.postMessage({ id, ok: true });
    } else if (op === 'run') {
      const res = await run(e.data.code, e.data.ns || 'learner');
      self.postMessage({ id, ok: true, ...res });
    } else if (op === 'writeFile') {
      pyodide.FS.writeFile(`/home/pyodide/${e.data.name}`, new Uint8Array(e.data.bytes));
      self.postMessage({ id, ok: true });
    } else if (op === 'reset') {
      const d = namespaces.get(e.data.ns);
      if (d) { d.destroy(); namespaces.delete(e.data.ns); }
      self.postMessage({ id, ok: true });
    } else {
      self.postMessage({ id, ok: false, error: `unknown op ${op}` });
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};
