const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function isTruthyEnv(value?: string) {
  if (!value) return false;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

export const isAdminModeEnabled = isTruthyEnv(process.env.NEXT_PUBLIC_ADMIN_MODE);
export const isServerAdminModeEnabled =
  isTruthyEnv(process.env.ADMIN_MODE) || isTruthyEnv(process.env.NEXT_PUBLIC_ADMIN_MODE);
