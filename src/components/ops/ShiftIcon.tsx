import { Moon, Sun } from "lucide-react";
export function ShiftIcon({ shift, className = "h-4 w-4" }: { shift: string; className?: string }) {
  if (shift === "AM1") return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="8.5" cy="8" r="1.8" /><circle cx="15.5" cy="13.5" r="2.4" /><path d="M8 15.5h.01M14.5 7.5h.01" strokeWidth="2.5" strokeLinecap="round" /></svg>;
  if (shift === "PM1") return <Sun className={className} aria-hidden="true" />;
  return <Moon className={className} aria-hidden="true" />;
}
