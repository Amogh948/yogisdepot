import { useToastStore } from "../../store/toast.store";

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismiss(toast.id)}
          className={`pointer-events-auto w-full max-w-sm rounded-2xl px-4 py-3 text-left text-sm font-medium text-white shadow-card ${
            toast.tone === "error" ? "bg-red-700" : toast.tone === "info" ? "bg-charcoal-800" : "bg-sage-700"
          }`}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
