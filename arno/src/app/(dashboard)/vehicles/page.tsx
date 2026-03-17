import { getVehicles } from "@/lib/actions/vehicles";
import { VehiclesClient } from "./vehicles-client";

export default async function VehiclesPage() {
  const result = await getVehicles();
  const vehicles = result.data ?? [];

  return <VehiclesClient vehicles={vehicles} />;
}
