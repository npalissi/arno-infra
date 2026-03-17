"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VehicleStatus } from "@/types/database";

interface VehicleFormData {
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
  status: VehicleStatus;
  purchase_date: string;
  sale_date: string | null;
  purchase_notes: string | null;
}

interface VehicleFormProps {
  vehicle?: VehicleFormData;
  onSubmit: (formData: FormData) => Promise<void> | Promise<{ error: string } | null>;
}

const fuelTypes = ["Essence", "Diesel", "Hybride", "Électrique", "GPL"];
const gearboxTypes = ["Manuelle", "Automatique"];
const statusOptions: { value: VehicleStatus; label: string }[] = [
  { value: "en_stock", label: "En stock" },
  { value: "en_preparation", label: "En préparation" },
  { value: "en_vente", label: "En vente" },
  { value: "vendu", label: "Vendu" },
];

function today() {
  return new Date().toISOString().split("T")[0];
}

export function VehicleForm({ vehicle, onSubmit }: VehicleFormProps) {
  const router = useRouter();
  const isEdit = !!vehicle;

  const defaults: VehicleFormData = vehicle ?? {
    brand: "",
    model: "",
    sub_type: null,
    year: new Date().getFullYear(),
    mileage: 0,
    fuel_type: "Diesel",
    gearbox: "Manuelle",
    color: null,
    vin: null,
    registration: "",
    purchase_price: 0,
    target_sale_price: null,
    sale_price: null,
    status: "en_stock",
    purchase_date: today(),
    sale_date: null,
    purchase_notes: null,
  };

  async function handleSubmit(formData: FormData) {
    const priceFields = ["purchase_price", "target_sale_price", "sale_price"];
    for (const field of priceFields) {
      const val = formData.get(field);
      if (val && typeof val === "string" && val.trim() !== "") {
        formData.set(field, String(Math.round(parseFloat(val) * 100)));
      }
    }
    await onSubmit(formData);
  }

  return (
    <form action={handleSubmit}>
      <div className="max-w-3xl space-y-6">
        {/* Identification */}
        <Card className="border-black/[0.04]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-semibold tracking-tight">Identification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brand" className="text-[13px]">Marque *</Label>
                <Input
                  id="brand"
                  name="brand"
                  defaultValue={defaults.brand}
                  placeholder="Peugeot"
                  required={!isEdit}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model" className="text-[13px]">Modèle *</Label>
                <Input
                  id="model"
                  name="model"
                  defaultValue={defaults.model}
                  placeholder="3008"
                  required={!isEdit}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub_type" className="text-[13px]">Finition</Label>
                <Input
                  id="sub_type"
                  name="sub_type"
                  defaultValue={defaults.sub_type ?? ""}
                  placeholder="GT Line"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year" className="text-[13px]">Année *</Label>
                <Input
                  id="year"
                  name="year"
                  type="number"
                  defaultValue={defaults.year}
                  min={1990}
                  max={2030}
                  required={!isEdit}
                  className="h-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Caractéristiques */}
        <Card className="border-black/[0.04]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-semibold tracking-tight">Caractéristiques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mileage" className="text-[13px]">Kilométrage *</Label>
                <Input
                  id="mileage"
                  name="mileage"
                  type="number"
                  defaultValue={defaults.mileage}
                  min={0}
                  placeholder="45000"
                  required={!isEdit}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fuel_type" className="text-[13px]">Carburant *</Label>
                <Select
                  name="fuel_type"
                  defaultValue={defaults.fuel_type}
                >
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fuelTypes.map((fuel) => (
                      <SelectItem key={fuel} value={fuel}>
                        {fuel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gearbox" className="text-[13px]">Boîte de vitesses *</Label>
                <Select
                  name="gearbox"
                  defaultValue={defaults.gearbox}
                >
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gearboxTypes.map((gb) => (
                      <SelectItem key={gb} value={gb}>
                        {gb}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="color" className="text-[13px]">Couleur</Label>
                <Input
                  id="color"
                  name="color"
                  defaultValue={defaults.color ?? ""}
                  placeholder="Gris Artense"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vin" className="text-[13px]">VIN</Label>
                <Input
                  id="vin"
                  name="vin"
                  defaultValue={defaults.vin ?? ""}
                  placeholder="VF3MCYHZRML123456"
                  className="h-10 text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registration" className="text-[13px]">Immatriculation *</Label>
                <Input
                  id="registration"
                  name="registration"
                  defaultValue={defaults.registration}
                  placeholder="FG-123-AB"
                  required={!isEdit}
                  className="h-10 text-[13px] uppercase"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financier */}
        <Card className="border-black/[0.04]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-semibold tracking-tight">Financier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="purchase_price" className="text-[13px]">Prix d&apos;achat (€) *</Label>
                <Input
                  id="purchase_price"
                  name="purchase_price"
                  type="number"
                  defaultValue={defaults.purchase_price / 100 || ""}
                  min={0}
                  step="0.01"
                  placeholder="18500.00"
                  required={!isEdit}
                  className="h-10 tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_sale_price" className="text-[13px]">
                  Prix de vente souhaité (€)
                </Label>
                <Input
                  id="target_sale_price"
                  name="target_sale_price"
                  type="number"
                  defaultValue={
                    defaults.target_sale_price
                      ? defaults.target_sale_price / 100
                      : ""
                  }
                  min={0}
                  step="0.01"
                  placeholder="22900.00"
                  className="h-10 tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale_price" className="text-[13px]">Prix de vente réel (€)</Label>
                <Input
                  id="sale_price"
                  name="sale_price"
                  type="number"
                  defaultValue={
                    defaults.sale_price ? defaults.sale_price / 100 : ""
                  }
                  min={0}
                  step="0.01"
                  placeholder="22000.00"
                  className="h-10 tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status" className="text-[13px]">Statut *</Label>
                <Select name="status" defaultValue={defaults.status}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dates & Notes */}
        <Card className="border-black/[0.04]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-semibold tracking-tight">Dates & Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="purchase_date" className="text-[13px]">Date d&apos;achat *</Label>
                <Input
                  id="purchase_date"
                  name="purchase_date"
                  type="date"
                  defaultValue={defaults.purchase_date}
                  required={!isEdit}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale_date" className="text-[13px]">Date de vente</Label>
                <Input
                  id="sale_date"
                  name="sale_date"
                  type="date"
                  defaultValue={defaults.sale_date ?? ""}
                  className="h-10"
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="purchase_notes" className="text-[13px]">Notes</Label>
              <Textarea
                id="purchase_notes"
                name="purchase_notes"
                defaultValue={defaults.purchase_notes ?? ""}
                placeholder="Notes sur le véhicule..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-black/[0.04] pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="border-black/[0.08]"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
          >
            {isEdit ? "Enregistrer" : "Créer le véhicule"}
          </Button>
        </div>
      </div>
    </form>
  );
}
