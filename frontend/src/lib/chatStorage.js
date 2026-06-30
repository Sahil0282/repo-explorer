// Local chat persistence (LocalStorage only — no backend, no auth, no sync).
//
// One key holds the current session so refreshing /chat restores the exact
// conversation, the analyzed repo + metadata, each answer's execution flow,
// citation metadata (carried on the messages), and the File Viewer state.
//
// Execution flows and citations are NOT stored separately — they already live
// on each message object, so persisting `messages` keeps them without
// duplicating data.

const STORAGE_KEY = "repoExplorer:session";
const SCHEMA_VERSION = 1;

/**
 * Read the persisted session. Returns null when absent, corrupted, or from an
 * incompatible schema version — clearing invalid data so the app never crashes.
 */
export function loadSession() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage unavailable (private mode, disabled, etc.)
  }
  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    const valid =
      data &&
      data.version === SCHEMA_VERSION &&
      data.repository &&
      typeof data.repository.repoName === "string" &&
      Array.isArray(data.messages);

    if (!valid) {
      clearSession();
      return null;
    }
    return data;
  } catch {
    // Corrupted JSON — remove only this entry and continue as a fresh start.
    clearSession();
    return null;
  }
}

/**
 * Persist the current session. Failures (quota, serialization) are swallowed —
 * persistence is best-effort and must never break the running app.
 */
export function saveSession({ repository, messages, viewerState }) {
  try {
    const payload = JSON.stringify({
      version: SCHEMA_VERSION,
      repository,
      messages,
      viewerState,
      timestamp: Date.now(),
    });
    localStorage.setItem(STORAGE_KEY, payload);
  } catch {
    // ignore — e.g. QuotaExceededError or circular data
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
