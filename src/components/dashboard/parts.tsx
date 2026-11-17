import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABELS,
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  formatDate,
  formatDateTime,
} from "@/lib/format";
import type { DashItem } from "@/server/services/dashboard";

/** Titled panel used across every role dashboard. */
export function Panel({
  title,
  hint,
  href,
  hrefLabel = "Voir tout",
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass-panel flex flex-col rounded-xl ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        {href ? (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#1a4a7a] hover:underline"
          >
            {hrefLabel}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <div className="flex-1 p-3">{children}</div>
    </section>
  );
}

/** Compact KPI tile with an optional hint line. */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "good";
}) {
  const valueTone =
    tone === "danger"
      ? "text-rose-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "good"
          ? "text-emerald-700"
          : "text-foreground";

  return (
    <div className="glass-panel rounded-xl px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueTone}`}>{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-8 text-center text-sm text-muted-foreground">{children}</p>
  );
}

/** A single intervention line (reference, title, owner, status badge). */
export function DashRow({ item, extra }: { item: DashItem; extra?: string }) {
  const meta = [item.requester, item.technician, extra ?? item.location]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <Link
        href={`/requests/${item.id}`}
        className="console-row flex items-center gap-3 px-3 py-2.5"
      >
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_BADGE_CLASS[item.priority]}`}
        >
          {PRIORITY_LABELS[item.priority]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {item.title}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            <span className="font-mono text-[10px] text-[#1a4a7a]">{item.reference}</span>
            {meta ? ` · ${meta}` : ""}
            {" · "}
            {item.plannedStart
              ? `prévu ${formatDateTime(item.plannedStart)}`
              : formatDateTime(item.createdAt)}
          </span>
        </span>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE_CLASS[item.status]}`}
        >
          {STATUS_LABELS[item.status]}
        </span>
      </Link>
    </li>
  );
}

export function ItemList({ items, empty }: { items: DashItem[]; empty: string }) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <DashRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

/** Row with a label, optional sub-label and a right-aligned value. */
export function KeyRow({
  href,
  title,
  subtitle,
  value,
  valueClass = "text-muted-foreground",
}: {
  href?: string;
  title: string;
  subtitle?: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  const content = (
    <span className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="min-w-0">
        <span className="block truncate text-sm text-foreground/90">{title}</span>
        {subtitle ? (
          <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      <span className={`shrink-0 text-xs font-medium ${valueClass}`}>{value}</span>
    </span>
  );

  return (
    <li className="console-row">
      {href ? (
        <Link href={href} className="block">
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  );
}

/** Compact action button used in role headers. */
export function ActionLink({
  href,
  label,
  primary = false,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "inline-flex items-center gap-1.5 rounded-md bg-[#0b2a4a] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#133a60]"
          : "inline-flex items-center gap-1.5 rounded-md border border-border bg-white/70 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white"
      }
    >
      {label}
    </Link>
  );
}

/** Small badge for status-like values. */
export function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}) {
  const tones = {
    neutral: "border-border bg-foreground/5 text-foreground/70",
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    bad: "border-rose-200 bg-rose-50 text-rose-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Star rendering for satisfaction ratings (1..5). */
export function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="tabular-nums text-xs font-medium text-amber-700">
      {rating.toFixed(1)} / 5
    </span>
  );
}

export { formatDate };
