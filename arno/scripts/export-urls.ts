import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { writeFileSync } from "fs";

const BASE_URL = "https://www.auto1.com";
const STOCK = "VM79011";
const HEADERS: Record<string, string> = {
  accept: "application/json",
  "accept-language": "fr-FR,fr;q=0.9",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "x-requested-with": "XMLHttpRequest",
};

async function login() {
  const email = process.env.AUTO1_EMAIL ?? "";
  const password = process.env.AUTO1_PASSWORD ?? "";
  const homeRes = await fetch(`${BASE_URL}/fr/home`, { headers: { "user-agent": HEADERS["user-agent"]!, accept: "text/html" }, redirect: "manual" });
  const setCookies = homeRes.headers.getSetCookie?.() ?? [];
  const cookieJar: Record<string, string> = {};
  for (const sc of setCookies) { const pair = sc.split(";")[0]!; const eq = pair.indexOf("="); if (eq > 0) cookieJar[pair.slice(0, eq)] = pair.slice(eq + 1); }
  const xsrfToken = cookieJar["xsrf_token"] ?? "";
  const cookieString = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join("; ");
  const loginRes = await fetch(`${BASE_URL}/fr/merchant/signin/ajax`, {
    method: "POST", headers: { ...HEADERS, "content-type": "application/x-www-form-urlencoded;charset=UTF-8", origin: BASE_URL, referer: `${BASE_URL}/fr/home`, cookie: cookieString, "x-xsrf-token": xsrfToken },
    body: `user_signin%5Bemail%5D=${encodeURIComponent(email)}&user_signin%5Bpassword%5D=${encodeURIComponent(password)}`, redirect: "manual",
  });
  const loginCookies = loginRes.headers.getSetCookie?.() ?? [];
  for (const sc of loginCookies) { const pair = sc.split(";")[0]!; const eq = pair.indexOf("="); if (eq > 0) cookieJar[pair.slice(0, eq)] = pair.slice(eq + 1); }
  return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join("; ");
}

function fixUrl(url: string) { return url.startsWith("//") ? `https:${url}` : url; }

async function main() {
  const cookie = await login();
  const res = await fetch(`${BASE_URL}/fr/app/merchant/car/${STOCK}`, { headers: { ...HEADERS, cookie } });
  const raw = await res.json() as any;
  const resp = raw.response ?? raw;
  const gallery = resp.gallery ?? {};
  const quality = resp.quality ?? {};
  const details = resp.details ?? {};
  const photos: any[] = [];
  const seen = new Set<string>();
  for (const img of gallery.galleryImages ?? []) { const url = fixUrl(img.url ?? ""); if (url && !seen.has(url)) { seen.add(url); photos.push({ url, source: "gallery", label: "Galerie" }); } }
  for (const h of quality.highlightItems ?? []) { const url = fixUrl(h.fullUrl ?? h.photo ?? ""); if (url && !seen.has(url)) { seen.add(url); photos.push({ url, source: "highlight", label: `${h.partName ?? "?"} — ${h.description ?? "?"}` }); } }
  for (const d of quality.damageItems ?? []) { const url = fixUrl(d.fullUrl ?? d.photo ?? ""); if (url && !seen.has(url)) { seen.add(url); photos.push({ url, source: "damage", label: `${d.partName ?? "?"} — ${d.description ?? "?"}` }); } }
  writeFileSync("scripts/auto1-photos.json", JSON.stringify({ stock: STOCK, brand: details.manufacturer, model: details.mainType, photos }, null, 2));
  console.log(`Exported ${photos.length} photos`);
}
main().catch(console.error);
