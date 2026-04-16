import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@polyforge/ui';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** Exact string the user must type to enable the confirm button. */
  confirmationText: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Button label (default: "Confirm"). */
  destructiveLabel?: string;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmationText,
  onConfirm,
  onCancel,
  destructiveLabel = 'Confirm',
  isLoading = false,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset typed value whenever dialog opens
  useEffect(() => {
    if (open) {
      setTyped('');
      // Focus input after animation frame so the dialog has rendered
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const canConfirm = typed === confirmationText && !isLoading;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader onClose={onCancel}>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <p className="text-body-sm text-secondary">{description}</p>

          <div className="space-y-1.5">
            <p className="text-label text-tertiary">
              Type <strong className="font-mono text-primary">{confirmationText}</strong> to continue
            </p>
            <Input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmationText}
              aria-label={`Type ${confirmationText} to confirm`}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={!canConfirm}
            loading={isLoading}
          >
            {destructiveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
