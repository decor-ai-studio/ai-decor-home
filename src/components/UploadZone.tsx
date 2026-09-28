import { ZoomableImage } from "@/components/ImageViewer";
import { useRef, useState, useEffect, type ReactNode } from "react";
import { UploadCloud, ImageIcon, Loader2, Sparkles, AlertCircle, Camera, X } from "lucide-react";

interface UploadZoneProps {
  accent: "emerald" | "blue" | "amber";
  onGenerate: () => void;
  generating?: boolean | undefined;
  prompt: string;
  setPrompt: (v: string) => void;
  promptPlaceholder?: string | undefined;
  generateLabel?: string | undefined;
  imageUrl?: string | undefined;
  onImageChange?: ((url: string | null) => void) | undefined;
  children?: ReactNode | undefined;
}

const ACCENT: Record<
  UploadZoneProps["accent"],
  {
    btn: string;
    dragBorder: string;
    iconBox: string;
    iconText: string;
    focusBorder: string;
    errorBorder: string;
    softBtn: string;
  }
> = {
  emerald: {
    btn: "bg-emerald-600 hover:bg-emerald-500",
    dragBorder: "border-emerald-500 bg-emerald-500/5",
    iconBox: "bg-emerald-500/10 border-emerald-500/20",
    iconText: "text-emerald-400",
    focusBorder: "focus:border-emerald-500",
    errorBorder: "border-red-500/60",
    softBtn: "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10",
  },
  blue: {
    btn: "bg-blue-600 hover:bg-blue-500",
    dragBorder: "border-blue-500 bg-blue-500/5",
    iconBox: "bg-blue-500/10 border-blue-500/20",
    iconText: "text-blue-400",
    focusBorder: "focus:border-blue-500",
    errorBorder: "border-red-500/60",
    softBtn: "border-blue-500/30 text-blue-300 hover:bg-blue-500/10",
  },
  amber: {
    btn: "bg-amber-600 hover:bg-amber-500",
    dragBorder: "border-amber-500 bg-amber-500/5",
    iconBox: "bg-amber-500/10 border-amber-500/20",
    iconText: "text-amber-400",
    focusBorder: "focus:border-amber-500",
    errorBorder: "border-red-500/60",
    softBtn: "border-amber-500/30 text-amber-300 hover:bg-amber-500/10",
  },
};

const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];

export default function UploadZone({
  accent,
  onGenerate,
  generating = false,
  prompt,
  setPrompt,
  promptPlaceholder = "اكتب ما تريد تعديله هنا...",
  generateLabel = "توليد التصميم",
  imageUrl,
  onImageChange,
  children,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const s = ACCENT[accent];

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  // Release camera + object URL when the component unmounts
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("الكاميرا غير مدعومة في هذا المتصفح");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setError("تعذر الوصول إلى الكاميرا — يرجى السماح بالأذونات");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setFileName("صورة الكاميرا.png");
      onImageChange?.(url);
      stopCamera();
    }, "image/png");
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("صيغة غير مدعومة — استخدم JPG أو PNG فقط");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("حجم الصورة أكبر من 20 ميجابايت — استخدم صورة أصغر");
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setFileName(file.name);
    onImageChange?.(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!generating && (prompt.trim() || imageUrl)) {
        onGenerate();
      }
    }
  };

  const hasImage = !!imageUrl;
  const canGenerate = !generating && (prompt.trim().length > 0 || hasImage);

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 ${
          error ? s.errorBorder : dragging ? s.dragBorder : "border-slate-700 bg-slate-950/50 hover:border-slate-600"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
        />
        <div className="flex flex-col items-center gap-3">
          <div className={`w-14 h-14 rounded-2xl ${s.iconBox} border flex items-center justify-center ${s.iconText}`}>
            {hasImage ? <ImageIcon className="w-7 h-7" /> : <UploadCloud className="w-7 h-7" />}
          </div>
          {fileName ? (
            <div>
              <p className="text-white font-medium">{fileName}</p>
              <p className="text-slate-500 text-xs mt-1">انقر لتغيير الصورة</p>
            </div>
          ) : (
            <div>
              <p className="text-slate-300 font-medium">اسحب وأفلت صورة الواجهة أو الغرفة هنا، أو انقر للرفع</p>
              <p className="text-slate-500 text-xs mt-1.5">تدعم صيغ JPG و PNG — بحد أقصى 20 ميجابايت</p>
            </div>
          )}
        </div>
      </div>

      {/* Camera capture */}
      {!cameraActive && (
        <button
          type="button"
          onClick={startCamera}
          className={`w-full flex items-center justify-center gap-2 border rounded-xl px-4 py-3 text-sm font-medium bg-slate-950/40 transition-colors ${s.softBtn}`}
        >
          <Camera className="w-4 h-4" />
          التقاط صورة بالكاميرا
        </button>
      )}

      {cameraActive && (
        <div className="relative rounded-xl overflow-hidden border border-slate-700/60 bg-black animate-fade-in">
          <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-72 object-contain" />
          <button
            type="button"
            onClick={stopCamera}
            aria-label="إغلاق الكاميرا"
            className="absolute top-2 left-2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-0 inset-x-0 flex justify-center p-3 bg-gradient-to-t from-black/70 to-transparent">
            <button
              type="button"
              onClick={capturePhoto}
              className={`${s.btn} px-6 py-2.5 rounded-xl font-semibold text-white flex items-center gap-2 transition-all`}
            >
              <Camera className="w-4 h-4" />
              التقاط
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Uploaded image thumbnail */}
      {hasImage && !error && (
        <div className="relative rounded-xl overflow-hidden border border-slate-700/60 animate-fade-in">
          <ZoomableImage src={imageUrl} alt="الصورة المرفوعة" className="w-full max-h-48 object-cover" />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
            <span className="text-xs text-slate-300 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              الصورة جاهزة للتعديل
            </span>
          </div>
        </div>
      )}

      {children}

      {/* Prompt + Generate */}
      <div className="space-y-2.5">
        <label className="text-sm font-medium text-slate-300">
          اكتب طلبك بالعامية المصرية — هنحلله ونطبقه على الصورة
        </label>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={promptPlaceholder}
            rows={2}
            className={`flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none transition-colors resize-none ${s.focusBorder}`}
          />
          <button
            onClick={onGenerate}
            disabled={!canGenerate}
            className={`${s.btn} px-6 py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap sm:self-end`}
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري التوليد...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                {generateLabel}
              </>
            )}
          </button>
        </div>
        {!hasImage && !prompt.trim() && (
          <p className="text-xs text-slate-600">ارفع صورة أو اكتب وصف واضغط Enter للبدء</p>
        )}
      </div>
    </div>
  );
}
