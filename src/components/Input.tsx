import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared Input component with size variants matching Button / Segmented tokens:
 *  xs → 28px  (h-7)   px-3      text-[12px] leading-5
 *  sm → 32px  (h-8)   px-3.5    text-[13px] leading-5
 *  md → 40px  (h-10)  px-4      text-[14px] leading-6   ← default
 *  lg → 48px  (h-12)  px-[18px] text-[16px] leading-6
 */

const sizeMap = {
  xs: "h-7  px-3      text-[12px] leading-5",
  sm: "h-8  px-3.5    text-[13px] leading-5",
  md: "h-10 px-4      text-[14px] leading-6",
  lg: "h-12 px-[18px] text-[16px] leading-6",
} as const;

type SizeVariant = "xs" | "sm" | "md" | "lg";

// Omit native `size` attr (number) to avoid conflict with our string variant
interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** xs=28px · sm=32px · md=40px · lg=48px */
  size?: SizeVariant;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ size = "md", className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        {...props}
        className={cn(
          "w-full rounded-full border border-[var(--border)] bg-[var(--bg-2)]",
          "text-[var(--text-p)] placeholder:text-[var(--text-subtitle)]",
          "focus:outline-none focus:border-[var(--border-hover)]",
          "transition-colors duration-150",
          sizeMap[size],
          className
        )}
      />
    );
  }
);

Input.displayName = "Input";
