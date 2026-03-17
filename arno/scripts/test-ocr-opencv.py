"""
Test détection documents vs photos véhicule avec OpenCV + Tesseract
Utilise les photos Auto1 du véhicule VM79011

Usage: python3 scripts/test-ocr-opencv.py
"""

import cv2
import numpy as np
import pytesseract
import requests
import json
import time
import math
import os
from pathlib import Path

# --- Config ---
STOCK = "VM79011"

# Charger les URLs depuis le script Node (on va les récupérer via l'API Auto1)
# Pour simplifier, on récupère les URLs depuis un fichier JSON intermédiaire
# qu'on génère d'abord avec Node

def fetch_image(url: str) -> np.ndarray:
    """Télécharge une image et la convertit en array OpenCV"""
    resp = requests.get(url, timeout=10)
    arr = np.frombuffer(resp.content, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def detect_document_contour(img: np.ndarray) -> dict:
    """
    Détecte si l'image contient un document rectangulaire.
    Inspiré de OSS-DocumentScanner (Akylas).
    Retourne un score et des infos sur le contour détecté.
    """
    h, w = img.shape[:2]
    img_area = h * w

    # Redimensionner pour accélérer le traitement
    scale = 1.0
    if max(h, w) > 1000:
        scale = 1000.0 / max(h, w)
        img = cv2.resize(img, None, fx=scale, fy=scale)
        h, w = img.shape[:2]
        img_area = h * w

    best_score = 0
    best_contour = None
    best_max_cosine = 1.0

    # Tester sur plusieurs canaux + grayscale
    channels = list(cv2.split(img)) + [cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)]

    for ch in channels:
        # Méthode 1: Seuillage adaptatif
        for thresh_val in [30, 50, 80, 120, 160, 200]:
            _, binary = cv2.threshold(ch, thresh_val, 255, cv2.THRESH_BINARY)
            score, contour, max_cos = find_best_quad(binary, img_area)
            if score > best_score:
                best_score = score
                best_contour = contour
                best_max_cosine = max_cos

        # Méthode 2: Canny avec différents seuils
        blurred = cv2.GaussianBlur(ch, (5, 5), 0)
        for canny_thresh in [20, 40, 60, 80, 100]:
            edges = cv2.Canny(blurred, canny_thresh, canny_thresh * 2)
            # Dilater pour connecter les bords
            edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
            score, contour, max_cos = find_best_quad(edges, img_area)
            if score > best_score:
                best_score = score
                best_contour = contour
                best_max_cosine = max_cos

    # Score normalisé
    area_ratio = best_score / img_area if img_area > 0 else 0

    return {
        "has_rectangle": best_contour is not None,
        "area_ratio": area_ratio,
        "max_cosine": best_max_cosine,
        "score": best_score,
    }


def find_best_quad(binary: np.ndarray, img_area: int):
    """Trouve le meilleur quadrilatère dans une image binaire"""
    contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    best_score = 0
    best_contour = None
    best_max_cos = 1.0

    for cnt in contours:
        arc_len = cv2.arcLength(cnt, True)
        if arc_len < 100:
            continue

        area = cv2.contourArea(cnt)
        # Le contour doit faire entre 5% et 95% de l'image
        if area < img_area * 0.05 or area > img_area * 0.95:
            continue

        # Approximation polygonale
        epsilon = 0.02 * arc_len
        approx = cv2.approxPolyDP(cnt, epsilon, True)

        # On veut un quadrilatère convexe
        if len(approx) != 4:
            continue
        if not cv2.isContourConvex(approx):
            continue

        # Calculer les cosinus des angles
        max_cos = max_cosine_of_quad(approx)

        # Score = surface + bonus pour angles droits
        # max_cos proche de 0 = angles à 90°
        if max_cos < 0.5:  # angles entre ~60° et ~120°
            score = area + img_area * 0.3 * (1 - max_cos)
            if score > best_score:
                best_score = score
                best_contour = approx
                best_max_cos = max_cos

    return best_score, best_contour, best_max_cos


def max_cosine_of_quad(approx):
    """Calcule le cosinus maximal des angles d'un quadrilatère"""
    max_cos = 0
    pts = approx.reshape(4, 2)
    for i in range(4):
        p0 = pts[i]
        p1 = pts[(i + 1) % 4]
        p2 = pts[(i + 3) % 4]
        v1 = p1 - p0
        v2 = p2 - p0
        cos_val = abs(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-10))
        max_cos = max(max_cos, cos_val)
    return max_cos


def analyze_colors(img: np.ndarray) -> dict:
    """Analyse les statistiques de couleur"""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray))
    std_dev = float(np.std(gray))

    # % de pixels clairs (> 200)
    light_ratio = float(np.sum(gray > 200)) / gray.size

    # Variance couleur (moyenne des écarts-types par canal)
    channels = cv2.split(img)
    color_variance = float(np.mean([np.std(c) for c in channels]))

    return {
        "brightness": brightness,
        "std_dev": std_dev,
        "light_ratio": light_ratio,
        "color_variance": color_variance,
    }


def ocr_analyze(img: np.ndarray) -> dict:
    """OCR avec Tesseract"""
    # Prétraitement: grayscale + contraste
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # CLAHE pour améliorer le contraste local
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # Seuillage adaptatif
    thresh = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                     cv2.THRESH_BINARY, 11, 2)

    start = time.time()
    # OCR sur image prétraitée
    data = pytesseract.image_to_data(thresh, lang='fra', output_type=pytesseract.Output.DICT)
    ocr_time = time.time() - start

    # Filtrer les mots avec confidence > 30
    words = []
    confidences = []
    for i, conf in enumerate(data['conf']):
        try:
            c = int(conf)
        except:
            continue
        if c > 30 and data['text'][i].strip():
            words.append(data['text'][i].strip())
            confidences.append(c)

    text = " ".join(words)
    avg_conf = float(np.mean(confidences)) if confidences else 0

    # Mots-clés documents automobiles
    doc_keywords = [
        'carte', 'grise', 'certificat', 'immatriculation',
        'controle', 'technique', 'facture', 'republique',
        'prefecture', 'ministere', 'genre', 'puissance',
        'proprietaire', 'cession', 'titre', 'cerfa',
        'carrosserie', 'energie', 'cylindree', 'places',
        'vin', 'date', 'mise', 'circulation', 'national',
    ]
    text_lower = text.lower()
    found_keywords = [kw for kw in doc_keywords if kw in text_lower]

    return {
        "text": text[:300],
        "word_count": len(words),
        "avg_confidence": avg_conf,
        "ocr_time_ms": int(ocr_time * 1000),
        "doc_keywords_found": found_keywords,
    }


def classify(contour_info: dict, color_info: dict, ocr_info: dict) -> tuple[bool, str]:
    """Classification finale multi-critères"""
    reasons = []
    score = 0

    # 1. Mots-clés document (signal très fort)
    if len(ocr_info["doc_keywords_found"]) >= 3:
        score += 50
        reasons.append(f"Mots-clés: {', '.join(ocr_info['doc_keywords_found'][:5])}")
    elif len(ocr_info["doc_keywords_found"]) >= 1:
        score += 20
        reasons.append(f"Mots-clés: {', '.join(ocr_info['doc_keywords_found'])}")

    # 2. Beaucoup de texte lisible
    if ocr_info["word_count"] > 20 and ocr_info["avg_confidence"] > 50:
        score += 30
        reasons.append(f"Texte dense ({ocr_info['word_count']} mots, {ocr_info['avg_confidence']:.0f}% conf)")
    elif ocr_info["word_count"] > 10 and ocr_info["avg_confidence"] > 40:
        score += 15
        reasons.append(f"Texte modéré ({ocr_info['word_count']} mots)")

    # 3. Rectangle détecté couvrant une grande partie de l'image
    if contour_info["has_rectangle"] and contour_info["area_ratio"] > 0.3:
        score += 25
        reasons.append(f"Rectangle détecté ({contour_info['area_ratio']:.0%} de l'image)")
    elif contour_info["has_rectangle"] and contour_info["area_ratio"] > 0.15:
        score += 10
        reasons.append(f"Petit rectangle ({contour_info['area_ratio']:.0%})")

    # 4. Fond clair et uniforme
    if color_info["brightness"] > 150 and color_info["color_variance"] < 50:
        score += 20
        reasons.append(f"Fond document (lum:{color_info['brightness']:.0f}, var:{color_info['color_variance']:.0f})")
    elif color_info["brightness"] > 130 and color_info["color_variance"] < 60:
        score += 10
        reasons.append(f"Fond clair (lum:{color_info['brightness']:.0f})")

    # 5. Fort ratio de pixels clairs
    if color_info["light_ratio"] > 0.5:
        score += 10
        reasons.append(f"Pixels clairs: {color_info['light_ratio']:.0%}")

    is_document = score >= 30
    reason = " + ".join(reasons) if reasons else "Aucun signal document"

    return is_document, f"[score={score}] {reason}"


def main():
    # D'abord, générer le fichier d'URLs depuis Node
    urls_file = Path("scripts/auto1-photos.json")
    if not urls_file.exists():
        print("Génération des URLs via Node...")
        os.system(f'cd "{Path(__file__).parent.parent}" && npx tsx scripts/export-urls.ts')

    if not urls_file.exists():
        print("Erreur: impossible de récupérer les URLs. Création du script d'export...")
        # Créer le script d'export
        export_script = """
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { writeFileSync } from "fs";

const BASE_URL = "https://www.auto1.com";
const STOCK = "VM79011";
const HEADERS = {
  accept: "application/json",
  "accept-language": "fr-FR,fr;q=0.9",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "x-requested-with": "XMLHttpRequest",
};

async function login() {
  const email = process.env.AUTO1_EMAIL ?? "";
  const password = process.env.AUTO1_PASSWORD ?? "";
  const homeRes = await fetch(BASE_URL + "/fr/home", { headers: { "user-agent": HEADERS["user-agent"], accept: "text/html" }, redirect: "manual" });
  const setCookies = homeRes.headers.getSetCookie?.() ?? [];
  const cookieJar = {};
  for (const sc of setCookies) { const pair = sc.split(";")[0]; const eq = pair.indexOf("="); if (eq > 0) cookieJar[pair.slice(0, eq)] = pair.slice(eq + 1); }
  const xsrfToken = cookieJar["xsrf_token"] ?? "";
  const cookieString = Object.entries(cookieJar).map(([k, v]) => k + "=" + v).join("; ");
  const loginRes = await fetch(BASE_URL + "/fr/merchant/signin/ajax", {
    method: "POST", headers: { ...HEADERS, "content-type": "application/x-www-form-urlencoded;charset=UTF-8", origin: BASE_URL, referer: BASE_URL + "/fr/home", cookie: cookieString, "x-xsrf-token": xsrfToken },
    body: "user_signin%5Bemail%5D=" + encodeURIComponent(email) + "&user_signin%5Bpassword%5D=" + encodeURIComponent(password), redirect: "manual",
  });
  const loginCookies = loginRes.headers.getSetCookie?.() ?? [];
  for (const sc of loginCookies) { const pair = sc.split(";")[0]; const eq = pair.indexOf("="); if (eq > 0) cookieJar[pair.slice(0, eq)] = pair.slice(eq + 1); }
  return Object.entries(cookieJar).map(([k, v]) => k + "=" + v).join("; ");
}

function fixUrl(url) { return url.startsWith("//") ? "https:" + url : url; }

async function main() {
  const cookie = await login();
  const res = await fetch(BASE_URL + "/fr/app/merchant/car/" + STOCK, { headers: { ...HEADERS, cookie } });
  const raw = await res.json();
  const resp = raw.response ?? raw;
  const gallery = resp.gallery ?? {};
  const quality = resp.quality ?? {};
  const details = resp.details ?? {};
  const photos = [];
  const seen = new Set();
  for (const img of gallery.galleryImages ?? []) { const url = fixUrl(img.url ?? ""); if (url && !seen.has(url)) { seen.add(url); photos.push({ url, source: "gallery", label: "Galerie" }); } }
  for (const h of quality.highlightItems ?? []) { const url = fixUrl(h.fullUrl ?? h.photo ?? ""); if (url && !seen.has(url)) { seen.add(url); photos.push({ url, source: "highlight", label: (h.partName ?? "?") + " — " + (h.description ?? "?") }); } }
  for (const d of quality.damageItems ?? []) { const url = fixUrl(d.fullUrl ?? d.photo ?? ""); if (url && !seen.has(url)) { seen.add(url); photos.push({ url, source: "damage", label: (d.partName ?? "?") + " — " + (d.description ?? "?") }); } }
  writeFileSync("scripts/auto1-photos.json", JSON.stringify({ stock: STOCK, brand: details.manufacturer, model: details.mainType, photos }, null, 2));
  console.log("Exported " + photos.length + " photos");
}
main().catch(console.error);
"""
        Path("scripts/export-urls.ts").write_text(export_script)
        os.system(f'cd "{Path(__file__).parent.parent}" && npx tsx scripts/export-urls.ts')

    with open(urls_file) as f:
        data = json.load(f)

    photos = data["photos"]
    stock = data["stock"]
    brand = data.get("brand", "?")
    model = data.get("model", "?")

    print(f"\n{'='*80}")
    print(f"  OpenCV + Tesseract — {brand} {model} ({stock}) — {len(photos)} photos")
    print(f"{'='*80}\n")

    results = []

    for i, photo in enumerate(photos):
        url = photo["url"]
        source = photo["source"]
        label = photo["label"]
        short = url.split("/")[-1][:30]

        print(f"[{i+1}/{len(photos)}] {source:10} {short}...", end=" ", flush=True)

        start = time.time()
        img = fetch_image(url)
        fetch_time = int((time.time() - start) * 1000)

        if img is None:
            print("ERREUR: impossible de télécharger")
            continue

        # 1. Détection de contours rectangulaires
        t0 = time.time()
        contour_info = detect_document_contour(img)
        contour_time = int((time.time() - t0) * 1000)

        # 2. Analyse couleurs
        color_info = analyze_colors(img)

        # 3. OCR
        ocr_info = ocr_analyze(img)

        # 4. Classification
        is_doc, reason = classify(contour_info, color_info, ocr_info)

        total_time = fetch_time + contour_time + ocr_info["ocr_time_ms"]
        tag = "📄 DOC " if is_doc else "📷 PHOTO"

        print(f"{tag} | {total_time}ms | {reason}")

        results.append({
            "url": url,
            "source": source,
            "label": label,
            "is_document": is_doc,
            "reason": reason,
            "contour": contour_info,
            "color": color_info,
            "ocr": {
                "text": ocr_info["text"],
                "word_count": ocr_info["word_count"],
                "avg_confidence": ocr_info["avg_confidence"],
                "ocr_time_ms": ocr_info["ocr_time_ms"],
                "doc_keywords": ocr_info["doc_keywords_found"],
            },
            "timing": {
                "fetch_ms": fetch_time,
                "contour_ms": contour_time,
                "ocr_ms": ocr_info["ocr_time_ms"],
            }
        })

    # Stats
    docs = [r for r in results if r["is_document"]]
    photos_count = len(results) - len(docs)

    print(f"\n{'='*80}")
    print(f"  RÉSULTAT: {len(docs)} documents / {photos_count} photos véhicule")
    print(f"{'='*80}\n")

    # Générer HTML
    html = generate_html(stock, brand, model, results)
    out_path = "scripts/ocr-opencv.html"
    Path(out_path).write_text(html)
    print(f"✅ Visuel: {out_path}")
    os.system(f'open "{Path(__file__).parent / "ocr-opencv.html"}"')


def generate_html(stock, brand, model, results):
    docs = [r for r in results if r["is_document"]]
    photos = [r for r in results if not r["is_document"]]
    total_time = sum(r["timing"]["fetch_ms"] + r["timing"]["contour_ms"] + r["timing"]["ocr_ms"] for r in results)

    cards = ""
    for i, r in enumerate(results):
        cls = "document" if r["is_document"] else "photo"
        badge_cls = cls
        kw_html = ""
        if r["ocr"]["doc_keywords"]:
            kw_html = f'<div class="keywords">Mots-clés: {", ".join(r["ocr"]["doc_keywords"])}</div>'

        cards += f"""
    <div class="card {cls}">
      <img src="{r['url']}" alt="Photo {i+1}" loading="lazy" />
      <div class="card-body">
        <div class="badges">
          <span class="badge {badge_cls}">{"Document" if r["is_document"] else "Photo véhicule"}</span>
          <span class="badge {r['source']}">{r['source']}</span>
        </div>
        <div class="label">{r['label']}</div>
        <div class="reason">{r['reason']}</div>
        {kw_html}
        <div class="metrics">
          <div class="metric-group">
            <h4>OpenCV Contours</h4>
            <div class="metric-row"><span>Rectangle</span><span class="val {'high' if r['contour']['has_rectangle'] else 'low'}">{'✅' if r['contour']['has_rectangle'] else '❌'}</span></div>
            <div class="metric-row"><span>Surface</span><span class="val">{r['contour']['area_ratio']:.0%}</span></div>
            <div class="metric-row"><span>Max cosine</span><span class="val">{r['contour']['max_cosine']:.2f}</span></div>
            <div class="metric-row"><span>Temps</span><span class="val">{r['timing']['contour_ms']}ms</span></div>
          </div>
          <div class="metric-group">
            <h4>OCR Tesseract</h4>
            <div class="metric-row"><span>Mots</span><span class="val">{r['ocr']['word_count']}</span></div>
            <div class="metric-row"><span>Confidence</span><span class="val">{r['ocr']['avg_confidence']:.0f}%</span></div>
            <div class="metric-row"><span>Temps</span><span class="val">{r['timing']['ocr_ms']}ms</span></div>
          </div>
        </div>
        <div class="metrics">
          <div class="metric-group">
            <h4>Analyse Image</h4>
            <div class="metric-row"><span>Luminosité</span><span class="val">{r['color']['brightness']:.0f}</span></div>
            <div class="metric-row"><span>Variance</span><span class="val">{r['color']['color_variance']:.0f}</span></div>
            <div class="metric-row"><span>Pixels clairs</span><span class="val">{r['color']['light_ratio']:.0%}</span></div>
          </div>
          <div class="metric-group">
            <h4>Temps total</h4>
            <div class="metric-row"><span>Fetch</span><span class="val">{r['timing']['fetch_ms']}ms</span></div>
            <div class="metric-row"><span>Contour</span><span class="val">{r['timing']['contour_ms']}ms</span></div>
            <div class="metric-row"><span>OCR</span><span class="val">{r['timing']['ocr_ms']}ms</span></div>
          </div>
        </div>
        <div class="ocr-text">{r['ocr']['text'][:250] if r['ocr']['text'] else '—'}</div>
      </div>
    </div>"""

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenCV + OCR — {stock}</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }}
    h1 {{ font-size: 24px; margin-bottom: 8px; }}
    .subtitle {{ color: #94a3b8; margin-bottom: 24px; font-size: 14px; }}
    .stats {{ display: flex; gap: 12px; margin-bottom: 32px; flex-wrap: wrap; }}
    .stat {{ background: #1e293b; border-radius: 12px; padding: 14px 18px; min-width: 100px; }}
    .stat-value {{ font-size: 24px; font-weight: 700; }}
    .stat-label {{ font-size: 11px; color: #94a3b8; margin-top: 4px; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 16px; }}
    .card {{ background: #1e293b; border-radius: 12px; overflow: hidden; border: 3px solid transparent; }}
    .card.document {{ border-color: #f59e0b; }}
    .card.photo {{ border-color: #22c55e; }}
    .card img {{ width: 100%; height: 260px; object-fit: cover; }}
    .card-body {{ padding: 16px; }}
    .badges {{ display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }}
    .badge {{ display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }}
    .badge.document {{ background: #f59e0b20; color: #f59e0b; }}
    .badge.photo {{ background: #22c55e20; color: #22c55e; }}
    .badge.gallery {{ background: #3b82f620; color: #3b82f6; }}
    .badge.highlight {{ background: #a855f720; color: #a855f7; }}
    .badge.damage {{ background: #ef444420; color: #ef4444; }}
    .reason {{ font-size: 12px; color: #fbbf24; margin: 6px 0; font-style: italic; }}
    .keywords {{ font-size: 11px; color: #38bdf8; margin: 4px 0; }}
    .metrics {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }}
    .metric-group {{ background: #0f172a; border-radius: 8px; padding: 10px; }}
    .metric-group h4 {{ font-size: 11px; color: #64748b; margin-bottom: 6px; text-transform: uppercase; }}
    .metric-row {{ display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }}
    .metric-row .val {{ font-weight: 600; }}
    .metric-row .val.high {{ color: #22c55e; }}
    .metric-row .val.low {{ color: #ef4444; }}
    .label {{ font-size: 13px; color: #cbd5e1; }}
    .ocr-text {{ font-size: 11px; color: #64748b; background: #0f172a; padding: 8px 12px; border-radius: 8px; max-height: 80px; overflow-y: auto; margin-top: 8px; white-space: pre-wrap; word-break: break-all; font-family: monospace; }}
  </style>
</head>
<body>
  <h1>OpenCV + Tesseract — {stock}</h1>
  <p class="subtitle">{brand} {model} — {len(results)} photos | Python OpenCV contour detection + Tesseract OCR + analyse couleur</p>
  <div class="stats">
    <div class="stat"><div class="stat-value">{len(results)}</div><div class="stat-label">Photos</div></div>
    <div class="stat"><div class="stat-value" style="color:#22c55e">{len(photos)}</div><div class="stat-label">Photos véhicule</div></div>
    <div class="stat"><div class="stat-value" style="color:#f59e0b">{len(docs)}</div><div class="stat-label">Documents</div></div>
    <div class="stat"><div class="stat-value">{total_time // 1000}s</div><div class="stat-label">Temps total</div></div>
  </div>
  <div class="grid">{cards}</div>
</body>
</html>"""


if __name__ == "__main__":
    main()
