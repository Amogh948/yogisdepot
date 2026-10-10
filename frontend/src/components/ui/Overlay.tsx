import { ReactNode, useEffect } from "react";

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-yd-ink/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0" aria-label="Close" onClick={onClose} type="button" />
      <div className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-sheet bg-white p-5 shadow-card sm:max-w-lg sm:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-yd-forest">{title}</h2>
          <button onClick={onClose} type="button" className="min-h-11 px-2 text-sm font-semibold text-yd-muted">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} title={title} onClose={onClose}>
      {children}
    </BottomSheet>
  );
}

export function BottomSheet({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-yd-ink/40" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0" aria-label="Close" onClick={onClose} type="button" />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] animate-[sheetUp_220ms_ease-out] flex-col rounded-t-sheet bg-white pb-[env(safe-area-inset-bottom)] shadow-card lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[380px] lg:max-h-none lg:rounded-none lg:animate-none">
        <div className="flex flex-col items-center pt-3 lg:hidden">
          <span className="h-1.5 w-10 rounded-full bg-yd-border" aria-hidden />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 pt-3">
          <h2 className="font-display text-xl text-yd-forest">{title}</h2>
          <button onClick={onClose} type="button" className="min-h-11 px-2 text-sm font-semibold text-yd-muted">
            Done
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer ? <div className="border-t border-yd-border px-5 py-4">{footer}</div> : null}
      </div>
      <style>{`@keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmPending = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm text-yd-muted">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          className="min-h-11 rounded-full px-4 text-sm font-semibold"
          onClick={onClose}
          type="button"
          disabled={confirmPending}
        >
          {cancelLabel}
        </button>
        <button
          className="min-h-11 rounded-full bg-yd-error px-4 text-sm font-semibold text-white disabled:opacity-60"
          onClick={onConfirm}
          type="button"
          disabled={confirmPending}
        >
          {confirmPending ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
