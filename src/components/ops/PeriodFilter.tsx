import { CalendarDays, ChevronDown, Columns3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { monthLabel } from "@/lib/period";

export function PeriodFilter({ months, selected, onChange, comparing, onCompare }: {
  months: string[];
  selected: string[];
  onChange: (months: string[]) => void;
  comparing: boolean;
  onCompare: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-sm font-medium">Período:</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="max-w-full" aria-label="Selecionar período">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="truncate">{selected.length === 0 ? "Todos os meses" : selected.length === 1 ? monthLabel(selected[0]) : `${selected.length} meses selecionados`}</span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 w-64">
          <DropdownMenuCheckboxItem checked={!selected.length} onCheckedChange={() => onChange([])} onSelect={(event) => event.preventDefault()}>Todos os meses</DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {months.length === 0 && <DropdownMenuLabel className="font-normal text-muted-foreground">Nenhum dado disponível</DropdownMenuLabel>}
          {months.map((month) => (
            <DropdownMenuCheckboxItem key={month} checked={selected.includes(month)} onSelect={(event) => event.preventDefault()} onCheckedChange={(checked) => onChange(checked ? [...selected, month].sort() : selected.filter((value) => value !== month))}>
              {monthLabel(month)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant={comparing ? "default" : "outline"} disabled={selected.length < 2} onClick={onCompare} aria-pressed={comparing}>
        <Columns3 className="h-4 w-4" />Comparar meses
      </Button>
      {selected.length > 0 && <Button variant="ghost" onClick={() => onChange([])}><X className="h-4 w-4" />Limpar filtro</Button>}
      {selected.length > 1 && (
        <div className="flex w-full flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Meses selecionados">
          {selected.map((month) => <span key={month}>{monthLabel(month)}</span>)}
        </div>
      )}
    </div>
  );
}