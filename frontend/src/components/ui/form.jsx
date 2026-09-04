/**
 * ফর্মের ঘর — লেবেল, ইনপুট, সিলেক্ট, সংখ্যা বাড়ানো-কমানো
 *
 * ডিজাইন সিস্টেমের অংশ। সব কম্পোনেন্ট `../ui` থেকে ইমপোর্ট করুন —
 * এই ফাইলটা সরাসরি ইমপোর্ট করার দরকার নেই।
 */

import { forwardRef } from "react";
import { classNames as cx, toBnDigits } from "../../lib/format";

/* -------------------------------- Input ------------------------------- */

export function Field({ label, error, hint, required, children, className }) {
  return (
    <label className={cx("block", className)}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-ink-2">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1 block text-[13px] text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[13px] text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

const controlBase =
  "w-full rounded-lg border bg-white px-3.5 text-sm text-ink transition placeholder:text-muted/70 " +
  "focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none disabled:bg-canvas";

export const Input = forwardRef(function Input({ className, invalid, icon: Icon, ...props }, ref) {
  return (
    <div className="relative">
      {Icon && (
        <Icon
          size={17}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
        />
      )}
      <input
        ref={ref}
        className={cx(
          controlBase,
          "h-11",
          Icon && "pl-9.5",
          invalid ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-line-2",
          className,
        )}
        {...props}
      />
    </div>
  );
});

export const Select = forwardRef(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cx(
        controlBase,
        "h-11 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9",
        invalid ? "border-red-300" : "border-line-2",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%236d7b74' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cx(
        controlBase,
        "min-h-24 resize-y py-2.5 leading-relaxed",
        invalid ? "border-red-300" : "border-line-2",
        className,
      )}
      {...props}
    />
  );
});

/* ------------------------------ QtyStepper ---------------------------- */

export function QtyStepper({ value, onChange, max = 10, min = 1, size = "md" }) {
  const h = size === "sm" ? "h-8" : "h-10";
  const w = size === "sm" ? "w-8" : "w-10";

  return (
    <div className={cx("inline-flex items-center rounded-lg border border-line-2 bg-white", h)}>
      <button
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        className={cx(w, h, "grid place-items-center text-lg text-ink-2 transition hover:text-brand-600 disabled:opacity-30")}
        aria-label="কমান"
      >
        −
      </button>
      <span className={cx("tnum grid min-w-9 place-items-center text-sm font-semibold", h)}>
        {toBnDigits(value)}
      </span>
      <button
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        className={cx(w, h, "grid place-items-center text-lg text-ink-2 transition hover:text-brand-600 disabled:opacity-30")}
        aria-label="বাড়ান"
      >
        +
      </button>
    </div>
  );
}
