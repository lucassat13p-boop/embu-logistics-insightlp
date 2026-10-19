import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, dark, setTheme } = useTheme();
  const Icon = dark ? Moon : Sun;
  const label = theme === "system" ? "Automático" : theme === "dark" ? "Escuro" : "Claro";
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="shrink-0" aria-label={`Tema: ${label}`} title={`Tema: ${label}`}><Icon /></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuLabel>Tema</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup value={theme} onValueChange={(value) => { if (value === "light" || value === "dark" || value === "system") setTheme(value); }}>
        <DropdownMenuRadioItem value="light"><Sun className="mr-2 h-4 w-4" />Claro</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark"><Moon className="mr-2 h-4 w-4" />Escuro</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="system"><Monitor className="mr-2 h-4 w-4" />Automático</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}