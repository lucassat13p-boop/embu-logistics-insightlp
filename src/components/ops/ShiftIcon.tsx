import { Circle, Moon, Sun } from "lucide-react";
export function ShiftIcon({ shift, className = "h-4 w-4" }: { shift: string; className?: string }) {
  if (shift === "AM1") return <Circle className={className} fill="currentColor" aria-hidden="true" />;
  if (shift === "PM1") return <Sun className={className} aria-hidden="true" />;
  return <Moon className={className} aria-hidden="true" />;
}
