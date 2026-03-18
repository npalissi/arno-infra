import Link from "next/link";
import { Car } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center text-center">
        <Car className="size-20 text-muted-foreground/15 mb-6" strokeWidth={1} />
        <h1 className="text-[48px] font-mono font-bold tracking-tight text-foreground">
          404
        </h1>
        <p className="mt-2 text-[16px] font-semibold text-foreground">
          Page introuvable
        </p>
        <p className="mt-1 text-[14px] text-muted-foreground max-w-xs">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-[#1A1A1A] px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-black"
        >
          Retour au dashboard
        </Link>
      </div>
    </div>
  );
}
