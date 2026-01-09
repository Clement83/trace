/**
 * Get the API base URL from environment variables.
 * In production with reverse proxy, uses VITE_API_URL (e.g., https://api.trace.quintard.me)
 * In development, returns empty string to use relative paths with Vite proxy
 */
function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL || "";
}

/**
 * Build full API URL by combining base URL with path
 */
export function getApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

export async function fetchJSON<T>(
  url: string,
  opts?: RequestInit,
): Promise<T> {
  const fullUrl = getApiUrl(url);
  const res = await fetch(fullUrl, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function postFormJSON<T>(url: string, form: FormData): Promise<T> {
  const fullUrl = getApiUrl(url);
  const res = await fetch(fullUrl, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}
