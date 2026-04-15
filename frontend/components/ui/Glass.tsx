import React from "react";

// Glass design tokens — apply as inline styles
export const G = {
  heavy: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.36) 0%, rgba(255,255,255,0.16) 100%)",
    backdropFilter: "blur(40px) saturate(220%) brightness(1.12)",
    WebkitBackdropFilter: "blur(40px) saturate(220%) brightness(1.12)",
    border: "1px solid rgba(255,255,255,0.58)",
    boxShadow: "0 8px 40px rgba(0,0,0,0.14), inset 0 2px 0 rgba(255,255,255,0.82), inset 0 -1px 0 rgba(255,255,255,0.18)",
  },
  medium: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.12) 100%)",
    backdropFilter: "blur(24px) saturate(200%) brightness(1.10)",
    WebkitBackdropFilter: "blur(24px) saturate(200%) brightness(1.10)",
    border: "1px solid rgba(255,255,255,0.48)",
    boxShadow: "0 4px 24px rgba(0,0,0,0.10), inset 0 1.5px 0 rgba(255,255,255,0.78)",
  },
  light: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.10) 100%)",
    backdropFilter: "blur(16px) saturate(180%) brightness(1.08)",
    WebkitBackdropFilter: "blur(16px) saturate(180%) brightness(1.08)",
    border: "1px solid rgba(255,255,255,0.38)",
    boxShadow: "0 2px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.68)",
  },
  card: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.52) 100%)",
    backdropFilter: "blur(20px) saturate(180%) brightness(1.08)",
    WebkitBackdropFilter: "blur(20px) saturate(180%) brightness(1.08)",
    border: "1px solid rgba(255,255,255,0.75)",
    boxShadow: "0 4px 24px rgba(100,0,255,0.08), inset 0 1.5px 0 rgba(255,255,255,0.90)",
  },
  nav: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.48) 0%, rgba(240,230,255,0.35) 100%)",
    backdropFilter: "blur(48px) saturate(240%) brightness(1.15)",
    WebkitBackdropFilter: "blur(48px) saturate(240%) brightness(1.15)",
    border: "1px solid rgba(255,255,255,0.62)",
    borderBottom: "none",
    borderLeft: "none",
    borderRight: "none",
    boxShadow: "0 -4px 50px rgba(0,0,0,0.08), inset 0 2px 0 rgba(255,255,255,0.92)",
  },
  search: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.35) 100%)",
    backdropFilter: "blur(24px) saturate(180%) brightness(1.15)",
    WebkitBackdropFilter: "blur(24px) saturate(180%) brightness(1.15)",
    border: "1px solid rgba(255,255,255,0.68)",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08), inset 0 1.5px 0 rgba(255,255,255,0.84)",
  },
  btn: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.22) 100%)",
    backdropFilter: "blur(16px) saturate(180%)",
    WebkitBackdropFilter: "blur(16px) saturate(180%)",
    border: "1px solid rgba(255,255,255,0.58)",
    boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.74), 0 4px 16px rgba(0,0,0,0.10)",
  },
  sheet: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(248,244,255,0.92) 100%)",
    backdropFilter: "blur(40px) saturate(200%) brightness(1.05)",
    WebkitBackdropFilter: "blur(40px) saturate(200%) brightness(1.05)",
    border: "1px solid rgba(255,255,255,0.80)",
    boxShadow: "0 -8px 60px rgba(100,0,255,0.12), inset 0 2px 0 rgba(255,255,255,0.90)",
  },
} as const;

// Iridescent shimmer overlay — place inside a position:relative container
export function Iris({ opacity = 1 }: { opacity?: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(115deg, rgba(138,43,226,0.08) 0%, rgba(100,180,255,0.09) 25%, rgba(255,255,255,0.13) 50%, rgba(200,120,255,0.07) 75%, rgba(60,210,230,0.07) 100%)",
        pointerEvents: "none",
        borderRadius: "inherit",
        opacity,
      }}
    />
  );
}

// Specular highlight — thin prismatic line at top of glass
export function Specular() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: "8%",
        right: "8%",
        height: 1.5,
        background:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.95) 30%, rgba(210,180,255,0.82) 55%, rgba(180,230,255,0.82) 75%, rgba(255,255,255,0.92) 90%, transparent 100%)",
        pointerEvents: "none",
        borderRadius: "inherit",
      }}
    />
  );
}

// Glass divider — a subtle frosted horizontal rule
export function GlassDivider() {
  return (
    <div
      style={{
        height: 1,
        background:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 30%, rgba(200,170,255,0.4) 60%, transparent 100%)",
        margin: "0 16px",
      }}
    />
  );
}

// GlassPanel — generic wrapper that applies G.card + Iris + Specular
interface GlassPanelProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  variant?: keyof typeof G;
}

export function GlassPanel({
  children,
  style,
  className,
  variant = "card",
}: GlassPanelProps) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 24,
        ...G[variant],
        ...style,
      }}
    >
      <Iris />
      <Specular />
      {children}
    </div>
  );
}

// Purple CTA button
interface PurpleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function PurpleButton({ children, style, ...props }: PurpleButtonProps) {
  return (
    <button
      {...props}
      style={{
        background: "linear-gradient(135deg, #9B3FFF 0%, #6A00FF 100%)",
        boxShadow:
          "0 4px 20px rgba(106,0,255,0.45), inset 0 1px 0 rgba(255,255,255,0.35)",
        color: "#fff",
        border: "none",
        borderRadius: 12,
        fontWeight: 700,
        cursor: "pointer",
        transition: "opacity 0.2s, transform 0.1s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
