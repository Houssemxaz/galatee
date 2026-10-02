import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Search,
  LayoutGrid,
  LineChart,
  ExternalLink,
  Gift,
  Tag,
  ShoppingBag,
  UsersRound,
  Truck,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

const COMMANDS = [
  { id: "orders", group: "Aller à", label: "Commandes", Icon: ShoppingBag, hint: "g o", section: "orders" },
  { id: "menu", group: "Aller à", label: "Menu", Icon: LayoutGrid, hint: "g m", section: "menu" },
  { id: "delivery", group: "Aller à", label: "Livraison", Icon: Truck, hint: "g d", section: "delivery" },
  { id: "stats", group: "Aller à", label: "Statistiques", Icon: LineChart, hint: "g s", section: "stats" },
  { id: "loyalty", group: "Aller à", label: "Fidélité", Icon: Gift, hint: "g f", section: "loyalty" },
  { id: "promotions", group: "Aller à", label: "Promotions", Icon: Tag, hint: "g p", section: "promotions" },
  { id: "club", group: "Aller à", label: "Pasta Lover Club", Icon: UsersRound, hint: "g c", section: "club" },
  { id: "public", group: "Actions", label: "Ouvrir le site public", Icon: ExternalLink, hint: "", action: "open-public" },
];

function fuzzy(query, label) {
  if (!query) return true;
  const q = query.toLowerCase().replace(/\s+/g, "");
  const l = label.toLowerCase().replace(/\s+/g, "");
  let qi = 0;
  for (let i = 0; i < l.length && qi < q.length; i++) {
    if (l[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export default function CommandPalette({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  // Global Cmd/Ctrl+K listener
  useEffect(() => {
    function handler(e) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) close();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close]);

  // Focus input when opened
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const results = useMemo(
    () => COMMANDS.filter((cmd) => fuzzy(query, cmd.label)),
    [query]
  );

  // Group by group name preserving order
  const groups = useMemo(() => {
    const map = new Map();
    for (const cmd of results) {
      if (!map.has(cmd.group)) map.set(cmd.group, []);
      map.get(cmd.group).push(cmd);
    }
    return [...map.entries()];
  }, [results]);

  // Reset active when results change
  useEffect(() => { setActiveIndex(0); }, [query]);

  const runCommand = useCallback((cmd) => {
    if (cmd.action === "open-public") {
      window.open("/", "_blank", "noopener");
    } else if (cmd.section) {
      onNavigate?.(cmd.section);
    }
    close();
  }, [onNavigate, close]);

  // Keyboard nav within results
  useEffect(() => {
    if (!open) return;
    function keys(e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(results.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = results[activeIndex];
        if (cmd) runCommand(cmd);
      }
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [open, results, activeIndex, runCommand]);

  // Scroll active into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector(".bo-cmdk-item.is-active");
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex, groups]);

  if (!open) return null;

  let idx = -1;

  return (
    <div className="bo-cmdk-backdrop" onClick={close} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="bo-cmdk-panel" onClick={(e) => e.stopPropagation()}>
        <div className="bo-cmdk-input-wrap">
          <Search size={16} strokeWidth={2} />
          <input
            ref={inputRef}
            type="text"
            className="bo-cmdk-input"
            placeholder="Rechercher des commandes, plats, actions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Recherche"
          />
          <span className="bo-kbd bo-kbd-light">Esc</span>
        </div>

        <div ref={listRef} className="bo-cmdk-list" role="listbox">
          {results.length === 0 && (
            <div className="bo-cmdk-empty">Aucun résultat pour « {query} »</div>
          )}

          {groups.map(([groupLabel, items]) => (
            <div key={groupLabel} role="group" aria-label={groupLabel}>
              <p className="bo-cmdk-group-label">{groupLabel}</p>
              {items.map((cmd) => {
                idx++;
                const isActive = idx === activeIndex;
                const { Icon } = cmd;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`bo-cmdk-item ${isActive ? "is-active" : ""}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => runCommand(cmd)}
                  >
                    <Icon size={15} strokeWidth={1.8} />
                    <span className="bo-cmdk-item-label">{cmd.label}</span>
                    {cmd.hint && <span className="bo-cmdk-item-hint">{cmd.hint}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="bo-cmdk-foot">
          <span className="bo-cmdk-foot-item">
            <ArrowUp size={11} strokeWidth={2.2} />
            <ArrowDown size={11} strokeWidth={2.2} />
            <span>Naviguer</span>
          </span>
          <span className="bo-cmdk-foot-item">
            <CornerDownLeft size={11} strokeWidth={2.2} />
            <span>Ouvrir</span>
          </span>
          <span className="bo-cmdk-foot-item" style={{ marginLeft: "auto" }}>
            <span className="bo-kbd bo-kbd-light">⌘K</span>
            <span>pour fermer</span>
          </span>
        </div>
      </div>
    </div>
  );
}
