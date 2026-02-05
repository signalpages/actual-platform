import { fetchWithTimeout, stripHtml } from "@/lib/stage2/http";

export async function fetchAndRender(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, 12_000);
    if (!res.ok) return null;

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return null;
    }

    const html = await res.text();
    const cleaned = stripHtml(html);

    // enforce some minimum so we don’t feed junk
    if (cleaned.length < 2_000) return null;

    // cap size to keep extraction cheap
    return cleaned.slice(0, 140_000);
  } catch {
    return null;
  }
}
