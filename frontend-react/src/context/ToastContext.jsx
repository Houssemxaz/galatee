import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Check, AlertTriangle, Info } from "lucide-react";

const ToastContext = createContext({ show: () => {} });

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback((message, options = {}) => {
    const id = nextId++;
    const kind = options.kind || "info";
    const duration = options.duration ?? 3200;
    setToasts((current) => [...current, { id, message, kind }]);
    const timer = window.setTimeout(() => remove(id), duration);
    timers.current.set(id, timer);
    return id;
  }, [remove]);

  const helpers = {
    show,
    success: (msg, opts) => show(msg, { ...opts, kind: "success" }),
    error: (msg, opts) => show(msg, { ...opts, kind: "error" }),
    info: (msg, opts) => show(msg, { ...opts, kind: "info" }),
    remove,
  };

  return (
    <ToastContext.Provider value={helpers}>
      {children}
      <Toaster toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

function ToastIcon({ kind }) {
  if (kind === "success") return <Check size={13} strokeWidth={3} />;
  if (kind === "error") return <AlertTriangle size={13} strokeWidth={2.5} />;
  return <Info size={13} strokeWidth={2.5} />;
}

function Toaster({ toasts, onDismiss }) {
  return (
    <div className="toaster" role="region" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast toast-${t.kind}`}
          onClick={() => onDismiss(t.id)}
        >
          <span className="toast-icon" aria-hidden="true">
            <ToastIcon kind={t.kind} />
          </span>
          <span className="toast-msg">{t.message}</span>
        </button>
      ))}
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
