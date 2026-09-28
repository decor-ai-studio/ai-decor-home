import { useEffect, useRef } from "react";
import { Boxes, Film, type LucideIcon } from "lucide-react";
import claddingA from "@/assets/materials-cladding-a.jpg";
import claddingB from "@/assets/materials-cladding-b.jpg";
import signageA from "@/assets/materials-signage-a.jpg";
import signageB from "@/assets/materials-signage-b.jpg";

// Motion system for the landing page: slides "fly" around an invisible circle,
// each one bobbing in the air while its shadow slides over the floor below it.
// Everything is drawn locally with transforms (no network, no AI cost).

export type OrbitSlide = {
  id: string;
  title: string;
  hint: string;
  /** Photo for the slide. Without it the slide becomes a gradient card with an icon. */
  src?: string;
  icon?: LucideIcon;
  /** Tailwind gradient classes for icon cards. */
  tone?: string;
};

const DEFAULT_SLIDES: OrbitSlide[] = [
  { id: "cladding-a", title: "واجهات كلادنج عصرية", hint: "ألواح معدنية بخطوط نظيفة", src: claddingA },
  { id: "signage-a", title: "لافتات وحروف مضيئة", hint: "إضاءة LED بتفاصيل دقيقة", src: signageA },
  { id: "video", title: "فيديو تركيب الواجهة", hint: "قطعة قطعة بخامات حقيقية", icon: Film, tone: "from-fuchsia-600/70 to-indigo-700/70" },
  { id: "cladding-b", title: "مجموعة خامات الكلادنج", hint: "ألوان وملمس للاختيار", src: claddingB },
  { id: "signage-b", title: "تصميم لافتات احترافي", hint: "جاهز للطباعة والتنفيذ", src: signageB },
  { id: "materials", title: "مكتبة خامات وأسعار", hint: "قارن قبل ما تشتري", icon: Boxes, tone: "from-emerald-600/70 to-teal-700/70" },
];

interface OrbitSlidesProps {
  slides?: OrbitSlide[];
  /** Seconds for one full turn around the circle. */
  period?: number;
  className?: string;
}

export default function OrbitSlides({ slides = DEFAULT_SLIDES, period = 30, className = "" }: OrbitSlidesProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shadowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sheenRefs = useRef<(HTMLDivElement | null)[]>([]);
  const n = slides.length;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || n === 0) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = stage.clientWidth;
    let H = stage.clientHeight;
    let cw = 200;
    let ch = 136;
    let angle = 0;
    let speed = 1; // eases to 0 while the pointer hovers the stage
    let target = 1;
    let time = 0;
    let last = performance.now();
    let raf = 0;
    let visible = true;

    const layout = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      cw = Math.max(140, Math.min(270, W * 0.27));
      ch = cw * 0.68;
      for (let i = 0; i < n; i++) {
        const c = cardRefs.current[i];
        if (c) {
          c.style.width = `${cw}px`;
          c.style.height = `${ch}px`;
        }
        const sh = shadowRefs.current[i];
        if (sh) sh.style.width = `${cw}px`;
      }
    };

    const draw = () => {
      const cy = H * 0.4; // centre line of the orbit
      const rx = Math.max(0, W / 2 - cw * 0.42 - 6); // horizontal radius of the circle
      const ry = Math.min(H * 0.1, 36); // the circle seen slightly from above

      // floor ellipse that the shadows fall on (also shows the orbit path)
      const floor = floorRef.current;
      if (floor) {
        const fw = rx * 2 + cw * 0.9;
        const fh = ry * 2 * 0.9 + 60;
        floor.style.width = `${fw}px`;
        floor.style.height = `${fh}px`;
        floor.style.transform = `translate3d(${W / 2}px, ${cy + ch * 0.5 * 0.81 + 30}px, 0) translate(-50%, -50%)`;
      }

      for (let i = 0; i < n; i++) {
        const a = angle + (i * Math.PI * 2) / n;
        const s = Math.sin(a);
        const c = Math.cos(a);
        const d = (c + 1) / 2; // 1 = in front, 0 = at the back
        const scale = 0.62 + 0.38 * d;
        const x = W / 2 + s * rx; // centre of the stage + position on the circle
        const bob = Math.sin(time * 1.3 + i * 1.9) * 9; // "flying" up and down
        const y = cy + c * ry + bob;

        const card = cardRefs.current[i];
        if (card) {
          card.style.transform =
            `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) ` +
            `rotateY(${-s * 24}deg) rotateZ(${s * 2.5 + Math.sin(time * 0.9 + i) * 0.8}deg) scale(${scale})`;
          card.style.zIndex = String(10 + Math.round(d * 100));
          card.style.filter = `brightness(${0.62 + 0.38 * d})`;
        }

        const sheen = sheenRefs.current[i];
        if (sheen) sheen.style.transform = `translateX(${s * 90}%) skewX(-18deg)`;

        // shadow stays on the floor: it shrinks and fades as the card floats higher
        const lift = (9 - bob) / 18; // 0 = lowest, 1 = highest
        const shadow = shadowRefs.current[i];
        if (shadow) {
          const floorY = cy + c * ry + ch * 0.5 * scale + 30;
          const sx = x + 14 * scale; // light comes from the upper left
          shadow.style.transform =
            `translate3d(${sx}px, ${floorY}px, 0) translate(-50%, -50%) scale(${scale * (1 - 0.18 * lift)}, ${scale * (1 - 0.1 * lift)})`;
          shadow.style.opacity = String((0.3 + 0.4 * d) * (1 - 0.35 * lift));
        }
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      speed += (target - speed) * Math.min(1, dt * 4);
      angle += (dt * speed * Math.PI * 2) / period;
      if (visible) draw();
      raf = requestAnimationFrame(frame);
    };

    layout();
    draw();

    const ro = new ResizeObserver(() => {
      layout();
      draw();
    });
    ro.observe(stage);

    if (reduce) {
      // no motion for people who asked for less of it: keep a single static frame
      return () => ro.disconnect();
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
    });
    io.observe(stage);

    const onEnter = () => (target = 0);
    const onLeave = () => (target = 1);
    stage.addEventListener("pointerenter", onEnter);
    stage.addEventListener("pointerleave", onLeave);

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      stage.removeEventListener("pointerenter", onEnter);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, [n, period]);

  return (
    <div
      ref={stageRef}
      role="region"
      aria-label="عرض شرائح متحرك لمميزات المنصة"
      className={`relative w-full mx-auto select-none ${className}`}
      style={{ height: "clamp(280px, 42vw, 420px)", perspective: "1200px" }}
      dir="ltr"
    >
      {/* floor + orbit path */}
      <div
        ref={floorRef}
        aria-hidden
        className="absolute left-0 top-0 rounded-[50%] border border-white/5"
        style={{
          background: "radial-gradient(ellipse at center, rgba(51,65,85,0.55) 0%, rgba(15,23,42,0.35) 55%, rgba(2,6,23,0) 75%)",
        }}
      />

      {/* shadows first (always under every slide) */}
      {slides.map((s, i) => (
        <div
          key={`sh-${s.id}`}
          ref={(el) => {
            shadowRefs.current[i] = el;
          }}
          aria-hidden
          className="absolute left-0 top-0 pointer-events-none"
          style={{
            height: 26,
            zIndex: 1,
            background: "radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0) 72%)",
            filter: "blur(3px)",
            willChange: "transform, opacity",
          }}
        />
      ))}

      {slides.map((s, i) => {
        const Icon = s.icon;
        return (
          <div
            key={s.id}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="absolute left-0 top-0 rounded-2xl overflow-hidden border border-white/10 bg-slate-900 shadow-2xl"
            style={{ willChange: "transform, filter" }}
            dir="rtl"
          >
            {s.src ? (
              <img src={s.src} alt={s.title} draggable={false} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-br ${s.tone ?? "from-slate-700 to-slate-900"} flex items-center justify-center`}>
                {Icon && <Icon className="w-12 h-12 text-white/85" />}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 p-3 pt-8 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent text-right">
              <p className="text-sm font-bold text-white leading-tight">{s.title}</p>
              <p className="text-[11px] text-slate-300/80 mt-0.5">{s.hint}</p>
            </div>
            {/* moving light glint that slides across the slide as it turns */}
            <div
              ref={(el) => {
                sheenRefs.current[i] = el;
              }}
              aria-hidden
              className="absolute inset-y-0 w-1/3 pointer-events-none"
              style={{
                left: "33%",
                background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0) 100%)",
                mixBlendMode: "soft-light",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
