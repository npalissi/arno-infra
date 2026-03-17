import { cn } from "@/lib/utils";

type VehicleStatus = "en_stock" | "en_preparation" | "en_vente" | "vendu";

const statusConfig: Record<
  VehicleStatus,
  { label: string; bgClass: string; textClass: string; dotClass: string }
> = {
  en_stock: {
    label: "En stock",
    bgClass: "bg-[#E6F4EA]",
    textClass: "text-[#1E8E3E]",
    dotClass: "bg-[#1E8E3E]",
  },
  en_preparation: {
    label: "En prépa",
    bgClass: "bg-[#E8F0FE]",
    textClass: "text-[#1A73E8]",
    dotClass: "bg-[#1A73E8]",
  },
  en_vente: {
    label: "En vente",
    bgClass: "bg-[#FEF7E0]",
    textClass: "text-[#B06000]",
    dotClass: "bg-[#B06000]",
  },
  vendu: {
    label: "Vendu",
    bgClass: "bg-[#F1F3F4]",
    textClass: "text-[#5F6368]",
    dotClass: "bg-[#5F6368]",
  },
};

interface StatusBadgeProps {
  status: VehicleStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold uppercase tracking-wide",
        config.bgClass,
        config.textClass,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dotClass)} />
      {config.label}
    </span>
  );
}
