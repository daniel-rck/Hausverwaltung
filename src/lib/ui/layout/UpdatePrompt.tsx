import { useAppUpdate } from "../../pwa/useAppUpdate.ts";
import { Button } from "../ui/Button";

/**
 * The app's own update toast in its design system, driven by web-base's
 * `useAppUpdate()` (`registerType: "prompt"`): a new service worker waits until
 * the user reloads, instead of activating under open pages. Mounted once in
 * main.tsx, next to <RouterProvider>, so it survives a crashed shell.
 */
export function UpdatePrompt() {
  const { needRefresh, reload, dismiss } = useAppUpdate();

  return (
    <div role="status" className="no-print">
      {needRefresh ? (
        <div className="fixed bottom-20 md:bottom-4 right-4 z-50 max-w-sm bg-surface border border-border rounded-lg shadow-lg p-4">
          <p className="text-sm text-fg mb-3">Eine neue Version ist verfügbar.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={dismiss}>
              Später
            </Button>
            <Button variant="primary" size="sm" onClick={reload}>
              Jetzt laden
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
