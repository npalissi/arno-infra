import { redirect } from "next/navigation";
import { getVehicle } from "@/lib/actions/vehicles";
import { getVehicleListings } from "@/lib/actions/listings";
import { getSettings } from "@/lib/actions/settings";
import { VehicleDetailClient } from "./detail-client";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [vehicleResult, listingsResult, settings] = await Promise.all([
    getVehicle(id),
    getVehicleListings(id),
    getSettings(),
  ]);

  if (vehicleResult.error || !vehicleResult.data) {
    redirect("/vehicles");
  }

  const vehicle = vehicleResult.data;
  const listings = listingsResult.data ?? [];

  return (
    <VehicleDetailClient
      vehicle={vehicle}
      expenses={vehicle.expenses}
      documents={vehicle.documents}
      history={vehicle.history}
      listings={listings}
      expenseCategories={settings.expense_categories}
      documentTypes={settings.document_types}
    />
  );
}
