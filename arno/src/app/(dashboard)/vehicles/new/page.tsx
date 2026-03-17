"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { Auto1ImportForm } from "@/components/vehicles/auto1-import-form";
import { createVehicleFromForm } from "@/lib/actions/vehicle-form";

export default function NewVehiclePage() {
  // Mounted guard — base-ui Tabs generates different IDs SSR vs client
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold">Nouveau véhicule</h2>

      {mounted && (
        <Tabs defaultValue="manual">
          <TabsList>
            <TabsTrigger value="manual">Saisie manuelle</TabsTrigger>
            <TabsTrigger value="auto1">Import Auto1</TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <VehicleForm onSubmit={createVehicleFromForm} />
          </TabsContent>

          <TabsContent value="auto1">
            <Auto1ImportForm />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
