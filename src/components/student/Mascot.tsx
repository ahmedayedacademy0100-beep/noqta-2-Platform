import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * "نُقطة" — the Noqta mascot.
 *
 * A friendly owl-robot drawn entirely in SVG: no image request, crisp at any
 * size, and themed with the brand tokens so it looks right in light and dark
 * mode. Decorative by default (`aria-hidden`); pass a `title` when the mascot
 * carries meaning for the screen reader.
 *
 * Animations are CSS-only and therefore silenced by the global
 * `prefers-reduced-motion` rule.
 */
export function Mascot({
  size = 160,
  mood = "happy",
  className,
  title,
  animate = true,
}: {
  size?: number;
  mood?: "happy" | "cheer" | "focus";
  className?: string;
  title?: string;
  animate?: boolean;
}) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, "");
  const body = `nq-mascot-body-${uid}`;
  const head = `nq-mascot-head-${uid}`;
  const belly = `nq-mascot-belly-${uid}`;
  const glow = `nq-mascot-glow-${uid}`;
  const cap = `nq-mascot-cap-${uid}`;

  return (
    <svg
      viewBox="0 0 220 220"
      width={size}
      height={size}
      className={cn(animate && "animate-bob", className)}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={body} x1="20%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#3E63C8" />
          <stop offset="45%" stopColor="#2C3F86" />
          <stop offset="100%" stopColor="#141E44" />
        </linearGradient>
        <linearGradient id={head} x1="15%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#4B79F5" />
          <stop offset="60%" stopColor="#3478F6" />
          <stop offset="100%" stopColor="#3D46B8" />
        </linearGradient>
        <radialGradient id={belly} cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
          <stop offset="65%" stopColor="#DCE7FF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#B9CBF7" stopOpacity="0.9" />
        </radialGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#34D6C8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#34D6C8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={cap} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7957E8" />
          <stop offset="100%" stopColor="#4B3BB0" />
        </linearGradient>
      </defs>

      {/* Ground shadow keeps the character visually planted. */}
      <ellipse cx="110" cy="203" rx="58" ry="9" fill="#111C3D" opacity="0.16" />

      {/* Antenna + turquoise beacon */}
      <path
        d="M110 22v16"
        stroke="#8FA4D6"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="110" cy="18" r="16" fill={`url(#${glow})`} opacity="0.55" />
      <circle cx="110" cy="18" r="7.5" fill="#34D6C8" stroke="#0B1330" strokeWidth="1.4" />
      <circle cx="107.4" cy="15.4" r="2.4" fill="#FFFFFF" opacity="0.85" />

      {/* Graduation cap */}
      <g transform="rotate(-6 110 40)">
        <path d="M64 44 L110 26 L156 44 L110 62 Z" fill={`url(#${cap})`} />
        <path d="M64 44 L110 62 L110 72 L64 54 Z" fill="#3B2F8F" opacity="0.85" />
        <path d="M110 62 L156 44 L156 54 L110 72 Z" fill="#5B45C8" opacity="0.9" />
        <path
          d="M150 48v14"
          stroke="#FFC94A"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="150" cy="66" r="4" fill="#FFC94A" />
      </g>

      {/* Body */}
      <path
        d="M110 46c40 0 66 26 66 66 0 44-26 74-66 74s-66-30-66-74c0-40 26-66 66-66Z"
        fill={`url(#${body})`}
      />
      {/* Wings */}
      <path
        d="M46 96c-10 6-14 22-9 38 4 13 12 20 20 21-6-18-9-40-11-59Z"
        fill="#22306B"
        opacity="0.95"
      />
      <path
        d="M174 96c10 6 14 22 9 38-4 13-12 20-20 21 6-18 9-40 11-59Z"
        fill="#22306B"
        opacity="0.95"
      />
      {/* Belly plate with a soft 3D highlight */}
      <ellipse cx="110" cy="140" rx="40" ry="38" fill={`url(#${belly})`} />
      <ellipse cx="110" cy="140" rx="40" ry="38" fill="none" stroke="#FFFFFF" strokeOpacity="0.65" strokeWidth="2" />

      {/* Face panel */}
      <path
        d="M110 56c30 0 50 18 50 44s-20 40-50 40-50-14-50-40 20-44 50-44Z"
        fill={`url(#${head})`}
        opacity="0.35"
      />

      {/* Eyes */}
      <g>
        <g>
          <ellipse cx="88" cy="104" rx="19" ry="20" fill="#FFFFFF" />
          <ellipse cx="132" cy="104" rx="19" ry="20" fill="#FFFFFF" />
          <g className={animate ? "animate-blink" : undefined}>
            <circle cx="90" cy="107" r="9.5" fill="#131C3E" />
            <circle cx="130" cy="107" r="9.5" fill="#131C3E" />
            <circle cx="86.6" cy="103" r="3.4" fill="#FFFFFF" />
            <circle cx="126.6" cy="103" r="3.4" fill="#FFFFFF" />
            <circle cx="93.4" cy="111" r="1.8" fill="#34D6C8" opacity="0.9" />
            <circle cx="133.4" cy="111" r="1.8" fill="#34D6C8" opacity="0.9" />
          </g>
        </g>
      </g>

      {/* Beak */}
      <path
        d="M110 116l9 12-9 8-9-8Z"
        fill="#FFC94A"
        stroke="#E9A72B"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Expression */}
      {mood === "cheer" ? (
        <path
          d="M98 150c6 10 18 10 24 0"
          stroke="#28325C"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      ) : mood === "focus" ? (
        <path d="M98 148h24" stroke="#28325C" strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path
          d="M99 147c5 7 17 7 22 0"
          stroke="#28325C"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Star badge on the belly */}
      <g transform="translate(110 178)">
        <circle r="15" fill="#FFC94A" stroke="#F0A92C" strokeWidth="1.6" />
        <circle r="15" fill="#FFFFFF" opacity="0.25" />
        <path
          d="M0-8.5l2.5 5.2 5.7.8-4.1 4 1 5.7L0 4.4l-5.1 2.9 1-5.7-4.1-4 5.7-.8Z"
          fill="#8A5B04"
        />
      </g>

      {/* Sparkles */}
      <g fill="#FFC94A" opacity="0.9">
        <path d="M38 58l2.2 5.4 5.4 2.2-5.4 2.2L38 73l-2.2-5.2-5.4-2.2 5.4-2.2Z" className={animate ? "animate-twinkle" : undefined} />
        <path d="M184 82l1.8 4.4 4.4 1.8-4.4 1.8L184 94l-1.8-4.4-4.4-1.8 4.4-1.8Z" className={animate ? "animate-twinkle" : undefined} />
      </g>
      <circle cx="176" cy="140" r="4" fill="#34D6C8" opacity="0.85" />
      <circle cx="44" cy="132" r="3" fill="#7957E8" opacity="0.8" />
    </svg>
  );
}
