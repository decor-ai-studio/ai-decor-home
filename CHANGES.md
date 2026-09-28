# التعديلات المضافة على المشروع الأصلي

- **إيقاف فيديو AI المدفوع:** `src/lib/features.ts` (`PAID_VIDEO_ENABLED = false`) و`/api/generate-video` يرفض بـ 410.
- **الفيديو الاقتصادي المحلي:** `src/lib/video/legoBuild.ts` + `music.ts` و`src/components/features/VisualStudio.tsx` (+ `FeatureShell.tsx`)
  - دمج خامات حقيقية أو مرفوعة، لمعان معدني، إضاءة متحركة، ظلال، شرارات، حركة كاميرا، مخطط شبحي، إنهاء بدون فواصل
  - شريط ختامي (اسم، هاتف، شعار)، مقاسات 16:9 / 9:16 / 1:1، تصدير MP4 (أو WebM)
  - اختيار الخامة تلقائيًا من `/api/build-sequence` (مسار جديد، مسجّل في `routeTree.gen.ts`)
- **تقليل تكلفة الصور:** `aiImage.ts` و`renderCache.ts` و`SignageStudio.tsx` (جودة medium افتراضيًا، high اختيارية، معاينة جزئية واحدة، حجم مخرَج محدد).
- **الحركة:** `src/components/OrbitSlides.tsx` شرائح طائرة تدور في دائرة مع ظلال متحركة، مركّبة في `LandingPage.tsx`.
- زر «استوديو الفيديو» في الصفحة الرئيسية يفتح الآن الاستوديو الاقتصادي. ملفات `VisionVideoStudio.tsx` و`legoVideo.ts` بقيت كما هي دون حذف.
