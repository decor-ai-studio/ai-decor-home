import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type SelectionTool = "rect" | "quad" | "free";

type Point = { x: number; y: number };

export interface ImageSelectionCanvasHandle {
  clear: () => void;
  getMaskDataUrl: (width: number, height: number) => string | null;
  hasSelection: () => boolean;
}

interface ImageSelectionCanvasProps {
  tool: SelectionTool;
  onSelectionChange?: (selected: boolean) => void;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function smoothPath(points: Point[]) {
  if (points.length < 2) return "";
  let path = `M ${points[0]?.x ?? 0} ${points[0]?.y ?? 0}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    if (!point || !next) continue;
    path += ` Q ${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`;
  }
  const last = points.at(-1);
  if (last) path += ` L ${last.x} ${last.y} Z`;
  return path;
}

const ImageSelectionCanvas = forwardRef<ImageSelectionCanvasHandle, ImageSelectionCanvasProps>(
  ({ tool, onSelectionChange }, ref) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const drawing = useRef(false);
    const movingPoint = useRef<number | null>(null);
    const startPoint = useRef<Point | null>(null);
    const [points, setPoints] = useState<Point[]>([]);

    const selected = tool === "rect" ? points.length === 2 : tool === "quad" ? points.length === 4 : points.length > 2;

    useEffect(() => {
      onSelectionChange?.(selected);
    }, [onSelectionChange, selected]);

    const clear = useCallback(() => {
      setPoints([]);
      onSelectionChange?.(false);
    }, [onSelectionChange]);

    const localPoint = (event: ReactPointerEvent<SVGSVGElement>): Point => {
      const box = svgRef.current?.getBoundingClientRect();
      if (!box) return { x: 0, y: 0 };
      return {
        x: clamp((event.clientX - box.left) / box.width),
        y: clamp((event.clientY - box.top) / box.height),
      };
    };

    const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = localPoint(event);
      const handle = (event.target as SVGElement).dataset["point"];
      if (handle !== undefined) {
        movingPoint.current = Number(handle);
        return;
      }
      if (tool === "quad") {
        setPoints((current) => {
          return current.length >= 4 ? [point] : [...current, point];
        });
        return;
      }
      drawing.current = true;
      startPoint.current = point;
      setPoints(tool === "rect" ? [point, point] : [point]);
      onSelectionChange?.(false);
    };

    const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
      const point = localPoint(event);
      if (movingPoint.current !== null) {
        setPoints((current) => current.map((item, index) => (index === movingPoint.current ? point : item)));
        return;
      }
      if (!drawing.current) return;
      if (tool === "rect" && startPoint.current) {
        setPoints([startPoint.current, point]);
      } else if (tool === "free") {
        setPoints((current) => {
          const last = current.at(-1);
          if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.006) return current;
          return [...current, point];
        });
      }
    };

    const onPointerUp = () => {
      drawing.current = false;
      movingPoint.current = null;
      startPoint.current = null;
    };

    const shapePoints = useMemo(() => {
      if (tool !== "rect" || points.length < 2) return points;
      const first = points[0];
      const second = points[1];
      if (!first || !second) return [];
      return [
        { x: Math.min(first.x, second.x), y: Math.min(first.y, second.y) },
        { x: Math.max(first.x, second.x), y: Math.min(first.y, second.y) },
        { x: Math.max(first.x, second.x), y: Math.max(first.y, second.y) },
        { x: Math.min(first.x, second.x), y: Math.max(first.y, second.y) },
      ];
    }, [points, tool]);

    useImperativeHandle(ref, () => ({
      clear,
      hasSelection: () => selected,
      getMaskDataUrl: (width, height) => {
        if (!selected) return null;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return null;
        context.fillStyle = "rgba(16,185,129,1)";
        context.beginPath();
        const source = tool === "rect" ? shapePoints : points;
        const first = source[0];
        if (!first) return null;
        context.moveTo(first.x * width, first.y * height);
        if (tool === "free" && source.length > 2) {
          for (let index = 1; index < source.length - 1; index += 1) {
            const point = source[index];
            const next = source[index + 1];
            if (!point || !next) continue;
            context.quadraticCurveTo(
              point.x * width,
              point.y * height,
              ((point.x + next.x) / 2) * width,
              ((point.y + next.y) / 2) * height,
            );
          }
          const last = source.at(-1);
          if (last) context.lineTo(last.x * width, last.y * height);
        } else {
          source.slice(1).forEach((point) => context.lineTo(point.x * width, point.y * height));
        }
        context.closePath();
        context.fill();
        return canvas.toDataURL("image/png");
      },
    }), [clear, points, selected, shapePoints, tool]);

    const polygon = shapePoints.map((point) => `${point.x},${point.y}`).join(" ");
    const freePath = smoothPath(points);
    const handles = tool === "free" ? points.filter((_, index) => index % Math.max(1, Math.floor(points.length / 10)) === 0) : shapePoints;

    return (
      <svg
        ref={svgRef}
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full touch-none cursor-crosshair"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="منطقة التحديد"
      >
        <defs>
          <mask id="selection-cutout">
            <rect width="1" height="1" fill="white" />
            {tool === "free" ? <path d={freePath} fill="black" /> : <polygon points={polygon} fill="black" />}
          </mask>
        </defs>
        {selected && <rect width="1" height="1" className="fill-background/60" mask="url(#selection-cutout)" />}
        {tool === "free" ? (
          <path d={freePath} className="fill-primary/20 stroke-primary" strokeWidth="0.004" strokeDasharray="0.012 0.008" />
        ) : (
          <polygon points={polygon} className="fill-primary/20 stroke-primary" strokeWidth="0.004" strokeDasharray="0.012 0.008" />
        )}
        {handles.map((point, index) => {
          const originalIndex = tool === "free" ? points.indexOf(point) : index;
          return (
            <circle
              key={`${point.x}-${point.y}-${index}`}
              data-point={originalIndex}
              cx={point.x}
              cy={point.y}
              r="0.012"
              className="cursor-move fill-primary stroke-primary-foreground"
              strokeWidth="0.004"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    );
  },
);

ImageSelectionCanvas.displayName = "ImageSelectionCanvas";

export default ImageSelectionCanvas;