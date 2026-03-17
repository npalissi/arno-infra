"use client";

import { useState } from "react";
import { Loader2, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface ImportResult {
  imported: number;
  errors: string[];
}

export function Auto1ImportForm() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function parseStockNumbers(raw: string): string[] {
    return raw
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function handleImport() {
    const stockNumbers = parseStockNumbers(input);
    if (stockNumbers.length === 0) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/auto1/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockNumbers }),
      });

      if (!response.ok) {
        const error = await response.json();
        setResult({
          imported: 0,
          errors: [error.error || "Erreur serveur"],
        });
        return;
      }

      const data: ImportResult = await response.json();
      setResult(data);
    } catch {
      setResult({ imported: 0, errors: ["Erreur réseau"] });
    } finally {
      setLoading(false);
    }
  }

  const stockNumbers = parseStockNumbers(input);
  const count = stockNumbers.length;

  return (
    <Card className="border-black/[0.04]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#E8F0FE]">
            <Upload className="size-4 text-[#1A73E8]" />
          </div>
          <div>
            <CardTitle className="text-[15px] font-semibold tracking-tight">Import Auto1</CardTitle>
            <CardDescription className="text-[12px]">
              Importez des véhicules par numéro de stock
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder={"Numéros de stock Auto1 (virgule ou retour à la ligne)\n\nExemple :\nAZ95896\nLA36835, BX12345"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            rows={5}
            className="text-[13px]"
          />
          {count > 0 && (
            <p className="text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground">{count}</span> numéro{count > 1 ? "s" : ""} détecté{count > 1 ? "s" : ""}
              {count > 10 && (
                <span className="text-destructive font-medium"> — max 10</span>
              )}
            </p>
          )}
        </div>

        <Button
          onClick={handleImport}
          disabled={loading || count === 0 || count > 10}
          className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" data-icon="inline-start" />
              Import en cours...
            </>
          ) : (
            <>
              <Upload data-icon="inline-start" />
              Importer {count > 0 && `(${count})`}
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-2 pt-2">
            {result.imported > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-[#1E8E3E]/20 bg-[#E6F4EA] p-3 text-[13px] text-[#1E8E3E]">
                <CheckCircle2 className="size-4 shrink-0" />
                <span className="font-medium">
                  {result.imported} véhicule{result.imported > 1 ? "s" : ""} importé{result.imported > 1 ? "s" : ""}
                </span>
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="space-y-1.5">
                {result.errors.map((error, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-red-50 p-3 text-[13px] text-destructive"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
