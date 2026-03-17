/**
 * Dump la structure des highlightItems pour voir les métadonnées
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const BASE_URL = "https://www.auto1.com";
const STOCK = "VM79011";

const HEADERS: Record<string, string> = {
  accept: "application/json",
  "accept-language": "fr-FR,fr;q=0.9",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "x-requested-with": "XMLHttpRequest",
};

async function login(): Promise<string> {
  const email = process.env.AUTO1_EMAIL ?? "";
  const password = process.env.AUTO1_PASSWORD ?? "";
  const homeRes = await fetch(`${BASE_URL}/fr/home`, {
    headers: { "user-agent": HEADERS["user-agent"]!, accept: "text/html" },
    redirect: "manual",
  });
  const setCookies = homeRes.headers.getSetCookie?.() ?? [];
  const cookieJar: Record<string, string> = {};
  for (const sc of setCookies) {
    const pair = sc.split(";")[0]!;
    const eq = pair.indexOf("=");
    if (eq > 0) cookieJar[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  const xsrfToken = cookieJar["xsrf_token"] ?? "";
  const cookieString = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join("; ");
  const loginRes = await fetch(`${BASE_URL}/fr/merchant/signin/ajax`, {
    method: "POST",
    headers: {
      ...HEADERS,
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      origin: BASE_URL, referer: `${BASE_URL}/fr/home`,
      cookie: cookieString, "x-xsrf-token": xsrfToken,
    },
    body: `user_signin%5Bemail%5D=${encodeURIComponent(email)}&user_signin%5Bpassword%5D=${encodeURIComponent(password)}`,
    redirect: "manual",
  });
  const loginCookies = loginRes.headers.getSetCookie?.() ?? [];
  for (const sc of loginCookies) {
    const pair = sc.split(";")[0]!;
    const eq = pair.indexOf("=");
    if (eq > 0) cookieJar[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  const cookie = await login();
  const res = await fetch(`${BASE_URL}/fr/app/merchant/car/${STOCK}`, {
    headers: { ...HEADERS, cookie },
  });
  const raw = await res.json() as any;
  const resp = raw.response ?? raw;
  const quality = resp.quality ?? {};

  console.log("=== HIGHLIGHT ITEMS (structure complète) ===\n");
  const items = quality.highlightItems ?? [];
  for (let i = 0; i < items.length; i++) {
    console.log(`--- Highlight ${i} ---`);
    console.log(JSON.stringify(items[i], null, 2));
    console.log();
  }

  console.log("\n=== DAMAGE ITEMS (structure complète) ===\n");
  const damages = quality.damageItems ?? [];
  for (let i = 0; i < damages.length; i++) {
    console.log(`--- Damage ${i} ---`);
    console.log(JSON.stringify(damages[i], null, 2));
    console.log();
  }

  // Aussi checker datItems et inspectionReportPath
  console.log("\n=== DAT ITEMS ===");
  console.log(JSON.stringify(resp.datItems ?? "absent", null, 2).slice(0, 500));

  console.log("\n=== INSPECTION REPORT ===");
  console.log(quality.inspectionReportPath ?? "absent");
}

main().catch(console.error);
