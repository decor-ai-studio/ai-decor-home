import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";

export function InstallBanner() {
  const { canInstall, isIos, isInstalled, isDismissed, install, dismiss } = usePwaInstall();

  if (isInstalled || isDismissed || (!canInstall && !isIos)) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg">
      <img src="/icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 rounded-lg" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">ثبّت تطبيق ديكور AI</p>
        <p className="text-muted-foreground">
          {canInstall
            ? "استخدمه كتطبيق على جهازك وحتى بدون إنترنت."
            : "اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»."}
        </p>
      </div>
      {canInstall && (
        <Button size="sm" onClick={install}>
          <Download className="h-4 w-4" />
          تثبيت
        </Button>
      )}
      <Button size="icon" variant="ghost" onClick={dismiss} aria-label="إغلاق">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
