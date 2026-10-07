import { Button } from "../ui/Button.tsx";
import { useAppUpdate } from "./useAppUpdate.ts";

/**
 * „Update verfügbar" / „offline verfügbar" toast above the bottom nav. Mount it
 * once, next to <RouterProvider> in main.tsx. The status region is always
 * mounted so screen readers announce the message when it appears.
 */
export function UpdatePrompt() {
  const { needRefresh, offlineReady, reload, dismiss } = useAppUpdate();
  const open = needRefresh || offlineReady;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-4"
    >
      {open ? (
        <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-lg animate-slide-up">
          <p className="text-sm text-fg">
            {needRefresh
              ? "Update verfügbar – neu laden, um die neue Version zu nutzen."
              : "Die App ist jetzt auch offline verfügbar."}
          </p>
          <div className="flex shrink-0 gap-2">
            {needRefresh ? (
              <>
                <Button size="sm" onClick={reload}>
                  Neu laden
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss}>
                  Später
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={dismiss}>
                OK
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
