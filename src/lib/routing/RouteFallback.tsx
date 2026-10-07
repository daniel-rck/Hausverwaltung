import { Spinner } from "../ui/Spinner.tsx";

/** Shown while the first route's lazy chunk loads. */
export function RouteFallback() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner size="lg" />
    </div>
  );
}
