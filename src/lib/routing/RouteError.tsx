import { type ReactNode, useEffect } from "react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { Button, buttonClassName } from "../ui/Button.tsx";
import { NotFound } from "./NotFound.tsx";

// What browsers say when a lazy route chunk is gone — typically a deploy
// replaced the build while this tab still ran the old one.
const CHUNK_ERROR =
  /dynamically imported module|Importing a module script failed|module script|Loading chunk/i;

const reload = () => window.location.reload();

function Panel({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-sm text-sm text-fg-muted">{text}</p>
      <div className="flex flex-wrap justify-center gap-2">{children}</div>
    </div>
  );
}

/** The router's ErrorBoundary: a German error page instead of React Router's developer screen. */
export function RouteError() {
  const error = useRouteError();
  useEffect(() => {
    console.error(error);
  }, [error]);

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  const message = error instanceof Error ? error.message : String(error);

  if (CHUNK_ERROR.test(message)) {
    return (
      <Panel
        title="Neue Version verfügbar"
        text="Die App wurde aktualisiert. Lade die Seite neu, um weiterzumachen."
      >
        <Button onClick={reload}>Neu laden</Button>
      </Panel>
    );
  }
  return (
    <Panel
      title="Etwas ist schiefgelaufen"
      text="Deine Daten sind lokal gespeichert und davon nicht betroffen. Lade die Seite neu oder geh zurück zur Startseite."
    >
      <Button onClick={reload}>Neu laden</Button>
      <Link to="/" className={buttonClassName({ variant: "secondary" })}>
        Zur Startseite
      </Link>
      {import.meta.env.DEV && error instanceof Error ? (
        <pre className="mt-4 max-w-full overflow-auto rounded-md bg-surface-sunken p-3 text-left text-xs">
          {error.stack}
        </pre>
      ) : null}
    </Panel>
  );
}
