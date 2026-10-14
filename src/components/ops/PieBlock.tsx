import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Empty } from "./blocks";

const colors = ["var(--pie-1)", "var(--pie-2)", "var(--pie-3)", "var(--pie-4)", "var(--pie-5)", "var(--pie-6)", "var(--pie-7)", "var(--pie-8)", "var(--pie-9)", "var(--pie-10)"];
const percent = (value: number, total: number) => `${(value / total * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function PieBlock({ data, total, categories, label, includeMissing = true }: {
  data: { name: string; value: number }[];
  total: number;
  categories: string[];
  label: string;
  includeMissing?: boolean;
}) {
  if (!data.length || !total) return <Empty text="Nenhum dado disponível." />;
  const known = data.reduce((sum, item) => sum + item.value, 0);
  const slices = [...data, ...(includeMissing && known < total ? [{ name: "Sem informação", value: total - known }] : [])];
  const extraNames = data.map((item) => item.name).filter((name) => !categories.includes(name)).sort();
  const color = (name: string) => name === "Sem informação" ? "var(--pie-missing)" : colors[(categories.indexOf(name) < 0 ? categories.length + extraNames.indexOf(name) : categories.indexOf(name)) % colors.length];
  return <div className="min-w-0 space-y-3" role="group" aria-label={label}>
    <div className="h-64 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={106} stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
            {slices.map((item) => <Cell key={item.name} fill={color(item.name)} />)}
          </Pie>
          <Tooltip content={({ active, payload }) => {
            const item = payload?.[0]?.payload as { name: string; value: number } | undefined;
            return active && item ? <div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-card"><p className="font-semibold">{item.name}</p><p>{item.value.toLocaleString("pt-BR")} · {percent(item.value, total)}</p></div> : null;
          }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
    <ul className="space-y-2 text-sm" aria-label={`Legenda — ${label}`}>
      {slices.map((item) => <li key={item.name} className="flex items-start gap-2">
        <svg width="12" height="12" viewBox="0 0 12 12" className="mt-1 shrink-0" aria-hidden="true"><rect width="12" height="12" rx="2" fill={color(item.name)} /></svg>
        <span className="min-w-0 flex-1 break-words">{item.name}</span>
        <span className="shrink-0 font-semibold tabular-nums">{item.value.toLocaleString("pt-BR")}</span>
        <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">{percent(item.value, total)}</span>
      </li>)}
    </ul>
  </div>;
}