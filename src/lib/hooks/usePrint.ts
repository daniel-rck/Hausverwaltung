import { useCallback, useState } from "react";

export function usePrint() {
  const [isPrinting, setIsPrinting] = useState(false);

  const print = useCallback(() => {
    setIsPrinting(true);
    requestAnimationFrame(() => {
      window.print();
      setIsPrinting(false);
    });
  }, []);

  return { isPrinting, print };
}
