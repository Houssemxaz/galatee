import { useEffect } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, TrendingDown, TrendingUp, Minus, X } from "lucide-react";

/**
 * Backoffice UI primitives — Linear-like tech premium
 * Slideover · MetricCard · Sparkline · EmptyState · SkeletonRow · SortableTh
 */

/* ─── Slide-over panel from the right ─────────────────────────────── */
export function Slideover({ open, onClose, title, eyebrow, children, footer }) {
  useEffect(() => {
    if (!open) return;
    function key(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="bo-slideover-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="bo-slideover-panel" role="dialog" aria-modal="true" aria-label={title}>
        <header className="bo-slideover-head">
          <div>
            {eyebrow && <span className="bo-slideover-eyebrow">{eyebrow}</span>}
            <h3>{title}</h3>
          </div>
          <button type="button" className="bo-slideover-close" onClick={onClose} aria-label="Fermer">
            <X size={14} strokeWidth={2} />
          </button>
        </header>
        <div className="bo-slideover-body">{children}</div>
        {footer && <footer className="bo-slideover-foot">{footer}</footer>}
      </aside>
    </>
  );
}

/* ─── Metric card with optional sparkline + delta ─────────────────── */
export function MetricCard({ label, value, unit, delta, series, icon: Icon }) {
  const deltaKind =
    typeof delta === "number" ? (delta > 0 ? "up" : delta < 0 ? "down" : "flat") : null;

  return (
    <div className="bo-metric-card">
      <div className="bo-metric-head">
        <span className="bo-metric-label">{label}</span>
        {Icon && (
          <span className="bo-metric-icon">
            <Icon size={12} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="bo-metric-value">
        <span className="bo-metric-num">{value}</span>
        {unit && <span className="bo-metric-unit">{unit}</span>}
        {deltaKind && (
          <span className={`bo-metric-delta bo-metric-delta-${deltaKind}`}>
            {deltaKind === "up" && <TrendingUp size={10} strokeWidth={2.5} />}
            {deltaKind === "down" && <TrendingDown size={10} strokeWidth={2.5} />}
            {deltaKind === "flat" && <Minus size={10} strokeWidth={2.5} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {Array.isArray(series) && series.length >= 2 && <Sparkline data={series} />}
    </div>
  );
}

/* ─── Sparkline SVG ────────────────────────────────────────────────── */
export function Sparkline({ data, height = 36 }) {
  if (!Array.isArray(data) || data.length < 2) return null;
  const w = 200;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${(i * step).toFixed(2)},${(h - ((v - min) / range) * (h - 4) - 2).toFixed(2)}`);
  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;

  return (
    <svg className="bo-sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="bo-spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="bo-sparkline-area" d={areaPath} />
      <path className="bo-sparkline-path" d={linePath} />
    </svg>
  );
}

/* ─── Sortable table header ────────────────────────────────────────── */
export function SortableTh({ children, sortKey, activeKey, direction, onSort, ...rest }) {
  const isSorted = activeKey === sortKey;
  const dir = isSorted ? direction : null;
  return (
    <th
      {...rest}
      className={`is-sortable ${isSorted ? "is-sorted" : ""}`}
      onClick={() => onSort?.(sortKey)}
    >
      <span className="bo-th-inner">
        {children}
        <span className="bo-th-sort-icon" aria-hidden="true">
          {dir === "asc" && <ChevronUp size={12} strokeWidth={2.4} />}
          {dir === "desc" && <ChevronDown size={12} strokeWidth={2.4} />}
          {!dir && <ChevronsUpDown size={12} strokeWidth={1.8} />}
        </span>
      </span>
    </th>
  );
}

/* ─── Skeleton row for tables ──────────────────────────────────────── */
export function SkeletonRows({ rows = 5, cols = 4 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j}>
          <span className="bo-skeleton bo-skeleton-line" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  ));
}

/* ─── Empty state ──────────────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, description, actions }) {
  return (
    <div className="bo-empty-state">
      {Icon && (
        <div className="bo-empty-state-icon">
          <Icon size={22} strokeWidth={1.6} />
        </div>
      )}
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      {actions && <div className="bo-empty-state-actions">{actions}</div>}
    </div>
  );
}
