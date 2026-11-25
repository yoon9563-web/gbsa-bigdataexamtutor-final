// 아주 작은 IndexedDB 키-값 저장소. 학습 기록·대화·요약노트를 브라우저에 보관합니다.
const DB_NAME = 'bigdata-tutor';
const STORE = 'kv';
let dbPromise;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const kv = {
  get: (key) => run('readonly', (s) => s.get(key)),
  set: (key, value) => run('readwrite', (s) => s.put(value, key)),
  del: (key) => run('readwrite', (s) => s.delete(key)),
  keys: () => run('readonly', (s) => s.getAllKeys()),
};
