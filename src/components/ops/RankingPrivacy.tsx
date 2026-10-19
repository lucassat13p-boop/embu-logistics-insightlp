import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PersonKind = "Colaborador" | "Motorista";
const STORAGE_KEY = "ops-hide-ranking-names";
type Privacy = { hidden: boolean; toggle: () => void; personName: (name: string, kind?: PersonKind) => string };
const RankingPrivacyContext = createContext<Privacy | null>(null);

export function RankingPrivacyProvider({ children }: { children: ReactNode }) {
  // Conceal names until the browser preference is available, including on reload.
  const [hidden, setHidden] = useState(true);
  const identities = useRef(new Map<string, number>());
  const counters = useRef<Record<PersonKind, number>>({ Colaborador: 0, Motorista: 0 });
  useEffect(() => {
    try { setHidden(localStorage.getItem(STORAGE_KEY) === "true"); }
    catch { setHidden(false); }
  }, []);
  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* Navigation still preserves the preference. */ }
  };
  const personName = (name: string, kind: PersonKind = "Colaborador") => {
    if (!hidden || !name.trim() || /^(sem informação|nenhum dado disponível)$/i.test(name.trim())) return name;
    const key = `${kind}:${name.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR")}`;
    let id = identities.current.get(key);
    if (id === undefined) {
      id = ++counters.current[kind];
      identities.current.set(key, id);
    }
    return `${kind} ${String(id).padStart(2, "0")}`;
  };
  return <RankingPrivacyContext.Provider value={{ hidden, toggle, personName }}>{children}</RankingPrivacyContext.Provider>;
}

export function useRankingPrivacy() {
  const privacy = useContext(RankingPrivacyContext);
  if (!privacy) throw new Error("RankingPrivacyProvider ausente");
  return privacy;
}

export function RankingPrivacyToggle() {
  const { hidden, toggle } = useRankingPrivacy();
  const label = hidden ? "Mostrar nomes" : "Ocultar nomes";
  const Icon = hidden ? Eye : EyeOff;
  return <Button type="button" variant="ghost" size="sm" onClick={toggle} aria-pressed={hidden} title={label} className="text-muted-foreground"><Icon className="h-4 w-4" />{label}</Button>;
}