import React from "react";

// Crystal liquid-glass design tokens — zero purple, maximum clarity
export const G = {
  // Heaviest panel — primary cards, modals
  heavy: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.05) 100%)",
    backdropFilter: "blur(56px) saturate(180%) brightness(1.05)",
    WebkitBackdropFilter: "blur(56px) saturate(180%) brightness(1.05)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 8px 48px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.12)",
  },
  // Mid-weight — secondary surfaces
  medium: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)",
    backdropFilter: "blur(40px) saturate(160%) brightness(1.04)",
    WebkitBackdropFilter: "blur(40px) saturate(160%) brightness(1.04)",
    border: "1px solid rgba(255,255,255,0.13)",
    boxShadow: "0 4px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
  },
  // Light — inset panels, info chips
  light: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.025) 100%)",
    backdropFilter: "blur(24px) saturate(150%) brightness(1.03)",
    WebkitBackdropFilter: "blur(24px) saturate(150%) brightness(1.03)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 2px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.14)",
  },
  // Card — content tiles
  card: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.04) 100%)",
    backdropFilter: "blur(36px) saturate(170%) brightness(1.04)",
    WebkitBackdropFilter: "blur(36px) saturate(170%) brightness(1.04)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 4px 32px rgba(0,0,0,0.40), inset 0 1.5px 0 rgba(255,255,255,0.20)",
  },
  // Nav bar — bottom navigation
  nav: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
    backdropFilter: "blur(64px) saturate(200%) brightness(1.06)",
    WebkitBackdropFilter: "blur(64px) saturate(200%) brightness(1.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderBottom: "none",
    borderLeft: "none",
    borderRight: "none",
    boxShadow: "0 -4px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.20)",
  },
  // Search / input bar
  search: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)",
    backdropFilter: "blur(32px) saturate(160%) brightness(1.05)",
    WebkitBackdropFilter: "blur(32px) saturate(160%) brightness(1.05)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 4px 24px rgba(0,0,0,0.30), inset 0 1.5px 0 rgba(255,255,255,0.16)",
  },
  // Ghost button
  btn: {
    background: "linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)",
    backdropFilter: "blur(20px) saturate(140%)",
    WebkitBackdropFilter: "blur(20px) saturate(140%)",
    border: "1px solid rgba(255,255,255,0.20)",
    boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.22), 0 4px 16px rgba(0,0,0,0.25)",
  },
  // Bottom sheet / drawer
  sheet: {
    background: "linear-gradient(180deg, rgba(14,18,28,0.92) 0%, rgba(10,12,20,0.96) 100%)",
    backdropFilter: "blur(64px) saturate(200%) brightness(1.08)",
    WebkitBackdropFilter: "blur(64px) saturate(200%) brightness(1.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 -8px 60px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.18)",
  },
} as const;

// Iridescent shimmer — bright specular on clear glass
export function Iris({ opacity = 1 }: { opacity?: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(115deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.03) 65%, rgba(255,255,255,0.06) 100%)",
        pointerEvents: "none",
        borderRadius: "inherit",
        opacity,
      }}
    />
  );
}

// Specular highlight — bright rim of light on liquid glass
export function Specular() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: "4%",
        right: "4%",
        height: 1,
        background:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 20%, rgba(255,255,255,0.65) 50%, rgba(255,255,255,0.35) 80%, transparent 100%)",
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
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.16) 30%, rgba(255,255,255,0.10) 60%, transparent 100%)",
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

// Primary action button — crystal glass CTA
interface PurpleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function PurpleButton({ children, style, ...props }: PurpleButtonProps) {
  return (
    <button
      {...props}
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.08) 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow:
          "0 4px 20px rgba(0,0,0,0.30), inset 0 1.5px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(0,0,0,0.12)",
        color: "rgba(255,255,255,0.95)",
        border: "1px solid rgba(255,255,255,0.24)",
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
