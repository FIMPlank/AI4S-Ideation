/** localStorage that never throws: blocked or full storage just means nothing is remembered. */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function defaultStore(): KeyValueStore | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function readJson<T>(key: string, fallback: T, store: KeyValueStore | undefined = defaultStore()): T {
  try {
    const raw = store?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown, store: KeyValueStore | undefined = defaultStore()): boolean {
  try {
    store?.setItem(key, JSON.stringify(value))
    return store !== undefined
  } catch {
    return false
  }
}
