import React from "react";

// Dark liquid-glass design tokens — apply as inline styles
export const G = {
  // Heaviest panel — primary cards, modals
  heavy: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
    backdropFilter: "blur(48px) saturate(140%) brightness(0.80)",
    WebkitBackdropFilter: "blur(48px) saturate(140%) brightness(0.80)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 8px 48px rgba(0,0,0,0.60), inset 0 1.5px 0 rgba(255,255,255,0.13), inset 0 -1px 0 rgba(0,0,0,0.30)",
  },
  // Mid-weight — secondary surfaces
  medium: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
    backdropFilter: "blur(32px) saturate(130%) brightness(0.78)",
    WebkitBackdropFilter: "blur(32px) saturate(130%) brightness(0.78)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 4px 32px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.10)",
  },
  // Light — inset panels, info chips
  light: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
    backdropFilter: "blur(20px) saturate(120%) brightness(0.76)",
    WebkitBackdropFilter: "blur(20px) saturate(120%) brightness(0.76)",
    border: "1px solid rgba(255,255,255,0.07)",
    boxShadow: "0 2px 20px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.08)",
  },
  // Card — content tiles
  card: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.025) 100%)",
    backdropFilter: "blur(28px) saturate(130%) brightness(0.78)",
    WebkitBackdropFilter: "blur(28px) saturate(130%) brightness(0.78)",
    border: "1px solid rgba(255,255,255,0.09)",
    boxShadow: "0 4px 28px rgba(0,0,0,0.55), inset 0 1.5px 0 rgba(255,255,255,0.11)",
  },
  // Nav bar — bottom navigation
  nav: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
    backdropFilter: "blur(56px) saturate(150%) brightness(0.75)",
    WebkitBackdropFilter: "blur(56px) saturate(150%) brightness(0.75)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderBottom: "none",
    borderLeft: "none",
    borderRight: "none",
    boxShadow: "0 -4px 40px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.12)",
  },
  // Search / input bar
  search: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)",
    backdropFilter: "blur(28px) saturate(130%) brightness(0.80)",
    WebkitBackdropFilter: "blur(28px) saturate(130%) brightness(0.80)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 4px 24px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.09)",
  },
  // Ghost button
  btn: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.04) 100%)",
    backdropFilter: "blur(16px) saturate(120%)",
    WebkitBackdropFilter: "blur(16px) saturate(120%)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.12), 0 4px 16px rgba(0,0,0,0.35)",
  },
  // Bottom sheet / drawer
  sheet: {
    background: "linear-gradient(180deg, rgba(18,18,28,0.94) 0%, rgba(10,10,18,0.97) 100%)",
    backdropFilter: "blur(48px) saturate(140%) brightness(0.80)",
    WebkitBackdropFilter: "blur(48px) saturate(140%) brightness(0.80)",
    border: "1px solid rgba(255,255,255,0.09)",
    boxShadow: "0 -8px 60px rgba(0,0,0,0.70), inset 0 1px 0 rgba(255,255,255,0.10)",
  },
} as const;

// Iridescent shimmer — very subtle on dark glass
export function Iris({ opacity = 1 }: { opacity?: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(115deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.05) 40%, rgba(255,255,255,0.02) 70%, rgba(255,255,255,0.04) 100%)",
        pointerEvents: "none",
        borderRadius: "inherit",
        opacity,
      }}
    />
  );
}

// Specular highlight — the bright rim of light on liquid glass
export function Specular() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: "6%",
        right: "6%",
        height: 1,
        background:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 25%, rgba(255,255,255,0.50) 50%, rgba(255,255,255,0.28) 75%, transparent 100%)",
        pointerEvents: "none",
        borderRadius: "inherit",
      }}
    />
  );
}

// Glass divider
export function GlassDivider() {
  return (
    <div
      style={{
        height: 1,
        background:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.08) 60%, transparent 100%)",
        margin: "0 16px",
      }}
    />
  );
}

// GlassPanel — generic wrapper
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

// Primary action button — frosted glass with white text
interface PurpleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function PurpleButton({ children, style, ...props }: PurpleButtonProps) {
  return (
    <button
      {...props}
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.06) 100%)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow:
          "0 4px 20px rgba(0,0,0,0.40), inset 0 1.5px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.20)",
        color: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "opacity 0.2s, transform 0.1s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
