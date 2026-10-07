import { WifiOff } from "lucide-react";
import { Badge } from "./Badge.tsx";
import { useOnlineStatus } from "./useOnlineStatus.ts";

const MESSAGE = "Keine Internetverbindung – deine Daten werden lokal gespeichert.";

/**
 * A header badge while the browser is offline. The app keeps working (data is
 * local-first); the badge only explains why sync or updates pause. The live
 * region is always mounted and visually hidden — a region that appears
 * together with its text is often not announced at all.
 */
export function OfflineIndicator() {
  const online = useOnlineStatus();
  return (
    <>
      <span role="status" className="sr-only">
        {online ? "" : `Offline. ${MESSAGE}`}
      </span>
      {online ? null : (
        <Badge variant="warning" title={MESSAGE} aria-hidden="true">
          <WifiOff className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Offline
        </Badge>
      )}
    </>
  );
}
