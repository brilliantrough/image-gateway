export function getRequestId(headers: Record<string, unknown>): string {
  const value = headers["x-request-id"];
  return typeof value === "string" && value.length > 0 ? value : crypto.randomUUID();
}
