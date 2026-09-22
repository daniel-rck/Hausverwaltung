import { useCallback, useEffect, useRef, useState } from "react";
import { Button, useConfirm, useToast } from "../../lib/ui/ui";

type SignatureCanvasProps = {
  label: string;
  value: string | undefined;
  onChange: (dataUrl: string | undefined) => void;
};

export function SignatureCanvas({ label, value, onChange }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const hasDrawnRef = useRef(false);
  const confirm = useConfirm();
  const toast = useToast();

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match CSS size for crisp drawing
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // If there's an existing value, draw it
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = value;
    }
  }, [value]);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  const getPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();

      if ("touches" in e) {
        const touch = e.touches[0];
        if (!touch) return null;
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
      }
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [],
  );

  const startDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const ctx = getCtx();
      const pos = getPos(e);
      if (!ctx || !pos) return;
      setIsDrawing(true);
      hasDrawnRef.current = true;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    },
    [getCtx, getPos],
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing) return;
      const ctx = getCtx();
      const pos = getPos(e);
      if (!ctx || !pos) return;
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    },
    [isDrawing, getCtx, getPos],
  );

  const endDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing) return;
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas && hasDrawnRef.current) {
        onChange(canvas.toDataURL("image/png"));
      }
    },
    [isDrawing, onChange],
  );

  const handleClear = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (value || hasDrawnRef.current) {
      const ok = await confirm({
        title: "Unterschrift löschen?",
        message: `Die Unterschrift „${label}“ wird entfernt und muss neu geleistet werden.`,
        confirmLabel: "Löschen",
        danger: true,
      });
      if (!ok) return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    hasDrawnRef.current = false;
    onChange(undefined);
    toast.success("Unterschrift gelöscht.");
  }, [onChange, confirm, toast, label, value]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-fg">{label}</span>
        <Button variant="dangerGhost" size="sm" onClick={() => void handleClear()}>
          Löschen
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={value ? `Unterschrift ${label} (vorhanden)` : `Unterschriftenfeld ${label}`}
        className="w-full h-32 border border-border rounded-lg bg-white cursor-crosshair touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      {!value && <p className="text-xs text-fg-subtle mt-1">Bitte hier unterschreiben</p>}
    </div>
  );
}
