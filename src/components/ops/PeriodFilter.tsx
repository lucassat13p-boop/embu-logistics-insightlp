import { CalendarDays, ChevronDown, Columns3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { monthLabel, periodLabel, weekRange, type PeriodKind, type PeriodSelection } from "@/lib/period";

const kinds: { value: PeriodKind; label: string }[] = [{ value: "day", label: "Dia" }, { value: "week", label: "Semana" }, { value: "month", label: "Mês" }, { value: "custom", label: "Personalizado" }];

function PeriodFields({ value, onChange, months, label }: { value: PeriodSelection; onChange: (value: PeriodSelection) => void; months: string[]; label: string }) {
  const setKind = (kind: PeriodKind) => onChange({ ...value, kind });
  const range = value.kind === "week" ? weekRange(value.week) : null;
  return <div className="min-w-0 space-y-2">
    <Label>{label}</Label>
    <div className="flex min-w-0 flex-wrap gap-2">
      <Select value={value.kind} onValueChange={(kind) => setKind(kind as PeriodKind)}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>{kinds.map((kind) => <SelectItem key={kind.value} value={kind.value}>{kind.label}</SelectItem>)}</SelectContent>
      </Select>
      {value.kind === "day" && <Input type="date" value={value.date} onChange={(event) => onChange({ ...value, date: event.target.value })} className="w-auto" aria-label={`${label}: data`} />}
      {value.kind === "week" && <Input type="week" value={value.week} onChange={(event) => onChange({ ...value, week: event.target.value })} className="w-auto" aria-label={`${label}: semana`} />}
      {value.kind === "month" && <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" className="max-w-full"><CalendarDays className="h-4 w-4 shrink-0" /><span className="max-w-60 truncate">{value.months.length ? periodLabel(value) : "Todos os meses"}</span><ChevronDown className="h-4 w-4 shrink-0" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 w-64">
          <DropdownMenuCheckboxItem checked={!value.months.length} onCheckedChange={() => onChange({ ...value, months: [] })} onSelect={(event) => event.preventDefault()}>Todos os meses</DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {!months.length && <DropdownMenuLabel className="font-normal text-muted-foreground">Nenhum dado disponível</DropdownMenuLabel>}
          {months.map((month) => <DropdownMenuCheckboxItem key={month} checked={value.months.includes(month)} onSelect={(event) => event.preventDefault()} onCheckedChange={(checked) => onChange({ ...value, months: checked ? [...value.months, month].sort() : value.months.filter((item) => item !== month) })}>{monthLabel(month)}</DropdownMenuCheckboxItem>)}
        </DropdownMenuContent>
      </DropdownMenu>}
      {value.kind === "custom" && <><Input type="date" value={value.start} onChange={(event) => onChange({ ...value, start: event.target.value })} className="w-auto" aria-label={`${label}: data inicial`} /><Input type="date" value={value.end} onChange={(event) => onChange({ ...value, end: event.target.value })} className="w-auto" aria-label={`${label}: data final`} /></>}
    </div>
    {range && <p className="text-xs text-muted-foreground">{periodLabel(value)}</p>}
  </div>;
}

export function PeriodFilter({ months, period, onChange, mode, onModeChange, comparison, onComparisonChange, onClear }: {
  months: string[];
  period: PeriodSelection;
  onChange: (period: PeriodSelection) => void;
  mode: "single" | "compare";
  onModeChange: (mode: "single" | "compare") => void;
  comparison: PeriodSelection;
  onComparisonChange: (period: PeriodSelection) => void;
  onClear: () => void;
}) {
  return (
    <div className="w-full min-w-0 space-y-3 rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">Modo de análise:</span><Button size="sm" variant={mode === "single" ? "default" : "outline"} onClick={() => onModeChange("single")}>Período único</Button><Button size="sm" variant={mode === "compare" ? "default" : "outline"} onClick={() => onModeChange("compare")}><Columns3 className="h-4 w-4" />Comparar períodos</Button><Button size="sm" variant="ghost" onClick={onClear}><X className="h-4 w-4" />Limpar filtro</Button></div>
      <div className={mode === "compare" ? "grid gap-3 xl:grid-cols-2" : "max-w-4xl"}>
        <PeriodFields label={mode === "compare" ? "Período 1" : "Tipo de período"} value={period} onChange={onChange} months={months} />
        {mode === "compare" && <PeriodFields label="Período 2" value={comparison} onChange={onComparisonChange} months={months} />}
      </div>
    </div>
  );
}