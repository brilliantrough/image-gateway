export function createLogger(level: string) {
  return {
    level,
    info: console.log,
    error: console.error,
  };
}
