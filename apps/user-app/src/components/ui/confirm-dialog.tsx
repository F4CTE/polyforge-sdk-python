import * as React from "react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@polyforge/ui";

export interface ConfirmDialogProps {
  /** Whether the dialog is currently open. */
  open: boolean;
  /** Heading text rendered in the dialog header. */
  title: string;
  /** Primary description rendered below the title. */
  description: React.ReactNode;
  /** Optional supplementary content rendered after the description (summary, badges, etc.). */
  children?: React.ReactNode;
  /** Called when the user explicitly confirms the action. */
  onConfirm: () => void;
  /** Called for any cancel path: Cancel button, close button, Escape, backdrop click. */
  onCancel: () => void;
  /** Confirm-button label. */
  confirmLabel?: string;
  /** Cancel-button label. */
  cancelLabel?: string;
  /** Tone of the confirm action. `danger` is the right choice for destructive or financial actions. */
  tone?: "default" | "danger";
  /** When true, both buttons are disabled and the confirm button shows a spinner. */
  isLoading?: boolean;
  /**
   * Disable the confirm button for at least this many milliseconds after open.
   *
   * Mitigates muscle-memory clicks on irreversible flows (WCAG 3.3.4 Error Prevention).
   * The AC1 live-trade flow requires `>= 2000`. Default `0` (no delay).
   */
  delayMs?: number;
  /** Optional id override for the description element (defaults to a generated id). */
  descriptionId?: string;
}

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  isLoading = false,
  delayMs = 0,
  descriptionId,
}: ConfirmDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const generatedId = React.useId();
  const descId = descriptionId ?? `confirm-dialog-desc-${generatedId}`;

  const [delayElapsed, setDelayElapsed] = React.useState(delayMs <= 0);
  const [remainingMs, setRemainingMs] = React.useState(delayMs);

  // Move focus to Cancel on open so Enter (which activates the focused button)
  // resolves to the safer outcome — implements WCAG 3.3.4 default-of-safety.
  React.useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => cancelRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Reset and run the delay-to-accept timer whenever the dialog opens.
  React.useEffect(() => {
    if (!open) {
      setDelayElapsed(delayMs <= 0);
      setRemainingMs(delayMs);
      return;
    }
    if (delayMs <= 0) {
      setDelayElapsed(true);
      setRemainingMs(0);
      return;
    }

    setDelayElapsed(false);
    setRemainingMs(delayMs);

    const startedAt = Date.now();
    const tick = setInterval(() => {
      const remaining = Math.max(0, delayMs - (Date.now() - startedAt));
      setRemainingMs(remaining);
      if (remaining <= 0) {
        setDelayElapsed(true);
        clearInterval(tick);
      }
    }, 100);
    return () => clearInterval(tick);
  }, [open, delayMs]);

  const confirmDisabled = isLoading || !delayElapsed;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const renderedConfirmLabel =
    delayMs > 0 && !delayElapsed && remainingSeconds > 0
      ? `${confirmLabel} (${remainingSeconds}s)`
      : confirmLabel;

  // Destructive tone escalates dialog role to alertdialog so assistive tech treats
  // the announcement as time-critical (WCAG 4.1.2 + ARIA Authoring Practices).
  // For the default tone we leave the underlying Dialog primitive's role="dialog"
  // intact by not spreading any role override.
  const roleOverride =
    tone === "danger" ? { role: "alertdialog" as const } : {};

  function handleConfirmClick() {
    if (confirmDisabled) return;
    onConfirm();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent
        className="max-w-md"
        {...roleOverride}
        aria-describedby={descId}
        data-testid="confirm-dialog"
      >
        <DialogHeader onClose={onCancel}>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <DialogDescription id={descId}>{description}</DialogDescription>
          {children}
        </DialogBody>

        <DialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
            data-testid="confirm-dialog-cancel"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "danger" ? "danger" : "default"}
            onClick={handleConfirmClick}
            disabled={confirmDisabled}
            aria-disabled={confirmDisabled || undefined}
            loading={isLoading}
            data-testid="confirm-dialog-confirm"
          >
            {renderedConfirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
