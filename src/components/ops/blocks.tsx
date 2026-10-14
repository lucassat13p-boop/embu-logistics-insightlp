import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export const NO_DATA = "Nenhum dado disponível";

export function Panel({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-lg border bg-card shadow-card", className)}>
      <header className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Empty({ text = NO_DATA, hint }: { text?: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
      <Inbox className="h-6 w-6 text-muted-foreground/60" />
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
      {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

export function Kpi({ label, value, hint, accent }: { label: string; value: number | string | null | undefined; hint?: string; accent?: boolean }) {
  const has = value !== null && value !== undefined;
  return (
    <div className={cn("rounded-lg border bg-card p-4 shadow-card", accent && "border-primary/30")}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {has ? (
        <p className={cn("mt-1 font-display text-3xl font-bold tabular-nums", accent && "text-primary")}>{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{hint ?? NO_DATA}</p>
      )}
    </div>
  );
}

const tip = { contentStyle: { borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 } };

export function BarBlock({ data, emptyText = "Nenhum dado disponível para este gráfico.", horizontal, limit = 12 }: { data: { name: string; value: number }[]; emptyText?: string; horizontal?: boolean; limit?: number }) {
  if (!data.length) return <Empty text={emptyText} />;
  const d = data.slice(0, limit);
  return (
    <div className="h-64">
      <ResponsiveContainer>
        {horizontal ? (
          <BarChart data={d} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
            <Tooltip {...tip} />
            <Bar dataKey="value" name="Registros" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
          </BarChart>
        ) : (
          <BarChart data={d}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip {...tip} />
            <Bar dataKey="value" name="Registros" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function LineBlock({ data }: { data: { label: string; value: number }[] }) {
  if (!data.length) return <Empty text="Nenhum dado disponível para este gráfico." />;
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip {...tip} />
          <Line type="monotone" dataKey="value" name="Registros" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Ranking({ data, limit = 8 }: { data: { name: string; value: number }[]; limit?: number }) {
  if (!data.length) return <Empty />;
  const max = data[0].value;
  return (
    <ol className="space-y-2">
      {data.slice(0, limit).map((d, i) => (
        <li key={d.name} className="flex items-center gap-3 text-sm">
          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold", i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-2"><span className="truncate">{d.name}</span><span className="font-semibold tabular-nums">{d.value.toLocaleString("pt-BR")}</span></div>
            <div className="mt-1 h-1.5 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${(d.value / max) * 100}%` }} /></div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Concluído" ? "bg-success/15 text-success" :
    status === "Concluído com avisos" ? "bg-warning/20 text-warning-foreground" :
    status === "Erro" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground";
  return <span className={cn("inline-flex rounded px-2 py-0.5 text-xs font-medium", cls)}>{status}</span>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
