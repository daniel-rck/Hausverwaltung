import { useEffect } from "react";

// The app's name, from index.html's <title>, read once at module load.
const APP_TITLE = typeof document === "undefined" ? "" : document.title;

/**
 * Set `<Seite> · <App>` as the document title while the page is mounted, so
 * history entries, tabs and screen-reader page announcements say where you are.
 */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = APP_TITLE ? `${title} · ${APP_TITLE}` : title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
