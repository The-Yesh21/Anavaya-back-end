import { useEffect, useRef, type ReactNode } from "react";

export function LandingDialog({
  titleId,
  onDismiss,
  children,
  className = "max-w-2xl",
}: {
  titleId: string;
  onDismiss: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
      className={`m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] overflow-y-auto overscroll-contain rounded-2xl bg-transparent text-foreground backdrop:bg-black/65 ${className}`}
    >
      {children}
    </dialog>
  );
}
