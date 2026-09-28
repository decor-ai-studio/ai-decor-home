import { ExportDialog } from "@/components/ExportDialog";
import ImageSelectionCanvas, {
  type ImageSelectionCanvasHandle,
  type SelectionTool,
} from "@/components/ImageSelectionCanvas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { aiEditImage, aiErrorMessage, type DesignMode } from "@/lib/aiImage";
import { useCallback, useEffect, useRef, useState, type ImgHTMLAttributes, type PointerEvent as RPE } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle, BoxSelect, Crop, Download, FlipHorizontal, Hand, Loader2, Maximize2,
  MousePointer2, Pencil, Redo2, RotateCcw, RotateCw, Save, Sparkles, SquareDashed,
  Undo2, X, ZoomIn, ZoomOut,
} from "lucide-react";

interface Rect { x: number; y: number; w: number; h: number } // normalized 0..1 of image

interface ViewerProps {
  src: string;
  alt?: string | undefined;
  onClose: () => void;
  onSave?: ((dataUrl: string) => void) | undefined;
  editMode?: DesignMode;
}

const FILTERS = [
  { key: "brightness", label: "السطوع", min: 50, max: 150 },
  { key: "contrast", label: "التباين", min: 50, max: 150 },
  { key: "saturate", label: "التشبّع", min: 0, max: 200 },
] as const;
type FKey = (typeof FILTERS)[number]["key"];

export function ImageViewer({ src, alt, onClose, onSave, editMode = "business" }: ViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<"pan" | "select">("pan");
  const [selectionTool, setSelectionTool] = useState<SelectionTool>("rect");
  const [hasSelection, setHasSelection] = useState(false);
  const [sel, setSel] = useState<Rect | null>(null);
  const [rot, setRot] = useState(0);
  const [flip, setFlip] = useState(false);
  const [f, setF] = useState<Record<FKey, number>>({ brightness: 100, contrast: 100, saturate: 100 });
  const [current, setCurrent] = useState(src);
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [editing, setEditing] = useState(false);
  const [partial, setPartial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const selectionRef = useRef<ImageSelectionCanvasHandle>(null);
  const drag = useRef<{ sx: number; sy: number; px: number; py: number; nx?: number; ny?: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(8, z * 1.25));
      if (e.key === "-") setZoom((z) => Math.max(0.25, z / 1.25));
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const filterCss = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%)`;
  const clearSelection = () => {
    setSel(null);
    selectionRef.current?.clear();
    setHasSelection(false);
  };
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); setRot(0); setFlip(false); clearSelection(); setF({ brightness: 100, contrast: 100, saturate: 100 }); };

  const norm = (e: RPE) => {
    const image = imgRef.current;
    if (!image) return { x: 0, y: 0 };
    const r = image.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  const onDown = (e: RPE<HTMLDivElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (mode === "select" && imgRef.current && rot % 360 === 0) {
      const p = norm(e);
      drag.current = { sx: e.clientX, sy: e.clientY, px: 0, py: 0, nx: p.x, ny: p.y };
      setSel({ x: p.x, y: p.y, w: 0, h: 0 });
    } else {
      drag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    }
  };
  const onMove = (e: RPE<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.nx !== undefined && d.ny !== undefined) {
      const p = norm(e);
      setSel({ x: Math.min(d.nx, p.x), y: Math.min(d.ny, p.y), w: Math.abs(p.x - d.nx), h: Math.abs(p.y - d.ny) });
    } else {
      setPan({ x: d.px + e.clientX - d.sx, y: d.py + e.clientY - d.sy });
    }
  };
  const onUp = () => {
    drag.current = null;
    setSel((selection) => {
      const next = selection && selection.w * selection.h >= 0.0004 ? selection : null;
      setHasSelection(Boolean(next));
      return next;
    });
  };

  const onWheel = (e: React.WheelEvent) => {
    setZoom((z) => Math.min(8, Math.max(0.25, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12))));
  };

  /** Bake filters, rotation, flip and optional crop into a new image. */
  const bake = useCallback(async (crop: Rect | null) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = current; });
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (crop) { sx = crop.x * sw; sy = crop.y * sh; sw = crop.w * sw; sh = crop.h * sh; }
    const quarter = ((rot % 360) + 360) % 180 === 90;
    const c = document.createElement("canvas");
    c.width = Math.round(quarter ? sh : sw);
    c.height = Math.round(quarter ? sw : sh);
    const ctx = c.getContext("2d")!;
    ctx.filter = filterCss;
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
    return c.toDataURL("image/png");
  }, [current, rot, flip, filterCss]);

  const applyCrop = async () => {
    if (!sel) return;
    const url = await bake(sel);
    setHistory((items) => [...items, current]);
    setFuture([]);
    setCurrent(url); setSel(null); setRot(0); setFlip(false); setF({ brightness: 100, contrast: 100, saturate: 100 }); setZoom(1); setPan({ x: 0, y: 0 });
  };
  const download = async () => {
    const a = document.createElement("a");
    a.href = await bake(null); a.download = "image-edited.png"; a.click();
  };
  const [exportSrc, setExportSrc] = useState<string | null>(null);
  const save = async () => { onSave?.(await bake(null)); onClose(); };

  const undo = () => {
    setHistory((items) => {
      const previous = items.at(-1);
      if (!previous) return items;
      setFuture((next) => [current, ...next]);
      setCurrent(previous);
      clearSelection();
      return items.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((items) => {
      const next = items[0];
      if (!next) return items;
      setHistory((previous) => [...previous, current]);
      setCurrent(next);
      clearSelection();
      return items.slice(1);
    });
  };

  const applyAiEdit = async () => {
    if (!prompt.trim() || editing) return;
    const sourceBeforeEdit = current;
    setError(null);
    setEditing(true);
    setPartial(false);
    try {
      const prepared = await bake(null);
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("تعذر تجهيز الصورة"));
        image.src = prepared;
      });
      let mask = selectionRef.current?.getMaskDataUrl(image.naturalWidth, image.naturalHeight) ?? null;
      if (selectionTool === "rect" && sel) {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (context) {
          context.fillStyle = "rgba(16,185,129,1)";
          context.fillRect(sel.x * canvas.width, sel.y * canvas.height, sel.w * canvas.width, sel.h * canvas.height);
          mask = canvas.toDataURL("image/png");
        }
      }
      const result = await aiEditImage({
        imageUrl: prepared,
        prompt: prompt.trim(),
        mode: editMode,
        maskDataUrl: mask,
        onFrame: (dataUrl, isFinal) => {
          setPartial(!isFinal);
          setCurrent(dataUrl);
        },
      });
      setHistory((items) => [...items, prepared]);
      setFuture([]);
      setCurrent(result.outputDataUrl);
      setPrompt("");
      setRot(0);
      setFlip(false);
      setF({ brightness: 100, contrast: 100, saturate: 100 });
      clearSelection();
    } catch (reason) {
      setCurrent(sourceBeforeEdit);
      setError(aiErrorMessage(reason));
    } finally {
      setPartial(false);
      setEditing(false);
    }
  };

  const Btn = ({ onClick, active, label, children }: { onClick: () => void; active?: boolean; label: string; children: React.ReactNode }) => (
    <button type="button" title={label} aria-label={label} onClick={onClick}
      className={`p-2 rounded-lg border transition-colors ${active ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-300" : "bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white"}`}>
      {children}
    </button>
  );

  return createPortal(
    <div dir="rtl" className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm flex flex-col" role="dialog" aria-modal="true" aria-label="عارض الصورة">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-800">
        <Btn label="تحريك" active={mode === "pan"} onClick={() => setMode("pan")}><Hand className="w-4 h-4" /></Btn>
        <Btn label="تحديد منطقة" active={mode === "select"} onClick={() => { setMode("select"); setRot(0); setSel(null); }}><SquareDashed className="w-4 h-4" /></Btn>
        {sel && <Btn label="قص التحديد" onClick={applyCrop}><Crop className="w-4 h-4" /></Btn>}
        <span className="w-px h-6 bg-slate-800 mx-1" />
        <Btn label="تكبير" onClick={() => setZoom((z) => Math.min(8, z * 1.25))}><ZoomIn className="w-4 h-4" /></Btn>
        <Btn label="تصغير" onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))}><ZoomOut className="w-4 h-4" /></Btn>
        <Btn label="ملاءمة" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><Maximize2 className="w-4 h-4" /></Btn>
        <span className="text-xs text-slate-400 tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Btn label="تدوير يمين" onClick={() => { setSel(null); setRot((r) => r + 90); }}><RotateCw className="w-4 h-4" /></Btn>
        <Btn label="قلب أفقي" active={flip} onClick={() => setFlip((v) => !v)}><FlipHorizontal className="w-4 h-4" /></Btn>
        <Btn label="تصفير" onClick={reset}><RotateCcw className="w-4 h-4" /></Btn>
        <Btn label="تراجع" onClick={undo}><Undo2 className="w-4 h-4" /></Btn>
        <Btn label="إعادة" onClick={redo}><Redo2 className="w-4 h-4" /></Btn>
        <div className="flex-1" />
        {onSave && (
          <button type="button" onClick={save} className="px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-medium flex items-center gap-1.5">
            <Save className="w-4 h-4" /> اعتماد التعديل
          </button>
        )}
        <button type="button" onClick={async () => setExportSrc(await bake(null))} className="px-3 py-2 rounded-lg border border-slate-700 text-slate-200 text-sm">قوالب التصدير</button>
        <Btn label="تنزيل" onClick={download}><Download className="w-4 h-4" /></Btn>
        <Btn label="إغلاق" onClick={onClose}><X className="w-4 h-4" /></Btn>
      </div>

      <div className="flex-1 flex min-h-0 flex-col md:flex-row">
        <div
          className={`flex-1 overflow-hidden relative flex items-center justify-center select-none touch-none ${mode === "select" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
          onPointerDown={mode === "pan" || selectionTool === "rect" ? onDown : undefined}
          onPointerMove={mode === "pan" || selectionTool === "rect" ? onMove : undefined}
          onPointerUp={mode === "pan" || selectionTool === "rect" ? onUp : undefined}
          onWheel={onWheel}
          onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2.5))}
        >
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: drag.current ? "none" : "transform 120ms ease-out" }} className="relative">
            <img
              ref={imgRef} src={current} alt={alt ?? "صورة"} draggable={false}
              style={{ filter: filterCss, transform: `rotate(${rot}deg) scaleX(${flip ? -1 : 1})` }}
              className={`max-w-[96vw] max-h-[58vh] md:max-w-[70vw] md:max-h-[78vh] object-contain block transition-[filter] duration-500 ${partial ? "blur-2xl" : "blur-0"}`}
            />
            {sel && (
              <div className="absolute border-2 border-dashed border-emerald-400 bg-emerald-400/10 pointer-events-none"
                style={{ left: `${sel.x * 100}%`, top: `${sel.y * 100}%`, width: `${sel.w * 100}%`, height: `${sel.h * 100}%`, boxShadow: "0 0 0 9999px rgba(2,6,23,0.55)" }} />
            )}
            {mode === "select" && selectionTool !== "rect" && (
              <ImageSelectionCanvas
                key={`${current}-${selectionTool}`}
                ref={selectionRef}
                tool={selectionTool}
                onSelectionChange={setHasSelection}
              />
            )}
          </div>
          <p className="absolute bottom-3 inset-x-0 text-center text-[11px] text-slate-500 pointer-events-none">
            عجلة الماوس للتكبير · اسحب للتحريك · نقرتين للتكبير السريع · Esc للإغلاق
          </p>
        </div>

        <aside className="w-full md:w-72 border-t md:border-t-0 md:border-r border-slate-800 p-4 space-y-4 overflow-y-auto max-h-[42vh] md:max-h-none">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-200">تعديل بالذكاء الاصطناعي</h4>
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="اكتب ما تريد تغييره في الجزء المحدد"
              className="min-h-24 resize-none bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
            />
            <Button className="w-full" onClick={applyAiEdit} disabled={!prompt.trim() || editing}>
              {editing ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {editing ? "جاري تنفيذ التعديل..." : "تنفيذ التعديل"}
            </Button>
            {error && <p className="flex gap-2 text-xs text-red-400"><AlertCircle className="size-4 shrink-0" />{error}</p>}
          </div>

          <div className="space-y-2 border-t border-slate-800 pt-4">
            <h4 className="text-sm font-semibold text-slate-200">شكل التحديد</h4>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { id: "rect", label: "مستطيل", icon: BoxSelect },
                { id: "quad", label: "٤ زوايا", icon: MousePointer2 },
                { id: "free", label: "حر", icon: Pencil },
              ] as const).map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  variant={selectionTool === id ? "default" : "outline"}
                  size="sm"
                  className="h-auto min-h-14 flex-col gap-1 px-1"
                  onClick={() => {
                    setSelectionTool(id);
                    setMode("select");
                    setRot(0);
                    clearSelection();
                  }}
                >
                  <Icon />
                  <span>{label}</span>
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={clearSelection} disabled={!hasSelection && !sel}>
              <X /> مسح التحديد
            </Button>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              في وضع الأربع زوايا اضغط أربع مرات ثم اسحب النقاط. في الوضع الحر ارسم حول المنطقة واسحب النقاط لضبط المنحنى.
            </p>
          </div>

          <h4 className="text-sm font-semibold text-slate-200">تعديل سريع</h4>
          {FILTERS.map((s) => (
            <label key={s.key} className="block space-y-1">
              <span className="flex justify-between text-[11px] text-slate-400">{s.label}<span className="tabular-nums">{f[s.key]}%</span></span>
              <input type="range" min={s.min} max={s.max} value={f[s.key]}
                onChange={(e) => setF((p) => ({ ...p, [s.key]: Number(e.target.value) }))}
                className="w-full accent-emerald-500 h-1.5" />
            </label>
          ))}
          <p className="text-[11px] text-slate-500 leading-relaxed">
            اختر "تحديد منطقة" واسحب على الصورة لتحديد جزء، ثم اضغط أيقونة القص لعزله.
          </p>
        </aside>
      </div>
      {exportSrc && <ExportDialog src={exportSrc} kind="image" onClose={() => setExportSrc(null)} />}
    </div>,
    document.body,
  );
}

type ZoomableProps = ImgHTMLAttributes<HTMLImageElement> & { src: string; onSave?: (dataUrl: string) => void; editMode?: DesignMode };

/** Drop-in <img> that opens the full-screen viewer/editor on click. */
export function ZoomableImage({ onSave, editMode, className, ...img }: ZoomableProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img
        {...img}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="اضغط للتكبير والتعديل"
        className={`${className ?? ""} cursor-zoom-in`}
      />
      {open && (
        <ImageViewer
          src={img.src}
          alt={img.alt}
          {...(onSave ? { onSave } : {})}
          {...(editMode ? { editMode } : {})}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
