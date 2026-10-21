import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Empty } from "./blocks";

const colors = ["var(--pie-1)", "var(--pie-2)", "var(--pie-3)", "var(--pie-4)", "var(--pie-5)", "var(--pie-6)", "var(--pie-7)", "var(--pie-8)", "var(--pie-9)", "var(--pie-10)"];
const percent = (value: number, total: number) => `${(value / total * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function PieBlock({ data, total, categories, label, includeMissing = true, categoryColors }: {
  data: { name: string; value: number }[];
  total: number;
  categories: string[];
  label: string;
  includeMissing?: boolean;
  categoryColors?: Record<string, string>;
}) {
  if (!data.length || !total) return <Empty text="Nenhum dado disponível." />;
  const known = data.reduce((sum, item) => sum + item.value, 0);
  const slices = [...data, ...(includeMissing && known < total ? [{ name: "Sem informação", value: total - known }] : [])];
  const representedTotal = slices.reduce((sum, item) => sum + item.value, 0);
  const extraNames = data.map((item) => item.name).filter((name) => !categories.includes(name)).sort();
  const color = (name: string) => categoryColors?.[name] ?? (name === "Sem informação" ? "var(--pie-missing)" : colors[(categories.indexOf(name) < 0 ? categories.length + extraNames.indexOf(name) : categories.indexOf(name)) % colors.length]);
  return <div className="donut-block min-w-0" role="group" aria-label={label}>
    <div className="donut-layout">
    <div className="relative mx-auto aspect-square w-full max-w-96 min-w-0">
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-label={`Total: ${representedTotal.toLocaleString("pt-BR")}`}>
        <span className="max-w-[48%] break-words text-center font-display text-4xl font-bold tabular-nums">{representedTotal.toLocaleString("pt-BR")}</span>
        <span className="mt-1 text-sm text-muted-foreground">Total</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="62%" outerRadius="88%" stroke="var(--card)" strokeWidth={3} isAnimationActive={false}>
            {slices.map((item) => <Cell key={item.name} fill={color(item.name)} />)}
          </Pie>
          <Tooltip content={({ active, payload }) => {
            const item = payload?.[0]?.payload as { name: string; value: number } | undefined;
            return active && item ? <div className="max-w-64 rounded-md border bg-popover px-4 py-3 text-base text-popover-foreground shadow-card"><p className="break-words font-semibold">{item.name}</p><p>{item.value.toLocaleString("pt-BR")} · {percent(item.value, representedTotal)}</p></div> : null;
          }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
    <ul className="min-w-0 space-y-3 text-base" aria-label={`Legenda — ${label}`}>
      {slices.map((item) => <li key={item.name} className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-start gap-x-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
        <svg width="14" height="14" viewBox="0 0 12 12" className="mt-1 shrink-0" aria-hidden="true"><rect width="12" height="12" rx="2" fill={color(item.name)} /></svg>
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">{item.name}</span>
        <span className="text-right"><span className="block font-semibold tabular-nums">{item.value.toLocaleString("pt-BR")}</span><span className="block text-sm tabular-nums text-muted-foreground">{percent(item.value, representedTotal)}</span></span>
      </li>)}
    </ul>
    </div>
  </div>;
}