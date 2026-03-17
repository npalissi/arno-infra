/**
 * Test OCR avec différents paramètres pour mieux détecter les documents
 * Usage: npx tsx scripts/test-ocr-tuning.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import Tesseract from "tesseract.js";
import sharp from "sharp";
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

/** Analyse les stats de couleur d'une image avec sharp */
async function analyzeImage(buffer: Buffer) {
  const { dominant, channels } = await sharp(buffer).stats();
  const [r, g, b] = channels;

  // Luminosité moyenne (0-255)
  const brightness = (r!.mean + g!.mean + b!.mean) / 3;

  // Écart-type moyen des couleurs (variance) — documents = faible variance
  const colorVariance = (r!.stdev + g!.stdev + b!.stdev) / 3;

  // % de pixels "clairs" (> 200 sur 255) — approximé via les stats
  // Un document scanné a une forte luminosité et faible variance
  const isLight = brightness > 150;
  const isUniform = colorVariance < 50;

  return { brightness, colorVariance, dominant, isLight, isUniform };
}

interface PhotoResult {
  url: string;
  source: string;
  label: string;
  // OCR brut
  ocrText: string;
  ocrConfidence: number;
  ocrWords: number;
  ocrTime: number;
  // OCR prétraité (grayscale + contrast)
  ocrPreText: string;
  ocrPreConfidence: number;
  ocrPreWords: number;
  ocrPreTime: number;
  // Analyse image
  brightness: number;
  colorVariance: number;
  isLight: boolean;
  isUniform: boolean;
  // Verdict final
  isDocument: boolean;
  reason: string;
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

  for (const img of gallery.galleryImages ?? []) {
    const url = fixUrl(img.url ?? "");
    if (url && !seen.has(url)) { seen.add(url); allPhotos.push({ url, source: "gallery", label: "Galerie" }); }
  }
  for (const h of quality.highlightItems ?? []) {
    const url = fixUrl(h.fullUrl ?? h.photo ?? "");
    if (url && !seen.has(url)) { seen.add(url); allPhotos.push({ url, source: "highlight", label: `${h.partName ?? "?"} — ${h.description ?? "?"}` }); }
  }
  for (const d of quality.damageItems ?? []) {
    const url = fixUrl(d.fullUrl ?? d.photo ?? "");
    if (url && !seen.has(url)) { seen.add(url); allPhotos.push({ url, source: "damage", label: `${d.partName ?? "?"} — ${d.description ?? "?"}` }); }
  }

  console.log(`${details.manufacturer} ${details.mainType} (${STOCK}) — ${allPhotos.length} photos\n`);

  const results: PhotoResult[] = [];

  for (let i = 0; i < allPhotos.length; i++) {
    const p = allPhotos[i]!;
    process.stdout.write(`[${i + 1}/${allPhotos.length}] ${p.source.padEnd(10)} `);

    const imgRes = await fetch(p.url);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    // 1. Analyse couleur
    const imgStats = await analyzeImage(buffer);

    // 2. OCR brut
    const t1 = Date.now();
    const ocr1 = await Tesseract.recognize(buffer, "fra");
    const ocrTime = Date.now() - t1;
    const text1 = ocr1.data.text.trim();

    // 3. OCR avec prétraitement — grayscale + sharpen + higher contrast
    const preprocessed = await sharp(buffer)
      .greyscale()
      .normalize()        // étend le contraste sur toute la plage
      .sharpen()           // nettoie le texte
      .toBuffer();

    const t2 = Date.now();
    const ocr2 = await Tesseract.recognize(preprocessed, "fra");
    const ocrPreTime = Date.now() - t2;
    const text2 = ocr2.data.text.trim();

    // Prendre le meilleur résultat OCR
    const bestConf = Math.max(ocr1.data.confidence, ocr2.data.confidence);
    const bestText = ocr2.data.confidence > ocr1.data.confidence ? text2 : text1;
    const bestWords = bestText.split(/\s+/).filter(Boolean).length;

    // 4. Détection combinée
    // Mots-clés typiques de documents automobiles
    const docKeywords = /carte\s*grise|certificat|immatriculation|contr[ôo]le\s*technique|facture|r[ée]publique|pr[ée]fect|minist[èe]re|n[°o]\s*d|genre|type|marque|puissance|vin\b|date\s*de|propri[ée]taire|cession|titre|cerfa/i;
    const hasDocKeywords = docKeywords.test(bestText);

    // Heuristique multi-critères
    let isDocument = false;
    let reason = "";

    if (hasDocKeywords) {
      isDocument = true;
      reason = "Mots-clés document détectés";
    } else if (bestWords > 20 && bestConf > 40) {
      isDocument = true;
      reason = `Beaucoup de texte (${bestWords} mots, ${bestConf.toFixed(0)}% conf)`;
    } else if (bestWords > 10 && imgStats.isLight && imgStats.isUniform) {
      isDocument = true;
      reason = `Texte + fond clair uniforme (lum:${imgStats.brightness.toFixed(0)}, var:${imgStats.colorVariance.toFixed(0)})`;
    } else if (imgStats.isLight && imgStats.isUniform && bestWords > 5) {
      isDocument = true;
      reason = `Fond document (lum:${imgStats.brightness.toFixed(0)}, var:${imgStats.colorVariance.toFixed(0)}) + texte`;
    } else {
      reason = `Photo (${bestWords} mots, lum:${imgStats.brightness.toFixed(0)}, var:${imgStats.colorVariance.toFixed(0)})`;
    }

    results.push({
      ...p,
      ocrText: text1,
      ocrConfidence: ocr1.data.confidence,
      ocrWords: text1.split(/\s+/).filter(Boolean).length,
      ocrTime,
      ocrPreText: text2,
      ocrPreConfidence: ocr2.data.confidence,
      ocrPreWords: text2.split(/\s+/).filter(Boolean).length,
      ocrPreTime,
      brightness: imgStats.brightness,
      colorVariance: imgStats.colorVariance,
      isLight: imgStats.isLight,
      isUniform: imgStats.isUniform,
      isDocument,
      reason,
    });

    const tag = isDocument ? "📄 DOC " : "📷 PHOTO";
    console.log(`${tag} | brut: ${ocr1.data.confidence.toFixed(0)}%/${text1.split(/\s+/).filter(Boolean).length}w/${ocrTime}ms | pré: ${ocr2.data.confidence.toFixed(0)}%/${text2.split(/\s+/).filter(Boolean).length}w/${ocrPreTime}ms | lum:${imgStats.brightness.toFixed(0)} var:${imgStats.colorVariance.toFixed(0)} | ${reason}`);
  }

  // Générer HTML
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OCR Tuning — ${STOCK}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #94a3b8; margin-bottom: 24px; font-size: 14px; }
    .stats { display: flex; gap: 12px; margin-bottom: 32px; flex-wrap: wrap; }
    .stat { background: #1e293b; border-radius: 12px; padding: 14px 18px; min-width: 100px; }
    .stat-value { font-size: 24px; font-weight: 700; }
    .stat-label { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 16px; }
    .card { background: #1e293b; border-radius: 12px; overflow: hidden; border: 3px solid transparent; }
    .card.document { border-color: #f59e0b; }
    .card.photo { border-color: #22c55e; }
    .card img { width: 100%; height: 240px; object-fit: cover; }
    .card-body { padding: 16px; }
    .badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge.document { background: #f59e0b20; color: #f59e0b; }
    .badge.photo { background: #22c55e20; color: #22c55e; }
    .badge.gallery { background: #3b82f620; color: #3b82f6; }
    .badge.highlight { background: #a855f720; color: #a855f7; }
    .badge.damage { background: #ef444420; color: #ef4444; }
    .reason { font-size: 12px; color: #fbbf24; margin: 6px 0; font-style: italic; }
    .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }
    .metric-group { background: #0f172a; border-radius: 8px; padding: 10px; }
    .metric-group h4 { font-size: 11px; color: #64748b; margin-bottom: 6px; text-transform: uppercase; }
    .metric-row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
    .metric-row .val { font-weight: 600; }
    .metric-row .val.high { color: #22c55e; }
    .metric-row .val.medium { color: #f59e0b; }
    .metric-row .val.low { color: #ef4444; }
    .ocr-text { font-size: 11px; color: #64748b; background: #0f172a; padding: 8px 12px; border-radius: 8px; max-height: 80px; overflow-y: auto; margin-top: 8px; white-space: pre-wrap; word-break: break-all; font-family: monospace; }
    .label { font-size: 13px; color: #cbd5e1; }
    .compare { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
    .compare h5 { font-size: 10px; color: #64748b; margin-bottom: 4px; text-transform: uppercase; }
  </style>
</head>
<body>
  <h1>OCR Tuning — ${STOCK}</h1>
  <p class="subtitle">${details.manufacturer ?? "?"} ${details.mainType ?? "?"} — ${allPhotos.length} photos | OCR brut vs prétraité (grayscale+normalize+sharpen) | Analyse couleur sharp</p>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">${allPhotos.length}</div>
      <div class="stat-label">Photos</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color:#22c55e">${results.filter(r => !r.isDocument).length}</div>
      <div class="stat-label">Photos véhicule</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color:#f59e0b">${results.filter(r => r.isDocument).length}</div>
      <div class="stat-label">Documents</div>
    </div>
    <div class="stat">
      <div class="stat-value">${Math.round(results.reduce((s, r) => s + r.ocrTime + r.ocrPreTime, 0) / 1000)}s</div>
      <div class="stat-label">Temps total</div>
    </div>
  </div>

  <div class="grid">
    ${results.map((r, i) => {
      const confClass = (v: number) => v > 50 ? "high" : v > 30 ? "medium" : "low";
      return `
    <div class="card ${r.isDocument ? "document" : "photo"}">
      <img src="${r.url}" alt="Photo ${i + 1}" loading="lazy" />
      <div class="card-body">
        <div class="badges">
          <span class="badge ${r.isDocument ? "document" : "photo"}">${r.isDocument ? "Document" : "Photo véhicule"}</span>
          <span class="badge ${r.source}">${r.source}</span>
        </div>
        <div class="label">${r.label}</div>
        <div class="reason">${r.reason}</div>
        <div class="metrics">
          <div class="metric-group">
            <h4>OCR Brut</h4>
            <div class="metric-row"><span>Confidence</span><span class="val ${confClass(r.ocrConfidence)}">${r.ocrConfidence.toFixed(0)}%</span></div>
            <div class="metric-row"><span>Mots</span><span class="val">${r.ocrWords}</span></div>
            <div class="metric-row"><span>Temps</span><span class="val">${r.ocrTime}ms</span></div>
          </div>
          <div class="metric-group">
            <h4>OCR Prétraité</h4>
            <div class="metric-row"><span>Confidence</span><span class="val ${confClass(r.ocrPreConfidence)}">${r.ocrPreConfidence.toFixed(0)}%</span></div>
            <div class="metric-row"><span>Mots</span><span class="val">${r.ocrPreWords}</span></div>
            <div class="metric-row"><span>Temps</span><span class="val">${r.ocrPreTime}ms</span></div>
          </div>
        </div>
        <div class="metrics">
          <div class="metric-group">
            <h4>Analyse Image</h4>
            <div class="metric-row"><span>Luminosité</span><span class="val">${r.brightness.toFixed(0)}</span></div>
            <div class="metric-row"><span>Variance couleur</span><span class="val">${r.colorVariance.toFixed(0)}</span></div>
          </div>
          <div class="metric-group">
            <h4>Flags</h4>
            <div class="metric-row"><span>Fond clair</span><span class="val">${r.isLight ? "✅" : "❌"}</span></div>
            <div class="metric-row"><span>Uniforme</span><span class="val">${r.isUniform ? "✅" : "❌"}</span></div>
          </div>
        </div>
        <div class="compare">
          <div>
            <h5>Texte brut</h5>
            <div class="ocr-text">${(r.ocrText || "—").slice(0, 200).replace(/</g, "&lt;")}</div>
          </div>
          <div>
            <h5>Texte prétraité</h5>
            <div class="ocr-text">${(r.ocrPreText || "—").slice(0, 200).replace(/</g, "&lt;")}</div>
          </div>
        </div>
      </div>
    </div>`;
    }).join("")}
  </div>
</body>
</html>`;

  const outPath = "scripts/ocr-tuning.html";
  writeFileSync(outPath, html);
  console.log(`\n✅ Résultat: ${outPath}`);
}

main().catch(console.error);
