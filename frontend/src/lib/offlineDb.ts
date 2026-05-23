/* ===========================================
   Project Cura – IndexedDB Offline Storage
   Raw IndexedDB API, no external libraries
   =========================================== */

const DB_NAME = "cura-offline-db";
const DB_VERSION = 1;
const SESSIONS_STORE = "sessions";
const TRANSCRIPTS_STORE = "transcripts";

interface SessionData {
  sessionId: string;
  patientId: string;
  isFinalized: boolean;
  createdAt: string;
  updatedAt: string;
  soapProgress?: Record<string, string>;
  [key: string]: unknown;
}

interface TranscriptChunkRecord {
  id?: number;
  sessionId: string;
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  timestamp: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open IndexedDB"));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Sessions store
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const sessionsStore = db.createObjectStore(SESSIONS_STORE, {
          keyPath: "sessionId",
        });
        sessionsStore.createIndex("patientId", "patientId", { unique: false });
        sessionsStore.createIndex("isFinalized", "isFinalized", {
          unique: false,
        });
      }

      // Transcripts store
      if (!db.objectStoreNames.contains(TRANSCRIPTS_STORE)) {
        const transcriptsStore = db.createObjectStore(TRANSCRIPTS_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        transcriptsStore.createIndex("sessionId", "sessionId", {
          unique: false,
        });
      }
    };
  });
}

export async function saveSession(
  sessionId: string,
  data: Partial<SessionData>
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, "readwrite");
    const store = tx.objectStore(SESSIONS_STORE);

    const getRequest = store.get(sessionId);
    getRequest.onsuccess = () => {
      const existing = getRequest.result || {};
      const updated: SessionData = {
        ...existing,
        ...data,
        sessionId,
        updatedAt: new Date().toISOString(),
        createdAt: existing.createdAt || new Date().toISOString(),
        isFinalized: data.isFinalized ?? existing.isFinalized ?? false,
        patientId: data.patientId ?? existing.patientId ?? "",
      };
      store.put(updated);
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("Failed to save session"));
    };
  });
}

export async function getSession(
  sessionId: string
): Promise<SessionData | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, "readonly");
    const store = tx.objectStore(SESSIONS_STORE);
    const request = store.get(sessionId);

    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(new Error("Failed to get session"));
    };
  });
}

export async function saveTranscriptChunk(
  sessionId: string,
  chunk: Omit<TranscriptChunkRecord, "id" | "sessionId" | "timestamp">
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRANSCRIPTS_STORE, "readwrite");
    const store = tx.objectStore(TRANSCRIPTS_STORE);

    const record: Omit<TranscriptChunkRecord, "id"> = {
      ...chunk,
      sessionId,
      timestamp: new Date().toISOString(),
    };

    store.add(record);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("Failed to save transcript chunk"));
    };
  });
}

export async function getTranscriptChunks(
  sessionId: string
): Promise<TranscriptChunkRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRANSCRIPTS_STORE, "readonly");
    const store = tx.objectStore(TRANSCRIPTS_STORE);
    const index = store.index("sessionId");
    const request = index.getAll(sessionId);

    request.onsuccess = () => {
      db.close();
      resolve(request.result || []);
    };
    request.onerror = () => {
      db.close();
      reject(new Error("Failed to get transcript chunks"));
    };
  });
}

export async function clearSession(sessionId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      [SESSIONS_STORE, TRANSCRIPTS_STORE],
      "readwrite"
    );

    // Delete session
    tx.objectStore(SESSIONS_STORE).delete(sessionId);

    // Delete related transcript chunks
    const transcriptStore = tx.objectStore(TRANSCRIPTS_STORE);
    const index = transcriptStore.index("sessionId");
    const cursorRequest = index.openCursor(sessionId);

    cursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
        .result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("Failed to clear session"));
    };
  });
}

export async function getUnfinishedSessions(): Promise<SessionData[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, "readonly");
    const store = tx.objectStore(SESSIONS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      db.close();
      const all: SessionData[] = request.result || [];
      resolve(all.filter((s) => !s.isFinalized));
    };
    request.onerror = () => {
      db.close();
      reject(new Error("Failed to get unfinished sessions"));
    };
  });
}
