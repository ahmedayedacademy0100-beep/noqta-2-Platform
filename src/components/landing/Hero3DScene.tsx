import { Mascot } from "@/components/student/Mascot";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "framer-motion";
import { CheckCircle2, Flame, Sparkles, Star, Zap } from "lucide-react";
import { useEffect, useRef } from "react";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * The landing hero stage.
 *
 * A single CSS 3D scene made of stacked layers: a perspective floor, a mock
 * quiz card, floating reward badges and the Noqta mascot, each at its own
 * translateZ depth. Pointer movement tilts the whole world, and scrolling the
 * hero pushes every layer up at a different rate, so the scene reads as one
 * solid space instead of a flat collage.
 *
 * Motion is driven by one rAF loop that writes transforms directly to the
 * nodes (no React re-renders), and everything is turned off for
 * `prefers-reduced-motion`.
 */
export function Hero3DScene() {
  const { t, pick } = useI18n();
  const reduce = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduce) return;
    const stage = stageRef.current;
    const world = worldRef.current;
    if (!stage || !world) return;

    const layers = Array.from(stage.querySelectorAll<HTMLElement>("[data-depth]"));
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let targetScroll = 0;
    let currentScroll = 0;
    let frame = 0;
    let running = false;

    const tick = () => {
      currentX += (targetX - currentX) * 0.075;
      currentY += (targetY - currentY) * 0.075;
      currentScroll += (targetScroll - currentScroll) * 0.1;

      world.style.transform = `rotateX(${(-currentY * 5.5).toFixed(2)}deg) rotateY(${(currentX * 7).toFixed(2)}deg) scale(${(1 - Math.abs(currentScroll) * 0.05).toFixed(3)})`;

      for (const layer of layers) {
        const depth = Number(layer.dataset.depth ?? "0");
        const scrollRate = Number(layer.dataset.scroll ?? "0");
        const x = currentX * depth * 1.7;
        const y = currentY * depth * 1.25 + currentScroll * scrollRate;
        layer.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${depth}px)`;
      }

      const settled =
        Math.abs(targetX - currentX) < 0.0015 &&
        Math.abs(targetY - currentY) < 0.0015 &&
        Math.abs(targetScroll - currentScroll) < 0.0015;

      if (settled) {
        running = false;
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(tick);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const rect = stage.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      targetX = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
      targetY = clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
      start();
    };

    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
      start();
    };

    const onScroll = () => {
      const rect = stage.getBoundingClientRect();
      targetScroll = clamp(-rect.top / Math.max(rect.height * 1.6, 1), -0.6, 1);
      start();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, [reduce]);

  return (
    <div
      ref={stageRef}
      aria-hidden
      className="nq-stage relative mx-auto w-full max-w-[480px] select-none"
    >
      <div ref={worldRef} className="nq-stage-world relative">
        {/* ------------------------------- Deep ------------------------------- */}
        <div data-depth="0" data-scroll="26" className="nq-stage-layer absolute inset-0">
          <span className="absolute -top-16 start-4 size-64 rounded-full bg-nq-violet/45 blur-3xl animate-drift" />
          <span className="absolute -bottom-20 end-0 size-72 rounded-full bg-nq-turquoise/30 blur-3xl animate-drift [animation-delay:1.8s]" />
          <span className="absolute start-1/3 top-1/3 size-40 rounded-full bg-nq-blue/30 blur-3xl animate-drift [animation-delay:0.9s]" />
        </div>

        <div
          data-depth="10"
          data-scroll="16"
          className="nq-stage-layer absolute inset-x-4 top-6 bottom-10 opacity-80"
        >
          <span className="nq-floor absolute inset-0" />
        </div>

        {/* Orbit ring behind the card. */}
        <div
          data-depth="16"
          data-scroll="20"
          className="nq-stage-layer absolute inset-0 grid place-items-center"
        >
          <svg viewBox="0 0 420 420" className="size-[112%] max-w-none opacity-60">
            <circle
              cx="210"
              cy="210"
              r="186"
              fill="none"
              stroke="url(#nq-orbit)"
              strokeWidth="1.5"
              strokeDasharray="6 14"
              className="animate-[spin_46s_linear_infinite]"
              style={{ transformOrigin: "210px 210px" }}
            />
            <defs>
              <linearGradient id="nq-orbit" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34D6C8" stopOpacity="0.9" />
                <stop offset="55%" stopColor="#3478F6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#FFC94A" stopOpacity="0.75" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* ------------------------------- Card ------------------------------- */}
        <div
          data-depth="26"
          data-scroll="34"
          className="nq-stage-layer relative mx-auto w-[92%] max-w-[360px] pt-8 pb-28"
        >
          <div className="relative rounded-[30px] border border-white/25 bg-white/95 p-5 text-nq-navy shadow-[0_50px_90px_-45px_rgb(3_8_26/0.85)] backdrop-blur-xl dark:border-white/10 dark:bg-card dark:text-foreground">
            <span
              className="pointer-events-none absolute inset-x-6 -top-2 h-6 rounded-full bg-white/50 blur-xl"
              aria-hidden
            />
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-nq-blue/10 px-2.5 py-1 text-[10px] font-extrabold text-nq-blue dark:text-primary">
                <Sparkles className="size-3" aria-hidden />
                {t("landing.scene.today")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[10px] font-bold text-muted-foreground">
                <Flame className="size-3 text-nq-coral" aria-hidden />
                00:24
              </span>
            </div>

            <p className="mt-4 text-base leading-6 font-extrabold">
              {pick("What is 7 × 8?", "كم يساوي ٧ × ٨؟")}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {["54", "56", "58", "64"].map((option) => (
                <span
                  key={option}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-center text-sm font-bold tabular-nums transition-colors",
                    option === "56"
                      ? "border-emerald-400/70 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"
                      : "border-border/70 bg-background/80 text-muted-foreground",
                  )}
                >
                  {option}
                  {option === "56" ? (
                    <CheckCircle2 className="ms-1 inline size-3.5" aria-hidden />
                  ) : null}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="nq-gradient h-full w-3/4 rounded-full" />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground">75%</span>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-nq-blue to-nq-violet px-3 py-2 text-white">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold">
                <Zap className="size-3.5" aria-hidden /> {t("landing.scene.xp")}
              </span>
              <span className="text-[11px] font-extrabold">+25 XP</span>
            </div>
          </div>
        </div>

        {/* --------------------------- Level medallion ------------------------ */}
        <div
          data-depth="58"
          data-scroll="52"
          className="nq-stage-layer absolute end-0 top-2 hidden sm:block"
        >
          <div className="relative grid size-[104px] place-items-center rounded-full bg-gradient-to-br from-nq-yellow via-[#F7B733] to-[#E8720C] p-1.5 shadow-[0_26px_50px_-24px_rgb(232_114_12/0.9)]">
            <div className="grid size-full place-items-center rounded-full bg-nq-navy/85 text-center text-white">
              <div>
                <p className="text-[8px] font-bold tracking-[0.18em] text-white/60 uppercase">
                  {t("landing.scene.level")}
                </p>
                <p className="text-2xl leading-none font-black tabular-nums">12</p>
              </div>
            </div>
            <span
              aria-hidden
              className="absolute -inset-2 rounded-full border border-white/25"
            />
          </div>
        </div>

        {/* ------------------------------ Streak chip ------------------------- */}
        <div
          data-depth="44"
          data-scroll="44"
          className="nq-stage-layer absolute bottom-12 end-0 z-20 flex items-center gap-2 rounded-2xl border border-white/25 bg-white/95 px-3 py-2 shadow-[0_24px_46px_-26px_rgb(3_8_26/0.8)] backdrop-blur-sm dark:bg-card sm:-end-4"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-nq-coral/15 text-nq-coral">
            <Flame className="size-4" aria-hidden />
          </span>
          <span className="text-[11px] font-extrabold">{t("landing.scene.streak")}</span>
        </div>

        {/* -------------------------------- Medal ----------------------------- */}
        <div
          data-depth="52"
          data-scroll="38"
          className="nq-stage-layer absolute -start-2 top-16 hidden md:block"
        >
          <svg viewBox="0 0 120 120" className="size-24 drop-shadow-[0_18px_26px_rgb(3_8_26/0.55)]">
            <defs>
              <linearGradient id="nq-medal-face" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FFE7A3" />
                <stop offset="45%" stopColor="#FFC94A" />
                <stop offset="100%" stopColor="#E8951A" />
              </linearGradient>
              <linearGradient id="nq-medal-rim" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.15" />
              </linearGradient>
              <linearGradient id="nq-medal-ribbon" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7957E8" />
                <stop offset="100%" stopColor="#3478F6" />
              </linearGradient>
            </defs>
            <path d="M38 4h20l-8 34H30z" fill="url(#nq-medal-ribbon)" opacity="0.9" />
            <path d="M82 4H62l8 34h20z" fill="url(#nq-medal-ribbon)" opacity="0.7" />
            <circle cx="60" cy="72" r="34" fill="#B7791F" opacity="0.35" />
            <circle cx="60" cy="68" r="34" fill="url(#nq-medal-face)" />
            <circle cx="60" cy="68" r="27" fill="none" stroke="url(#nq-medal-rim)" strokeWidth="2.5" />
            <path
              d="M60 50l5.6 11.4 12.6 1.8-9.1 8.9 2.2 12.5L60 79l-11.3 5.6 2.2-12.5-9.1-8.9 12.6-1.8z"
              fill="#FFF6D8"
              opacity="0.92"
            />
            <ellipse cx="49" cy="55" rx="9" ry="6" fill="#FFFFFF" opacity="0.45" />
          </svg>
        </div>

        {/* -------------------------------- Mascot ---------------------------- */}
        <div
          data-depth="76"
          data-scroll="64"
          className="nq-stage-layer absolute bottom-0 start-0"
        >
          <Mascot
            size={132}
            mood="cheer"
            title={t("app.name")}
            className="animate-bob drop-shadow-[0_30px_44px_rgb(3_8_26/0.6)]"
          />
        </div>

        {/* ------------------------------ Sparkles ---------------------------- */}
        <div data-depth="92" data-scroll="80" className="nq-stage-layer absolute inset-0">
          {[
            { top: "12%", inline: "38%", delay: "0s", size: 6 },
            { top: "26%", inline: "8%", delay: "0.7s", size: 4 },
            { top: "58%", inline: "88%", delay: "1.4s", size: 5 },
            { top: "82%", inline: "62%", delay: "2s", size: 4 },
          ].map((spark) => (
            <span
              key={`${spark.top}-${spark.inline}`}
              className="animate-twinkle absolute rounded-full bg-nq-yellow shadow-[0_0_18px_5px_rgb(255_201_74/0.5)]"
              style={{
                top: spark.top,
                insetInlineStart: spark.inline,
                width: spark.size,
                height: spark.size,
                animationDelay: spark.delay,
              }}
            />
          ))}
          <span className="absolute end-6 top-1/2 hidden items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur sm:inline-flex">
            <Star className="size-3 text-nq-yellow" aria-hidden />
            +3 {pick("stars", "نجوم")}
          </span>
        </div>
      </div>
    </div>
  );
}
