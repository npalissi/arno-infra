/**
 * Dump la réponse brute Auto1 pour voir toutes les sources de photos
 * Usage: npx tsx scripts/dump-auto1-raw.ts
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
      origin: BASE_URL,
      referer: `${BASE_URL}/fr/home`,
      cookie: cookieString,
      "x-xsrf-token": xsrfToken,
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

  // Lister toutes les clés top-level
  console.log("=== CLÉS TOP-LEVEL ===");
  console.log(Object.keys(resp).join(", "));

  // Chercher toutes les URLs d'images dans la réponse
  console.log("\n=== GALLERY ===");
  const gallery = resp.gallery ?? {};
  console.log("Clés:", Object.keys(gallery).join(", "));
  console.log("galleryImages count:", (gallery.galleryImages ?? []).length);
  console.log("mainImage:", gallery.mainImage?.url ? "oui" : "non");

  console.log("\n=== QUALITY ===");
  const quality = resp.quality ?? {};
  console.log("Clés:", Object.keys(quality).join(", "));
  const damageItems = quality.damageItems ?? [];
  console.log("damageItems count:", damageItems.length);
  for (const d of damageItems) {
    if (d.photo) console.log(`  Damage photo: ${d.photo}`);
    if (d.photos) console.log(`  Damage photos:`, d.photos);
  }

  console.log("\n=== HIGHLIGHT ITEMS ===");
  const highlights = resp.highlightItems ?? resp.highlights ?? [];
  console.log("Type:", typeof highlights, Array.isArray(highlights) ? `(array, ${highlights.length})` : "");
  if (Array.isArray(highlights)) {
    for (const h of highlights) {
      console.log("  Item:", JSON.stringify(h).slice(0, 200));
    }
  } else if (typeof highlights === "object") {
    console.log(JSON.stringify(highlights, null, 2).slice(0, 1000));
  }

  // Chercher récursivement toutes les clés contenant "photo", "image", "img", "url"
  console.log("\n=== TOUTES LES URLS D'IMAGES TROUVÉES ===");
  const imageUrls: { path: string; url: string }[] = [];

  function findImages(obj: any, path: string) {
    if (!obj || typeof obj !== "object") return;
    for (const [key, val] of Object.entries(obj)) {
      const currentPath = `${path}.${key}`;
      if (typeof val === "string" && (val.includes("auto1.com") || val.startsWith("//"))) {
        if (val.match(/\.(jpg|jpeg|png|webp)/i) || val.includes("/img")) {
          imageUrls.push({ path: currentPath, url: val });
        }
      } else if (typeof val === "object") {
        findImages(val, currentPath);
      }
    }
  }

  findImages(resp, "resp");

  // Dédupliquer par URL
  const seen = new Set<string>();
  for (const { path, url } of imageUrls) {
    if (!seen.has(url)) {
      seen.add(url);
      console.log(`  ${path}`);
      console.log(`    → ${url.slice(0, 120)}`);
    }
  }
  console.log(`\nTotal URLs uniques: ${seen.size}`);
}

main().catch(console.error);
