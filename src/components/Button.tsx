import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ── Icon Button ──────────────────────────────────────────── */
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  size?: "sm" | "md";
}

export function IconButton({ children, size = "md", className, ...props }: IconButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-title)]",
        "transition-all duration-200 cursor-pointer",
        "hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)]",
        "active:scale-95",
        size === "md" ? "w-10 h-10 p-[10px]" : "w-8 h-8 p-[6px]",
        className
      )}
    >
      <span className={cn("flex items-center justify-center", size === "md" ? "w-5 h-5" : "w-4 h-4")}>
        {children}
      </span>
    </button>
  );
}

/* ── Text Button ──────────────────────────────────────────── */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  startIcon?: ReactNode;
  size?: "sm" | "md";
}

export function Button({ children, startIcon, size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-[500] text-[var(--text-p)]",
        "transition-all duration-200 cursor-pointer bg-transparent border border-transparent",
        "hover:bg-[var(--bg-4)]",
        "active:scale-95",
        size === "md"
          ? "px-[10px] py-[10px] text-base leading-5"
          : "px-[8px] py-[6px] text-sm leading-5",
        className
      )}
    >
      {startIcon && (
        <span className="flex items-center justify-center w-5 h-5">{startIcon}</span>
      )}
      <span className={cn("px-1", size === "sm" && "px-[6px]")}>{children}</span>
    </button>
  );
}
