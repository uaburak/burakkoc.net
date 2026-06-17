import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Size variants — height tokens (matches Input + Segmented):
 *  xs → 28px  (h-7)   px-2.5  gap-1    text-[12px] icon-14px
 *  sm → 32px  (h-8)   px-3    gap-1.5  text-[13px] icon-14px
 *  md → 40px  (h-10)  px-3.5  gap-1.5  text-[14px] icon-16px  ← default
 *  lg → 48px  (h-12)  px-4    gap-2    text-[16px] icon-18px
 */

// ── Shared size maps ──────────────────────────────────────────────────────────

const sizeMap = {
  xs: { outer: "h-7  px-2.5  gap-1    text-[12px] leading-5", icon: "w-3.5 h-3.5" },
  sm: { outer: "h-8  px-3    gap-1.5  text-[13px] leading-5", icon: "w-3.5 h-3.5" },
  md: { outer: "h-10 px-3.5  gap-1.5  text-[14px] leading-5", icon: "w-4   h-4"   },
  lg: { outer: "h-12 px-4    gap-2    text-[16px] leading-5", icon: "w-[18px] h-[18px]" },
} as const;

/* ── Icon Button ─────────────────────────────────────────────────────────────
   Square pill with just an icon — e.g. close / menu / theme-toggle style.   */

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** xs=28px · sm=32px · md=40px · lg=48px */
  size?: "xs" | "sm" | "md" | "lg";
}

const iconSizeMap = {
  xs: { btn: "w-7 h-7",   icon: "w-4 h-4"          },
  sm: { btn: "w-8 h-8",   icon: "w-4 h-4"          },
  md: { btn: "w-10 h-10", icon: "w-5 h-5"          },
  lg: { btn: "w-12 h-12", icon: "w-[22px] h-[22px]"},
} as const;

export function IconButton({ children, size = "md", className, ...props }: IconButtonProps) {
  const s = iconSizeMap[size];
  return (
    <button
      {...props}
      className={cn(
        "flex items-center justify-center rounded-full",
        "border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-title)]",
        "transition-all duration-200 cursor-pointer",
        "hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)]",
        "active:scale-95",
        s.btn,
        className
      )}
    >
      <span className={cn("flex items-center justify-center", s.icon)}>
        {children}
      </span>
    </button>
  );
}

/* ── Button ──────────────────────────────────────────────────────────────────
   Ghost text button — exactly the "‹ Projeler" back-link style.
   No border, transparent bg, hover fills with --bg-4. Icon scales with size. */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Leading icon (e.g. chevron SVG) */
  startIcon?: ReactNode;
  /** xs=28px · sm=32px · md=40px · lg=48px */
  size?: "xs" | "sm" | "md" | "lg";
}

export function Button({ children, startIcon, size = "md", className, ...props }: ButtonProps) {
  const s = sizeMap[size];
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        "bg-transparent border border-transparent",
        "text-[var(--text-p)]",
        "hover:bg-[var(--bg-4)]",
        "transition-colors duration-200 cursor-pointer",
        "active:scale-[0.97]",
        s.outer,
        className
      )}
    >
      {startIcon && (
        <span className={cn("flex items-center justify-center flex-shrink-0", s.icon)}>
          {startIcon}
        </span>
      )}
      {children}
    </button>
  );
}

/* ── PillButton ──────────────────────────────────────────────────────────────
   Bordered pill button — used for editor controls, action buttons etc.
   Three variants: default (bordered+bg), filled (heavier bg), ghost (no border). */

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Leading icon */
  startIcon?: ReactNode;
  /** xs=28px · sm=32px · md=40px · lg=48px */
  size?: "xs" | "sm" | "md" | "lg";
  /** Visual style */
  variant?: "default" | "filled" | "ghost";
}

const pillVariantMap = {
  default: "border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-subtitle)] hover:bg-[var(--bg-4)] hover:text-[var(--text-p)] hover:border-[var(--border-hover)]",
  filled:  "border border-[var(--border)] bg-[var(--bg-4)] text-[var(--text-title)] hover:bg-[var(--bg-5)] hover:border-[var(--border-hover)]",
  ghost:   "border border-transparent bg-transparent text-[var(--text-p)] hover:bg-[var(--bg-4)]",
} as const;

export function PillButton({
  children, startIcon, size = "md", variant = "default", className, ...props
}: PillButtonProps) {
  const s = sizeMap[size];
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center rounded-full font-medium whitespace-nowrap",
        "transition-all duration-150 cursor-pointer",
        "active:scale-[0.97]",
        s.outer,
        pillVariantMap[variant],
        className
      )}
    >
      {startIcon && (
        <span className={cn("flex items-center justify-center flex-shrink-0", s.icon)}>
          {startIcon}
        </span>
      )}
      {children}
    </button>
  );
}
