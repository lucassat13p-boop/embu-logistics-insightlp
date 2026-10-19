import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const SUGGESTIONS = ["Avarias", "Backlog", "Delivered", "Delivering", "OnHold", "Pacotes de outro HUB", "Pacotes Retirados Do Veiculo", "Possiveis Perdas", "Proxima Janela de Expedição", "RTS - Reversa", "SOC_LHTransported"];

export function FullStatusPicker({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const choose = (v: string) => { onChange(v); setOpen(false); };
  return <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setSearch(""); }}>
    <PopoverTrigger asChild><Button disabled={disabled} variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal"><span className="truncate">{value || "Selecione uma sugestão ou digite um novo status"}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start"><Command>
      <CommandInput placeholder="Digite para filtrar ou criar..." value={search} onValueChange={setSearch} />
      <CommandList><CommandEmpty>Nenhuma sugestão encontrada.</CommandEmpty><CommandGroup heading="Sugestões">
        {SUGGESTIONS.map((s) => <CommandItem key={s} value={s} onSelect={() => choose(s)}><Check className={`mr-2 h-4 w-4 ${value === s ? "opacity-100" : "opacity-0"}`} />{s}</CommandItem>)}
      </CommandGroup>{search.trim() && !SUGGESTIONS.some((s) => s.toLowerCase() === search.trim().toLowerCase()) && <CommandGroup heading="Texto livre"><CommandItem value={`__free__${search.trim()}`} onSelect={() => choose(search.trim())}>Usar este texto: “{search.trim()}”</CommandItem></CommandGroup>}</CommandList>
    </Command></PopoverContent>
  </Popover>;
}