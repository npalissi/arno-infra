import type { Auto1Vehicle, Auto1Photo, Auto1Damage, Auto1Equipment } from "./types";

// ---------------------------------------------------------------------------
// Config & headers
// ---------------------------------------------------------------------------

const BASE_URL = "https://www.auto1.com";

const HEADERS: Record<string, string> = {
  accept: "application/json",
  "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  "x-requested-with": "XMLHttpRequest",
};

// Cookie cache en mémoire (partagé entre requêtes du même process)
let cachedCookie: string | null = null;

function getConfig() {
  return {
    userUuid: process.env.AUTO1_USER_UUID ?? "",
    email: process.env.AUTO1_EMAIL ?? "",
    password: process.env.AUTO1_PASSWORD ?? "",
  };
}

// ---------------------------------------------------------------------------
// Auth — login Auto1
// ---------------------------------------------------------------------------

async function login(): Promise<string> {
  const { email, password } = getConfig();
  if (!email || !password) throw new Error("AUTO1_EMAIL ou AUTO1_PASSWORD manquant dans .env.local");

  // Step 1: GET homepage pour récupérer les cookies de session
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
  const cookieString = Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  // Step 2: POST login
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

  const finalCookie = Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  cachedCookie = finalCookie;
  return finalCookie;
}

async function getCookie(): Promise<string> {
  if (cachedCookie) return cachedCookie;
  return login();
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiGet(path: string): Promise<unknown> {
  const cookie = await getCookie();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: { ...HEADERS, cookie },
  });

  // Si 401/403, re-login et retry
  if (res.status === 401 || res.status === 403) {
    const newCookie = await login();
    const retry = await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers: { ...HEADERS, cookie: newCookie },
    });
    if (!retry.ok) throw new Error(`Auto1 API ${retry.status}: ${await retry.text()}`);
    return retry.json();
  }

  if (!res.ok) throw new Error(`Auto1 API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Parser — response Auto1 → Auto1Vehicle
// ---------------------------------------------------------------------------

/** Parse un nombre qui peut contenir des espaces, ex: "113 116" → 113116 */
function parseNum(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/\s/g, "");
    const n = parseInt(cleaned, 10);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseAuto1Response(stockNumber: string, raw: any): Auto1Vehicle {
  const resp = raw.response ?? raw;
  const details = resp.details ?? {};
  const car = resp.car ?? {};
  const purchase = resp.purchase ?? {};
  const bidding = resp.bidding ?? {};
  const quality = resp.quality ?? {};
  const gallery = resp.gallery ?? {};
  const equipmentItems = resp.equipmentItems ?? [];
  const wheels = resp.wheels ?? {};
  const paint = resp.paint ?? {};
  const service = resp.service ?? {};

  // Damage items (extracted early — used for both photos and damage descriptions)
  const damageItems: any[] = quality.damageItems ?? [];

  // Photos — 3 sources: gallery, highlights, damages
  const galleryImages: any[] = gallery.galleryImages ?? [];
  const highlightItems: any[] = quality.highlightItems ?? [];
  const mainImage = gallery.mainImage;

  const normalizeUrl = (u: string | undefined | null): string => {
    if (!u) return "";
    return u.startsWith("//") ? `https:${u}` : u;
  };

  let position = 0;
  const photos: Auto1Photo[] = [];

  // 1. Gallery images (main photos)
  for (const img of galleryImages) {
    const url = normalizeUrl(img.url);
    if (url) photos.push({ url, position: position++ });
  }

  // 2. Highlight items (detail/condition photos)
  for (const item of highlightItems) {
    const url = normalizeUrl(item.fullUrl ?? item.photo ?? item.thumbnail);
    if (url) photos.push({ url, position: position++ });
  }

  // 3. Damage items (damage photos — also parsed below for descriptions)
  for (const item of damageItems) {
    const url = normalizeUrl(item.fullUrl ?? item.photo);
    if (url) photos.push({ url, position: position++ });
  }

  const mainPhotoUrl = mainImage?.url
    ? normalizeUrl(mainImage.url)
    : (photos[0]?.url ?? "");

  // Damages (damageItems extracted above for photos)
  const damages: Auto1Damage[] = damageItems.map((d: any) => ({
    location: d.partName ?? "Inconnu",
    description: d.description ?? "",
    photoUrl: d.photo ? (d.photo.startsWith("//") ? `https:${d.photo}` : d.photo) : undefined,
  }));

  // Equipment
  const equipments: Auto1Equipment[] = [];
  for (const group of equipmentItems) {
    for (const item of (group.items ?? [])) {
      equipments.push({ name: group.group ?? "", description: item.description ?? "" });
    }
  }

  // Wheels
  const primaryWheels = wheels.primaryWheels ?? {};
  const parseWheel = (w: any) => ({
    season: w?.wheelType ?? "?",
    dot: w?.dot ?? "?",
    depth: w?.profileDepth ? `${w.profileDepth}mm` : "?",
    rimType: w?.rimType ?? "?",
    brakeNote: w?.brakeCondition || undefined,
  });

  // Year
  const regDate = details.firstRegistrationDate;
  let year = details.builtYear ?? 0;
  let registrationDate = "";
  if (regDate) {
    const d = new Date(typeof regDate === "number" ? regDate : regDate);
    if (!isNaN(d.getTime())) {
      year = year || d.getFullYear();
      registrationDate = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    }
  }

  // Bidding
  const lastBid = bidding.lastBidStatus ?? {};
  const auctionEnd = bidding.auctionEndDate;

  // Seller notes
  const notes = [car.note, car.otherNotes]
    .filter(Boolean)
    .map((n: string) => n.replace(/<br\s*\/?>/g, " ").trim())
    .join(" | ");

  // Service fee
  const serviceFee = car.serviceFee ? Math.round(parseNum(car.serviceFee) / 100) : 0;
  const priceWithoutDiscount = parseNum(purchase.priceWithoutDiscount);

  return {
    stockNumber,
    brand: details.manufacturer ?? "?",
    model: details.mainType ?? details.modelDescription ?? "?",
    subType: details.subType ?? "",
    year,
    registrationDate,
    mileage: parseNum(details.km),
    fuelType: details.fuelType ?? "?",
    gearbox: details.gearType ?? "?",
    powerHp: parseNum(details.horsepower),
    powerKw: parseNum(details.kw),
    euroNorm: details.emissionStandard ?? "",
    bodyType: details.bodyType ?? "",
    color: details.outsideColour ?? "",
    upholstery: details.upholstery ?? "",
    doors: parseNum(details.doorCount),
    seats: parseNum(details.seats),
    keys: parseNum(details.handoverKeyCount),
    location: details.currentLocation ?? "",
    country: "FR",
    origin: details.countryOfOrigin ?? "",
    qualityScore: 0,
    condition: undefined,
    isAccident: details.carAttrAccidentBool === true,
    totalOwners: parseNum(details.carPreownerCount),
    hasCoc: !!details.hasCoc,
    price: { serviceFee, priceWithoutDiscount },
    auction: {
      status: lastBid.status ?? "",
      sold: !!lastBid.sold,
      endDate: auctionEnd ? new Date(auctionEnd * 1000).toISOString() : "",
    },
    sellerNotes: notes,
    equipments,
    damages,
    wheels: {
      frontLeft: parseWheel(primaryWheels.frontLeft),
      frontRight: parseWheel(primaryWheels.frontRight),
      backLeft: parseWheel(primaryWheels.backLeft),
      backRight: parseWheel(primaryWheels.backRight),
    },
    paint: paint ?? {},
    maintenance: {
      logBook: (service as any).serviceBook ?? "?",
      appointments: (service as any).serviceAppointments ?? "?",
    },
    testDrive: ((details.testDrive ?? []) as any[]).map((t: any) => t.translationKey ?? ""),
    photos,
    mainPhotoUrl,
    url: `https://www.auto1.com/fr/app/merchant/car/${stockNumber}`,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch les détails d'un véhicule Auto1 par stockNumber.
 * Appels HTTP directs à auto1.com avec auto-login.
 */
export async function fetchAuto1Vehicle(stockNumber: string): Promise<Auto1Vehicle> {
  const raw = await apiGet(`/fr/app/merchant/car/${stockNumber}`);
  return parseAuto1Response(stockNumber, raw);
}
