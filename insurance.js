/* MedBuddy — insurance document storage.
   Documents (card photos, policy PDFs) are stored as Blobs in IndexedDB,
   not localStorage — photos are too big for localStorage's ~5MB quota.
   Uploading a document under a name that already exists replaces it:
   only the latest version of each named document is ever kept. */

const DB_NAME = 'medbuddy-insurance';
const DB_VERSION = 1;
const STORE = 'documents';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function putDocument(doc) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(doc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteDocument(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllDocuments() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.addedAt - a.addedAt));
    req.onerror = () => reject(req.error);
  });
}

/* Delete every existing document with this name, then store the new one —
   this is the "replace on renewal" behavior. */
async function replaceDocument(name, mimeType, blob) {
  const existing = await getAllDocuments();
  for (const doc of existing) {
    if (doc.name === name) await deleteDocument(doc.id);
  }
  const id = 'doc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const record = { id, name, mimeType, blob, addedAt: Date.now() };
  await putDocument(record);
  return record;
}

window.InsuranceStore = {
  getAllDocuments,
  deleteDocument,
  replaceDocument,
};
