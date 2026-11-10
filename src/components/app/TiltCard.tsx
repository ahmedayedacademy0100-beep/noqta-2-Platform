import { cn } from "@/lib/utils";
import { useReducedMotion } from "framer-motion";
import { useRef, type PointerEvent, type ReactNode } from "react";

/**
 * Pointer-reactive 3D card: the surface tilts toward the cursor and a soft
 * highlight follows it. Motion is disabled for `prefers-reduced-motion`, and
 * the transform is written straight to the node so moving the pointer never
 * re-renders React.
 */
export function TiltCard({
  children,
  className,
  intensity = 9,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  /** Maximum rotation in degrees. */
  intensity?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (reduce || event.pointerType === "touch") return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    node.style.setProperty("--nq-rx", `${(-y * intensity).toFixed(2)}deg`);
    node.style.setProperty("--nq-ry", `${(x * intensity).toFixed(2)}deg`);
    node.style.setProperty("--nq-gx", `${((x + 0.5) * 100).toFixed(1)}%`);
    node.style.setProperty("--nq-gy", `${((y + 0.5) * 100).toFixed(1)}%`);
  };

  const reset = () => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--nq-rx", "0deg");
    node.style.setProperty("--nq-ry", "0deg");
  };

  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={reset}
      onPointerCancel={reset}
      className={cn("nq-tilt", glare && "nq-tilt-glare", className)}
    >
      {children}
    </div>
  );
}
