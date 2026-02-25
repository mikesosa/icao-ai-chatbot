export const DEMO_ONLY_MODE = true;

export function filterExamConfigs<T>(
  configs: Record<string, T>,
): Record<string, T> {
  if (!DEMO_ONLY_MODE) {
    return configs;
  }

  return Object.fromEntries(
    Object.entries(configs).filter(([id]) => id.endsWith('-demo')),
  );
}
