/**
 * বোতাম ও ব্যাজ — সবচেয়ে ছোট গঠনগুলো
 *
 * ডিজাইন সিস্টেমের অংশ। সব কম্পোনেন্ট `../ui` থেকে ইমপোর্ট করুন —
 * এই ফাইলটা সরাসরি ইমপোর্ট করার দরকার নেই।
 */

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { classNames as cx } from "../../lib/format";

/* ------------------------------- Button ------------------------------- */

const BUTTON_VARIANTS = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-sm disabled:bg-brand-300",
  accent:
    "bg-accent-400 text-ink hover:bg-accent-300 active:bg-accent-500 shadow-sm disabled:bg-accent-200",
  outline:
    "border border-line-2 bg-white text-ink hover:border-brand-400 hover:text-brand-600 disabled:opacity-50",
  /**
   * গাঢ় ব্যাকগ্রাউন্ডের উপরের আউটলাইন বোতাম।
   * আলাদা ভ্যারিয়েন্ট রাখা হয়েছে কারণ `outline`-এর উপর className দিয়ে
   * bg-transparent চাপালে Tailwind-এর ক্লাস অগ্রাধিকারে হেরে গিয়ে
   * সাদা বাক্স হয়ে যেত — লেখা পড়া যেত না।
   */
  onDark:
    "border border-white/30 bg-white/5 text-white backdrop-blur hover:border-white/70 hover:bg-white/15 disabled:opacity-40",
  ghost: "text-ink-2 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  subtle: "bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-50",
};

const BUTTON_SIZES = {
  sm: "h-9 px-3 text-[13px] gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
  icon: "h-10 w-10",
};

export const Button = forwardRef(function Button(
  { as: Tag = "button", variant = "primary", size = "md", loading = false, className, children, ...props },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={cx(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150",
        "focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed active:scale-[.98]",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </Tag>
  );
});

/* -------------------------------- Badge ------------------------------- */

const BADGE_TONES = {
  ok: "bg-brand-50 text-brand-700 border-brand-200",
  warn: "bg-accent-50 text-accent-600 border-accent-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  sale: "bg-sale text-white border-transparent",
  neutral: "bg-canvas text-ink-2 border-line",
  /* গাঢ় ব্যাকগ্রাউন্ড ও ছবির উপরে — একই কারণে আলাদা টোন, className দিয়ে নয় */
  gold: "border-accent-400/30 bg-accent-400/15 text-accent-200",
  glass: "border-white/50 bg-white/90 text-ink backdrop-blur",
};

export function Badge({ tone = "neutral", className, children, ...props }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
