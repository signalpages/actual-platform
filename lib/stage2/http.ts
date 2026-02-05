export async function fetchWithTimeout(url: string, ms: number, init: RequestInit = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);

  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; Actual.fyi/1.0; +https://actual.fyi)",
        "accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(init.headers || {}),
      },
      redirect: "follow",
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export function stripHtml(html: string): string {
  // super cheap “render”: remove scripts/styles and compress whitespace
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractText(html: string, maxChars = 120_000): string {
  // naive text extraction (good enough for pilot)
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, maxChars);
}
