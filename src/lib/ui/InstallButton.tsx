import { Download, Share } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "./primitives.tsx";
import { useInstallPrompt } from "./useInstallPrompt.ts";

export function InstallButton() {
  const { canInstall, isIOS, isStandalone, promptInstall } = useInstallPrompt();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClick = (event: MouseEvent) => {
      if (event.target === dialog) dialog.close();
    };
    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, []);

  if (isStandalone) return null;
  if (!isIOS && !canInstall) return null;

  const handleClick = async () => {
    if (isIOS) {
      dialogRef.current?.showModal();
      return;
    }
    await promptInstall();
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={handleClick} aria-label="App installieren">
        <Download className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Installieren</span>
      </Button>
      {isIOS ? (
        <dialog
          ref={dialogRef}
          className="rounded-lg border border-border bg-surface p-0 text-fg backdrop:bg-black/40 max-w-sm w-[min(90vw,24rem)]"
        >
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Share className="h-5 w-5 text-accent-600" aria-hidden="true" />
              <h2 className="text-base font-semibold">Zum Home-Bildschirm hinzufügen</h2>
            </div>
            <p className="text-sm text-fg-muted mb-3">
              Auf iPhone und iPad installierst du die App so:
            </p>
            <ol className="text-sm space-y-2 list-decimal pl-5 text-fg">
              <li>
                Tippe in Safari unten auf das Teilen-Symbol{" "}
                <Share className="inline h-4 w-4 align-text-bottom" aria-hidden="true" />.
              </li>
              <li>Wähle „Zum Home-Bildschirm".</li>
              <li>Bestätige mit „Hinzufügen".</li>
            </ol>
            <div className="mt-5 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => dialogRef.current?.close()}>
                Schließen
              </Button>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
