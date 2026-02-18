export type AdminLogEntry = {
  timestamp: string;
  scope: string;
  message: string;
  data?: unknown;
};

const STORAGE_KEY = "brickify.admin.logs";
const MAX_LOGS = 300;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getAdminLogs(): AdminLogEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AdminLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearAdminLogs() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function pushAdminLog(scope: string, message: string, data?: unknown) {
  if (!canUseStorage()) return;

  const logs = getAdminLogs();
  logs.push({
    timestamp: new Date().toISOString(),
    scope,
    message,
    data,
  });

  if (logs.length > MAX_LOGS) {
    logs.splice(0, logs.length - MAX_LOGS);
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}
