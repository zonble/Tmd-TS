export interface SavedScore {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = "TmdStudioDB";
const DB_VERSION = 1;
const STORE_NAME = "scores";
const ACTIVE_KEY = "tmd-active-score-id";

export function extractTmdTitle(content: string): string {
  if (!content) return "未命名樂譜";
  const match = content.match(/\*\*\s*([^\*\n]+?)\s*\*\*/);
  if (match && match[1].trim()) {
    return match[1].trim();
  }
  return "未命名樂譜";
}

export class TmdStorage {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  public static getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        return reject(new Error("IndexedDB is not supported in this environment"));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  public static async listScores(): Promise<SavedScore[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = (req.result || []) as SavedScore[];
        // Sort descending by updatedAt
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public static async getScore(id: string): Promise<SavedScore | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  public static async saveScore(input: {
    id?: string;
    title?: string;
    content: string;
  }): Promise<SavedScore> {
    const db = await this.getDb();
    const id = input.id || "score-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);
    const title = input.title || extractTmdTitle(input.content);
    const now = Date.now();

    const existing = await this.getScore(id);
    const score: SavedScore = {
      id,
      title,
      content: input.content,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(score);

      req.onsuccess = () => resolve(score);
      req.onerror = () => reject(req.error);
    });
  }

  public static async deleteScore(id: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => {
        if (this.getActiveScoreId() === id) {
          this.setActiveScoreId(null);
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  public static async duplicateScore(sourceId: string, newTitle?: string): Promise<SavedScore> {
    const source = await this.getScore(sourceId);
    if (!source) {
      throw new Error(`Score not found: ${sourceId}`);
    }

    const title = newTitle || `${source.title} (副本)`;
    // Replace ** Title ** in content
    let newContent = source.content;
    if (newContent.includes("**")) {
      newContent = newContent.replace(/\*\*\s*([^\*\n]+?)\s*\*\*/, `** ${title} **`);
    }

    return this.saveScore({
      title,
      content: newContent,
    });
  }

  public static async clearAll(): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private static memoryStorage: Map<string, string> = new Map();

  public static getActiveScoreId(): string | null {
    try {
      if (typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
        const val = localStorage.getItem(ACTIVE_KEY);
        if (val !== undefined) return val;
      }
    } catch {}
    return this.memoryStorage.get(ACTIVE_KEY) || null;
  }

  public static setActiveScoreId(id: string | null): void {
    try {
      if (typeof localStorage !== "undefined" && typeof localStorage.setItem === "function") {
        if (id) {
          localStorage.setItem(ACTIVE_KEY, id);
        } else {
          localStorage.removeItem(ACTIVE_KEY);
        }
      }
    } catch {}
    if (id) {
      this.memoryStorage.set(ACTIVE_KEY, id);
    } else {
      this.memoryStorage.delete(ACTIVE_KEY);
    }
  }
}
