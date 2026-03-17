import type { Auto1Vehicle } from "./types";

/**
 * Mock de l'appel MCP get_car_details.
 * Retourne des données Auto1 fictives pour un stock_number donné.
 * À remplacer par le vrai appel MCP quand disponible.
 */
export async function fetchAuto1Vehicle(
  stockNumber: string
): Promise<Auto1Vehicle> {
  return {
    stockNumber,
    brand: "Audi",
    model: "TT",
    subType: "2.0 TDI quattro Roadster",
    year: 2011,
    registrationDate: "09/2011",
    mileage: 146610,
    fuelType: "Diesel",
    gearbox: "Manuelle",
    powerHp: 170,
    powerKw: 125,
    euroNorm: "EURO 5",
    bodyType: "Roadster",
    color: "Blanc",
    upholstery: "Cuir",
    doors: 2,
    seats: 2,
    keys: 2,
    location: "LE HAVRE",
    country: "FR",
    origin: "FR",
    qualityScore: 49,
    condition: undefined,
    isAccident: true,
    totalOwners: 3,
    hasCoc: false,
    price: {
      serviceFee: 998,
      priceWithoutDiscount: 10890,
    },
    auction: {
      status: "status.low",
      sold: false,
      endDate: "2026-03-12T17:04:40.000Z",
    },
    sellerNotes: "Essai routier effectué, pas de découvertes particulières.",
    equipments: [
      { name: "Phares au Xénon", description: "projecteurs au Xénon Plus" },
      { name: "Aide au stationnement", description: "aide au stationnement AR" },
      { name: "Climatisation", description: "Climatisation automatique" },
    ],
    damages: [
      {
        location: "Pare-chocs",
        description: "Carrosserie non alignée",
        photoUrl: "https://img-pa.auto1.com/example/damage1.jpg",
      },
      {
        location: "Siège conducteur",
        description: "Usé",
        photoUrl: "https://img-pa.auto1.com/example/damage2.jpg",
      },
    ],
    wheels: {
      frontLeft: { season: "Été", dot: "3325", depth: "6mm", rimType: "Alu série" },
      frontRight: { season: "Été", dot: "3325", depth: "6mm", rimType: "Alu série" },
      backLeft: { season: "Été", dot: "3325", depth: "6mm", rimType: "Alu série", brakeNote: "Freins récents" },
      backRight: { season: "Été", dot: "3325", depth: "6mm", rimType: "Alu série", brakeNote: "Freins récents" },
    },
    paint: {
      paintHood: 356,
      paintDoorPassenger: 262,
      paintDoorDriver: 261,
    },
    maintenance: {
      logBook: "Non disponible",
      appointments: "Quelques",
    },
    testDrive: ["STD.is.td.being.performed.yes", "STD.engine.ok.yes"],
    photos: [
      { url: "https://img-pa.auto1.com/example/photo1.jpg", position: 0 },
      { url: "https://img-pa.auto1.com/example/photo2.jpg", position: 1 },
      { url: "https://img-pa.auto1.com/example/photo3.jpg", position: 2 },
    ],
    mainPhotoUrl: "https://img-pa.auto1.com/example/photo1.jpg",
    url: `https://www.auto1.com/fr/app/merchant/car/${stockNumber}`,
  };
}
