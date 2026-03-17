/**
 * Test OCR visuel — génère une page HTML avec toutes les photos Auto1
 * et le résultat Tesseract.js pour chacune.
 * Usage: npx tsx scripts/test-ocr-visual.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import Tesseract from "tesseract.js";
import { writeFileSync } from "fs";

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

function fixUrl(url: string): string {
  return url.startsWith("//") ? `https:${url}` : url;
}

interface PhotoEntry {
  url: string;
  source: string;
  label: string;
  ocrText: string;
  ocrConfidence: number;
  ocrWords: number;
  ocrTime: number;
  isDocument: boolean;
}

async function main() {
  const cookie = await login();
  const res = await fetch(`${BASE_URL}/fr/app/merchant/car/${STOCK}`, {
    headers: { ...HEADERS, cookie },
  });
  const raw = (await res.json()) as any;
  const resp = raw.response ?? raw;

  const details = resp.details ?? {};
  const gallery = resp.gallery ?? {};
  const quality = resp.quality ?? {};

  // Collecter toutes les photos
  const allPhotos: { url: string; source: string; label: string }[] = [];
  const seen = new Set<string>();

  // 1. Gallery
  for (const img of gallery.galleryImages ?? []) {
    const url = fixUrl(img.url ?? "");
    if (url && !seen.has(url)) {
      seen.add(url);
      allPhotos.push({ url, source: "gallery", label: `Galerie` });
    }
  }

  // 2. Highlight items
  for (const h of quality.highlightItems ?? []) {
    const url = fixUrl(h.fullUrl ?? h.photo ?? "");
    if (url && !seen.has(url)) {
      seen.add(url);
      allPhotos.push({ url, source: "highlight", label: `${h.partName ?? "?"} — ${h.description ?? "?"}` });
    }
  }

  // 3. Damage items
  for (const d of quality.damageItems ?? []) {
    const url = fixUrl(d.fullUrl ?? d.photo ?? "");
    if (url && !seen.has(url)) {
      seen.add(url);
      allPhotos.push({ url, source: "damage", label: `${d.partName ?? "?"} — ${d.description ?? "?"}` });
    }
  }

  console.log(`${details.manufacturer} ${details.mainType} (${STOCK}) — ${allPhotos.length} photos uniques trouvées`);
  console.log(`  Gallery: ${allPhotos.filter(p => p.source === "gallery").length}`);
  console.log(`  Highlights: ${allPhotos.filter(p => p.source === "highlight").length}`);
  console.log(`  Damages: ${allPhotos.filter(p => p.source === "damage").length}`);
  console.log(`\nLancement OCR...\n`);

  // OCR sur chaque photo
  const results: PhotoEntry[] = [];

  for (let i = 0; i < allPhotos.length; i++) {
    const p = allPhotos[i]!;
    process.stdout.write(`  [${i + 1}/${allPhotos.length}] ${p.source} — `);

    const imgRes = await fetch(p.url);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const start = Date.now();
    const ocrResult = await Tesseract.recognize(buffer, "fra");
    const ocrTime = Date.now() - start;

    const text = ocrResult.data.text.trim();
    const confidence = ocrResult.data.confidence;
    const words = text.split(/\s+/).filter(Boolean).length;
    const isDocument = words > 15 && confidence > 50;

    results.push({
      ...p,
      ocrText: text,
      ocrConfidence: confidence,
      ocrWords: words,
      ocrTime,
      isDocument,
    });

    console.log(`${ocrTime}ms | ${confidence.toFixed(0)}% conf | ${words} mots | ${isDocument ? "DOCUMENT" : "PHOTO"}`);
  }

  // Générer HTML
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OCR Test — ${STOCK}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #94a3b8; margin-bottom: 24px; font-size: 14px; }
    .stats { display: flex; gap: 16px; margin-bottom: 32px; }
    .stat { background: #1e293b; border-radius: 12px; padding: 16px 20px; }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-label { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 16px; }
    .card { background: #1e293b; border-radius: 12px; overflow: hidden; border: 2px solid transparent; }
    .card.document { border-color: #f59e0b; }
    .card.photo { border-color: #22c55e; }
    .card img { width: 100%; height: 220px; object-fit: cover; }
    .card-body { padding: 16px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; }
    .badge.document { background: #f59e0b20; color: #f59e0b; }
    .badge.photo { background: #22c55e20; color: #22c55e; }
    .badge.gallery { background: #3b82f620; color: #3b82f6; }
    .badge.highlight { background: #a855f720; color: #a855f7; }
    .badge.damage { background: #ef444420; color: #ef4444; }
    .meta { display: flex; gap: 12px; font-size: 12px; color: #94a3b8; margin: 8px 0; }
    .meta span { display: flex; align-items: center; gap: 4px; }
    .ocr-text { font-size: 11px; color: #64748b; background: #0f172a; padding: 8px 12px; border-radius: 8px; max-height: 80px; overflow-y: auto; margin-top: 8px; white-space: pre-wrap; word-break: break-all; }
    .label { font-size: 13px; color: #cbd5e1; }
  </style>
</head>
<body>
  <h1>OCR Test — ${STOCK}</h1>
  <p class="subtitle">${details.manufacturer ?? "?"} ${details.mainType ?? "?"} ${details.builtYear ?? ""} — ${allPhotos.length} photos analysées</p>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">${allPhotos.length}</div>
      <div class="stat-label">Photos total</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: #22c55e">${results.filter(r => !r.isDocument).length}</div>
      <div class="stat-label">Photos véhicule</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: #f59e0b">${results.filter(r => r.isDocument).length}</div>
      <div class="stat-label">Documents détectés</div>
    </div>
    <div class="stat">
      <div class="stat-value">${Math.round(results.reduce((s, r) => s + r.ocrTime, 0) / 1000)}s</div>
      <div class="stat-label">Temps total OCR</div>
    </div>
  </div>

  <div class="grid">
    ${results.map((r, i) => `
    <div class="card ${r.isDocument ? "document" : "photo"}">
      <img src="${r.url}" alt="Photo ${i + 1}" loading="lazy" />
      <div class="card-body">
        <span class="badge ${r.isDocument ? "document" : "photo"}">${r.isDocument ? "Document" : "Photo véhicule"}</span>
        <span class="badge ${r.source}">${r.source}</span>
        <div class="label">${r.label}</div>
        <div class="meta">
          <span>Confidence: <b>${r.ocrConfidence.toFixed(0)}%</b></span>
          <span>Mots: <b>${r.ocrWords}</b></span>
          <span>OCR: <b>${r.ocrTime}ms</b></span>
        </div>
        ${r.ocrText ? `<div class="ocr-text">${r.ocrText.slice(0, 300).replace(/</g, "&lt;")}</div>` : '<div class="ocr-text" style="color:#475569">Aucun texte détecté</div>'}
      </div>
    </div>
    `).join("")}
  </div>
</body>
</html>`;

  const outPath = "scripts/ocr-results.html";
  writeFileSync(outPath, html);
  console.log(`\n✅ Résultat visuel généré: ${outPath}`);
  console.log(`Ouvre avec: open ${outPath}`);
}

main().catch(console.error);
