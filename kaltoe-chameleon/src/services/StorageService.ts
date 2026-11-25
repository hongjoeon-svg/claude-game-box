/**
 * 저장소 추상화. 지금은 localStorage를 쓰고,
 * 나중에 Capacitor Preferences 등으로 바꿀 때 이 파일만 교체하면 됩니다.
 */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class LocalStorageAdapter implements KeyValueStorage {
  private memory = new Map<string, string>();

  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return this.memory.get(key) ?? null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // 사파리 개인정보 보호 모드 등에서 실패하면 메모리에만 보관
      this.memory.set(key, value);
    }
  }

  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      this.memory.delete(key);
    }
  }
}

export const storage: KeyValueStorage = new LocalStorageAdapter();
