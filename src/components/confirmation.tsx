"use client";

import { ShieldQuestion } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button, Modal } from "./ui";

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
};
type Confirm = (options: Confirmation) => Promise<boolean>;
const ConfirmationContext = createContext<Confirm | null>(null);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Confirmation | null>(null);
  const resolve = useRef<((confirmed: boolean) => void) | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const confirm = useCallback<Confirm>((options) => {
    // Repeated clicks must never leave a previous caller waiting forever.
    resolve.current?.(false);
    trigger.current = document.activeElement as HTMLElement | null;
    setPending(options);
    return new Promise<boolean>((done) => {
      resolve.current = done;
    });
  }, []);
  const settle = (confirmed: boolean) => {
    resolve.current?.(confirmed);
    resolve.current = null;
    setPending(null);
  };
  useEffect(
    () => () => {
      resolve.current?.(false);
    },
    [],
  );
  return (
    <ConfirmationContext.Provider value={confirm}>
      <div inert={!!pending}>{children}</div>
      {pending && (
        <Modal
          title={pending.title}
          onClose={() => settle(false)}
          role="alertdialog"
          descriptionId="confirmation-description"
          returnFocus={trigger.current}
        >
          <div
            className={`confirmation-icon ${pending.destructive ? "danger" : ""}`}
            aria-hidden="true"
          >
            <ShieldQuestion size={25} />
          </div>
          <p id="confirmation-description" className="confirmation-description">
            {pending.description}
          </p>
          <div className="form-actions">
            <Button
              variant="secondary"
              data-autofocus
              onClick={() => settle(false)}
            >
              Cancel
            </Button>
            <Button
              variant={pending.destructive ? "danger" : ""}
              onClick={() => settle(true)}
            >
              {pending.confirmLabel}
            </Button>
          </div>
        </Modal>
      )}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) throw new Error("ConfirmationProvider is required.");
  return confirm;
}
