import type { Auto1Vehicle } from "./types";
import type { VehicleInsert, VehiclePhotoInsert } from "@/types/database";

export interface MapResult {
  vehicle: VehicleInsert;
  photos: Omit<VehiclePhotoInsert, "vehicle_id">[];
}

/**
 * Convertit les données Auto1 vers le schéma Arno (vehicles + vehicle_photos).
 * Le prix Auto1 (priceWithoutDiscount) devient le purchase_price en centimes.
 * registration est vide — à remplir manuellement par l'utilisateur.
 * photos retournées sans vehicle_id (ajouté après insert du véhicule).
 */
export function mapAuto1ToVehicle(auto1: Auto1Vehicle): MapResult {
  const damages = auto1.damages
    .map((d) => `${d.location}: ${d.description}`)
    .join("\n");

  const vehicle: VehicleInsert = {
    stock_number: auto1.stockNumber,
    registration: "",
    vin: null,
    brand: auto1.brand,
    model: auto1.model,
    sub_type: auto1.subType || null,
    year: auto1.year,
    fuel_type: auto1.fuelType,
    gearbox: auto1.gearbox,
    mileage: auto1.mileage,
    power_hp: auto1.powerHp || null,
    color: auto1.color || null,
    doors: auto1.doors || null,
    seats: auto1.seats || null,
    body_type: auto1.bodyType || null,
    euro_norm: auto1.euroNorm || null,
    total_owners: auto1.totalOwners || null,
    status: "en_stock",
    condition: auto1.condition || null,
    is_accident: auto1.isAccident,
    damages: damages || null,
    ct_status: null,
    ct_date: null,
    purchase_price: auto1.price.priceWithoutDiscount * 100, // euros → centimes
    purchase_date: new Date().toISOString().split("T")[0],
    purchase_source: "auto1",
    seller_name: null,
    purchase_notes: auto1.sellerNotes || null,
    target_sale_price: null,
    sale_price: null,
    sale_date: null,
    buyer_name: null,
    sale_notes: null,
    created_by: null,
  };

  const photos: MapResult["photos"] = auto1.photos.map((photo, index) => ({
    url: photo.url,
    position: photo.position ?? index,
    is_primary: photo.url === auto1.mainPhotoUrl,
    imported_from_auto1: true,
  }));

  return { vehicle, photos };
}
