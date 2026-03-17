// Types pour les données retournées par le MCP Auto1 (get_car_details)

export interface Auto1Photo {
  url: string;
  position: number;
}

export interface Auto1Damage {
  location: string;
  description: string;
  photoUrl?: string;
}

export interface Auto1Wheel {
  season: string;
  dot: string;
  depth: string;
  rimType: string;
  brakeNote?: string;
}

export interface Auto1Wheels {
  frontLeft: Auto1Wheel;
  frontRight: Auto1Wheel;
  backLeft: Auto1Wheel;
  backRight: Auto1Wheel;
}

export interface Auto1Paint {
  [panel: string]: number; // valeurs en µm
}

export interface Auto1Price {
  serviceFee: number; // en euros
  priceWithoutDiscount: number; // en euros
}

export interface Auto1Auction {
  status: string;
  sold: boolean;
  endDate: string;
}

export interface Auto1Equipment {
  name: string;
  description: string;
}

export interface Auto1Maintenance {
  logBook: string;
  appointments: string;
}

export interface Auto1Vehicle {
  stockNumber: string;

  // Identification
  brand: string;
  model: string;
  subType: string;

  // Caractéristiques
  year: number;
  registrationDate: string; // MM/YYYY
  mileage: number;
  fuelType: string;
  gearbox: string;
  powerHp: number;
  powerKw: number;
  euroNorm: string;
  bodyType: string;
  color: string;
  upholstery: string;
  doors: number;
  seats: number;
  keys: number;

  // Localisation & origine
  location: string;
  country: string;
  origin: string;

  // État
  qualityScore: number;
  condition?: string;
  isAccident: boolean;
  totalOwners: number;
  hasCoc: boolean;

  // Prix & enchères
  price: Auto1Price;
  auction: Auto1Auction;

  // Détails
  sellerNotes: string;
  equipments: Auto1Equipment[];
  damages: Auto1Damage[];
  wheels: Auto1Wheels;
  paint: Auto1Paint;
  maintenance: Auto1Maintenance;
  testDrive: string[];

  // Médias
  photos: Auto1Photo[];
  mainPhotoUrl: string;

  // Lien
  url: string;
}
