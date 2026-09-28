import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Paintbrush, Eraser, Undo2, Trash2, Settings2, Info } from "lucide-react";

export interface MaskCanvasHandle {
  getMaskDataUrl: () => string | null;
}

export interface MaskRegion {
  prompt: string;
  maskDataUrl: string;
}

interface MaskCanvasProps {
  imageUrl: string;
  accent: "emerald" | "blue" | "amber";
  onMaskChange?: (hasMask: boolean) => void;
}

type Tool = "brush" | "eraser";

const ACCENT_MAP = {
  emerald: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    activeBtn: "bg-emerald-600 hover:bg-emerald-500",
    sliderAccent: "accent-emerald-500",
    brushColor: "rgba(16, 185, 129, 0.45)",
  },
  blue: {
    text: "text-blue-400",
    bg: "bg-blue-500/15",
    border: "border-blue-500/30",
    activeBtn: "bg-blue-600 hover:bg-blue-500",
    sliderAccent: "accent-blue-500",
    brushColor: "rgba(59, 130, 246, 0.45)",
  },
  amber: {
    text: "text-amber-400",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    activeBtn: "bg-amber-600 hover:bg-amber-500",
    sliderAccent: "accent-amber-500",
    brushColor: "rgba(245, 158, 11, 0.45)",
  },
} as const;

const MaskCanvas = forwardRef<MaskCanvasHandle, MaskCanvasProps>(
  ({ imageUrl, accent, onMaskChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const isDrawing = useRef(false);
    const lastPoint = useRef<{ x: number; y: number } | null>(null);
    const historyRef = useRef<ImageData[]>([]);

    const [tool, setTool] = useState<Tool>("brush");
    const [brushSize, setBrushSize] = useState(30);
    const [hasMask, setHasMask] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    const s = ACCENT_MAP[accent];

    useImperativeHandle(ref, () => ({
      getMaskDataUrl: () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        return canvas.toDataURL("image/png");
      },
    }));

    const checkHasMask = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let hasContent = false;
      for (let i = 3; i < data.length; i += 4) {
        if ((data[i] ?? 0) > 0) {
          hasContent = true;
          break;
        }
      }
      setHasMask(hasContent);
      onMaskChange?.(hasContent);
    }, [onMaskChange]);

    const getCanvasPos = (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const drawLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      ctx.globalCompositeOperation = tool === "brush" ? "source-over" : "destination-out";
      ctx.strokeStyle = tool === "brush" ? s.brushColor : "rgba(0,0,0,1)";
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    };

    const saveHistory = () => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      if (historyRef.current.length >= 20) historyRef.current.shift();
      historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      isDrawing.current = true;
      lastPoint.current = getCanvasPos(e);
      saveHistory();
      const pos = lastPoint.current;
      const ctx = ctxRef.current;
      if (!ctx || !pos) return;
      ctx.globalCompositeOperation = tool === "brush" ? "source-over" : "destination-out";
      ctx.fillStyle = tool === "brush" ? s.brushColor : "rgba(0,0,0,1)";
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDrawing.current) return;
      const pos = getCanvasPos(e);
      if (lastPoint.current) drawLine(lastPoint.current, pos);
      lastPoint.current = pos;
    };

    const handlePointerUp = () => {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      lastPoint.current = null;
      checkHasMask();
    };

    const handleUndo = () => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      const prev = historyRef.current.pop();
      if (prev) {
        ctx.putImageData(prev, 0, 0);
        checkHasMask();
      }
    };

    const handleClear = () => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      saveHistory();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      checkHasMask();
    };

    useEffect(() => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctxRef.current = ctx;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setImageLoaded(true);
        onMaskChange?.(false);
        setHasMask(false);
      };
      img.src = imageUrl;
    }, [imageUrl, onMaskChange]);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Paintbrush className={`w-5 h-5 ${s.text}`} />
            <h4 className="font-semibold text-sm">تحديد المنطقة المراد تعديلها</h4>
          </div>
          <div className={`flex items-center gap-1.5 text-xs ${s.text} ${s.bg} border ${s.border} px-2.5 py-1 rounded-full`}>
            <Info className="w-3.5 h-3.5" />
            ارسم على الجزء اللي عايز تعدله
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5">
          <div className="flex gap-1.5">
            <button
              onClick={() => setTool("brush")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                tool === "brush" ? s.activeBtn + " text-white" : "bg-slate-800/60 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Paintbrush className="w-4 h-4" />
              فرشاة
            </button>
            <button
              onClick={() => setTool("eraser")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                tool === "eraser" ? s.activeBtn + " text-white" : "bg-slate-800/60 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Eraser className="w-4 h-4" />
              ممحاة
            </button>
          </div>

          <div className="h-6 w-px bg-slate-700/60" />

          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-slate-500" />
            <input
              type="range"
              min="5"
              max="80"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className={`w-24 h-1.5 rounded-full cursor-pointer ${s.sliderAccent}`}
            />
            <span className="text-xs text-slate-500 w-7 text-left">{brushSize}</span>
          </div>

          <div className="h-6 w-px bg-slate-700/60" />

          <button
            onClick={handleUndo}
            disabled={historyRef.current.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Undo2 className="w-4 h-4" />
            تراجع
          </button>
          <button
            onClick={handleClear}
            disabled={!hasMask}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800/60 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            مسح الكل
          </button>
        </div>

        <div ref={containerRef} className="relative rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900 select-none">
          {imageLoaded ? (
            <div className="relative">
              <img src={imageUrl} alt="صورة المعاينة" className="w-full block" draggable={false} />
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                style={{ opacity: tool === "brush" ? 0.7 : 1 }}
              />
            </div>
          ) : (
            <div className="aspect-video flex items-center justify-center text-slate-600 text-sm">
              جاري تحميل الصورة...
            </div>
          )}
        </div>

        {hasMask && (
          <div className={`flex items-center gap-2 text-xs ${s.text} animate-fade-in`}>
            <span className={`w-2 h-2 rounded-full bg-current animate-pulse`} />
            تم تحديد منطقة — التغيير هيطبق على الجزء المظلل فقط
          </div>
        )}
      </div>
    );
  }
);

MaskCanvas.displayName = "MaskCanvas";
export default MaskCanvas;
