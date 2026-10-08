import { Link, useLocation } from "react-router-dom";
import { buttonClassName } from "../ui/Button.tsx";
import { useDocumentTitle } from "./useDocumentTitle.ts";

/** The `*` route. Links to "/" by literal: owned code can't import the app's routes.ts. */
export function NotFound() {
  const { pathname } = useLocation();
  useDocumentTitle("Seite nicht gefunden");
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Seite nicht gefunden</h1>
      <p className="max-w-sm text-sm text-fg-muted">
        Unter <code className="break-all font-mono">{pathname}</code> gibt es nichts.
      </p>
      <Link to="/" className={buttonClassName({ variant: "secondary" })}>
        Zur Startseite
      </Link>
    </div>
  );
}
