export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "X-Humain-Request": "1",
    ...(options.headers as Record<string, string>),
  };
  if (options.body && !(options.body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    ...options,
    headers,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message =
      data.error?.message ||
      (Array.isArray(data.detail)
        ? data.detail.map((e: any) => e.msg).join("; ")
        : data.detail) ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}
export const post = <T = any>(path: string, data: unknown = {}) =>
  api<T>(path, {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
export function parseSSE(block: string): { event: string; data: any } | null {
  const type = block
    .split("\n")
    .find((x) => x.startsWith("event:"))
    ?.slice(6)
    .trim();
  const data = block
    .split("\n")
    .filter((x) => x.startsWith("data:"))
    .map((x) => x.slice(5).trimStart())
    .join("\n");
  return type && data ? { event: type, data: JSON.parse(data) } : null;
}
