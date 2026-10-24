import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { RankingPrivacyToggle, useRankingPrivacy, type PersonKind } from "./RankingPrivacy";

export const NO_DATA = "Nenhum dado disponível";

export function Panel({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-lg border bg-card shadow-card", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="min-w-0 p-4 sm:p-5">{children}</div>
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
    <div className={cn("min-w-0 rounded-lg border bg-card p-4 shadow-card sm:p-5", accent && "border-primary/30")}>
      <p className="break-words text-sm font-medium text-muted-foreground">{label}</p>
      {has ? (
        <p className={cn("mt-2 break-words font-display text-4xl font-bold tabular-nums", accent && "text-primary")}>{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{hint ?? NO_DATA}</p>
      )}
    </div>
  );
}

const tip = {
  contentStyle: { borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)", fontSize: 14, maxWidth: 300, whiteSpace: "normal" as const, overflowWrap: "anywhere" as const, boxShadow: "var(--shadow-card)" },
  labelStyle: { color: "var(--popover-foreground)", fontWeight: 600 },
};
const axisTick = { fontSize: 13, fill: "var(--muted-foreground)" };
const valueLabel = { fontSize: 14, fill: "var(--foreground)", fontWeight: 600 };
const shortName = (name: string, length: number) => name.length > length ? `${name.slice(0, length - 1)}…` : name;

export function BarBlock({ data, emptyText = "Nenhum dado disponível para este gráfico.", horizontal, limit = 12, rowHeight = 0, yAxisWidth = 110, tickFormatter, tooltipLabel, valueName = "Registros", height, fillHeight = false, maxBarSize = 32 }: { data: { name: string; value: number }[]; emptyText?: string; horizontal?: boolean; limit?: number; rowHeight?: number; yAxisWidth?: number; tickFormatter?: (name: string) => string; tooltipLabel?: string; valueName?: string; height?: number; fillHeight?: boolean; maxBarSize?: number }) {
  const [width, setWidth] = useState(600);
  if (!data.length) return <Empty text={emptyText} />;
  const d = data.slice(0, limit);
  const chartHeight = height ?? (horizontal ? Math.max(320, d.length * Math.max(50, rowHeight) + 64) : Math.max(340, Math.min(480, d.length * 18 + 240)));
  const categoryWidth = Math.min(Math.max(120, yAxisWidth), Math.max(85, Math.floor(width * 0.36)));
  const formatCategory = (name: string) => shortName(tickFormatter ? tickFormatter(name) : name, horizontal ? Math.max(9, Math.floor(categoryWidth / 7)) : width < 420 ? 10 : 16);
  return (
    <div className="min-w-0 w-full" style={{ height: fillHeight ? "100%" : chartHeight }}>
      <ResponsiveContainer onResize={(nextWidth) => setWidth(nextWidth)}>
        {horizontal ? (
          <BarChart data={d} layout="vertical" margin={{ top: 8, bottom: 8, left: 0, right: 48 }} barCategoryGap="24%">
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" tick={axisTick} allowDecimals={false} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis type="category" dataKey="name" width={categoryWidth} tick={axisTick} tickFormatter={formatCategory} interval={0} axisLine={false} tickLine={false} />
            <Tooltip
              {...tip}
              labelFormatter={(label) => tooltipLabel ? `${tooltipLabel}: ${String(label)}` : String(label)}
              formatter={(value) => [Number(value).toLocaleString("pt-BR"), valueName]}
            />
            <Bar dataKey="value" name={valueName} fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={maxBarSize} isAnimationActive={false}>
              <LabelList dataKey="value" position="right" {...valueLabel} formatter={(value: unknown) => Number(value).toLocaleString("pt-BR")} />
            </Bar>
          </BarChart>
        ) : (
          <BarChart data={d} margin={{ top: 28, right: 16, left: 0, bottom: 12 }} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" tick={axisTick} interval={0} tickFormatter={formatCategory} angle={d.length > 4 ? -35 : 0} textAnchor={d.length > 4 ? "end" : "middle"} height={d.length > 4 ? 90 : 52} axisLine={false} tickLine={false} />
            <YAxis tick={axisTick} allowDecimals={false} width={48} axisLine={false} tickLine={false} />
            <Tooltip {...tip} labelFormatter={(label) => tooltipLabel ? `${tooltipLabel}: ${String(label)}` : String(label)} formatter={(value) => [Number(value).toLocaleString("pt-BR"), valueName]} />
            <Bar dataKey="value" name={valueName} fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
              <LabelList dataKey="value" position="top" {...valueLabel} formatter={(value: unknown) => Number(value).toLocaleString("pt-BR")} />
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function LineBlock({ data }: { data: { label: string; value: number }[] }) {
  if (!data.length) return <Empty text="Nenhum dado disponível para este gráfico." />;
  return (
    <div className="h-80 min-w-0 w-full sm:h-96">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 20, right: 20, bottom: 12, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axisTick} minTickGap={36} interval="preserveStartEnd" height={48} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} allowDecimals={false} width={48} axisLine={false} tickLine={false} />
          <Tooltip {...tip} labelFormatter={(label) => `Data: ${String(label)}`} formatter={(value) => [Number(value).toLocaleString("pt-BR"), "Registros"]} />
          <Line type="monotone" dataKey="value" name="Registros" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--card)" }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Ranking({ data, limit = 8, personKind, showPrivacyToggle = true }: { data: { name: string; value: number }[]; limit?: number; personKind?: PersonKind; showPrivacyToggle?: boolean }) {
  const { personName } = useRankingPrivacy();
  if (!data.length) return <Empty />;
  const max = data[0].value;
  return (
    <div>{personKind && showPrivacyToggle && <div className="mb-3 flex justify-end"><RankingPrivacyToggle /></div>}<ol className="space-y-4">
      {data.slice(0, limit).map((d, i) => (
        <li key={d.name} className="flex items-start gap-3 text-base">
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded text-sm font-semibold", i === 0 ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground")}>{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3"><span className="min-w-0 break-words [overflow-wrap:anywhere]" title={personKind ? personName(d.name, personKind) : d.name}>{personKind ? personName(d.name, personKind) : d.name}</span><span className="shrink-0 text-lg font-semibold tabular-nums">{d.value.toLocaleString("pt-BR")}</span></div>
            <div className="mt-2 h-2 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${(d.value / max) * 100}%` }} /></div>
          </div>
        </li>
      ))}
    </ol></div>
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
