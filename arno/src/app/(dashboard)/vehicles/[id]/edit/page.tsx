import { redirect } from "next/navigation";
import { getVehicle } from "@/lib/actions/vehicles";
import { updateVehicleFromForm } from "@/lib/actions/vehicle-form";
import { EditVehicleClient } from "./edit-client";

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const result = await getVehicle(id);
  if (result.error || !result.data) {
    redirect("/vehicles");
  }

  const vehicle = result.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold">
        Modifier — {vehicle.brand} {vehicle.model}
      </h2>
      <EditVehicleClient vehicleId={id} vehicle={vehicle} />
    </div>
  );
}
