/**
 * Reading a table out of an NFC tag's URL.
 *
 * The tags are written from the /qr screen as `<base>/menu?t=<table>`. Web NFC
 * writes to whatever tag is presented, so a batch-writing session can easily put
 * ONE table's URL onto several tags — which is exactly how every order started
 * arriving as «طاولة 7». Parsing this out is what lets the counter walk the floor
 * and find the mis-written tags.
 */

/** The table a tag's URL points at, or null when the URL carries no table. */
export function tableFromUrl(raw: string): string | null {
  const value = readParam(raw, "t");
  if (value == null) return null;
  const table = value.trim();
  return table === "" ? null : table;
}

/** True when the URL opens this café's menu at all (vs an unrelated tag). */
export function isMenuUrl(raw: string): boolean {
  const path = pathOf(raw);
  return path === "/menu" || path.startsWith("/menu/");
}

function pathOf(raw: string): string {
  try {
    return new URL(raw).pathname.replace(/\/+$/, "") || "/";
  } catch {
    // A relative or malformed value still tells us something useful.
    const noQuery = raw.split("?")[0].split("#")[0];
    return noQuery.startsWith("/") ? noQuery.replace(/\/+$/, "") || "/" : "";
  }
}

function readParam(raw: string, key: string): string | null {
  try {
    return new URL(raw).searchParams.get(key);
  } catch {
    const q = raw.indexOf("?");
    if (q === -1) return null;
    return new URLSearchParams(raw.slice(q + 1)).get(key);
  }
}
