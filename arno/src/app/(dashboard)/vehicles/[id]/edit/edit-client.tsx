"use client";

import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { updateVehicleFromForm } from "@/lib/actions/vehicle-form";

interface EditVehicleClientProps {
  vehicleId: string;
  vehicle: {
    brand: string;
    model: string;
    sub_type: string | null;
    year: number;
    mileage: number;
    fuel_type: string;
    gearbox: string;
    color: string | null;
    vin: string | null;
    registration: string;
    purchase_price: number;
    target_sale_price: number | null;
    sale_price: number | null;
    status: "en_stock" | "en_preparation" | "en_vente" | "vendu";
    purchase_date: string;
    sale_date: string | null;
    purchase_notes: string | null;
  };
}

export function EditVehicleClient({ vehicleId, vehicle }: EditVehicleClientProps) {
  async function handleSubmit(formData: FormData) {
    return updateVehicleFromForm(vehicleId, formData);
  }

  return <VehicleForm vehicle={vehicle} onSubmit={handleSubmit} />;
}
