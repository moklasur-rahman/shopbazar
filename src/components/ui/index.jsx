import { forwardRef, useEffect, useRef, useState } from "react";
import {
  Star, X, Loader2, ChevronLeft, ChevronRight, ChevronDown, ImageOff,
  Upload, Check,
} from "lucide-react";
import { classNames as cx, money, toBnDigits } from "../../lib/format";

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

/* -------------------------------- Card -------------------------------- */

export function Card({ className, hover = false, children, ...props }) {
  return (
    <div
      className={cx(
        "rounded-card border border-line bg-surface shadow-soft",
        hover && "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action, className }) {
  return (
    <div className={cx("mb-4 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------ Skeleton ------------------------------ */

export function Skeleton({ className }) {
  return (
    <div className={cx("shimmer relative overflow-hidden rounded-lg bg-line/70", className)} />
  );
}

export function Spinner({ size = 22, className }) {
  return <Loader2 size={size} className={cx("animate-spin text-brand-500", className)} />;
}

/* ----------------------------- EmptyState ----------------------------- */

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cx("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      {Icon && (
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-400">
          <Icon size={28} />
        </div>
      )}
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------- Rating ------------------------------- */

export function Rating({ value = 0, count, size = 14, showValue = true, className }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className={cx("inline-flex items-center gap-1", className)}>
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={size}
            className={
              i <= rounded
                ? "fill-accent-400 text-accent-400"
                : i - 0.5 === rounded
                  ? "fill-accent-200 text-accent-400"
                  : "fill-line text-line"
            }
          />
        ))}
      </span>
      {showValue && value > 0 && (
        <span className="tnum text-[12.5px] font-medium text-ink-2">{toBnDigits(value.toFixed(1))}</span>
      )}
      {count != null && (
        <span className="tnum text-[12.5px] text-muted">({toBnDigits(count)})</span>
      )}
    </span>
  );
}

/* -------------------------------- Price ------------------------------- */

export function Price({ value, compareAt, size = "md", className }) {
  const sizes = {
    sm: ["text-sm font-semibold", "text-[11.5px]"],
    md: ["text-[17px] font-semibold", "text-[13px]"],
    lg: ["text-2xl font-bold", "text-sm"],
  };
  const [main, old] = sizes[size];

  return (
    <span className={cx("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cx("tnum text-ink", main)}>{money(value)}</span>
      {compareAt > value && (
        <s className={cx("tnum text-muted", old)}>{money(compareAt)}</s>
      )}
    </span>
  );
}

/* ----------------------------- SmartImage ----------------------------- */

/** ছবি লোড না হলে খালি বাক্স না দেখিয়ে একটা প্লেসহোল্ডার দেখায় */
export function SmartImage({ src, alt, className, ratio = "square", ...props }) {
  const [state, setState] = useState("loading");

  useEffect(() => {
    setState(src ? "loading" : "error");
  }, [src]);

  const ratios = { square: "aspect-square", wide: "aspect-[16/9]", tall: "aspect-[3/4]" };

  return (
    <div className={cx("relative overflow-hidden bg-canvas", ratios[ratio], className)}>
      {state === "loading" && <Skeleton className="absolute inset-0 rounded-none" />}
      {state === "error" ? (
        <div className="absolute inset-0 grid place-items-center text-line-2">
          <ImageOff size={26} />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
          className={cx(
            "h-full w-full object-cover transition-opacity duration-300",
            state === "ready" ? "opacity-100" : "opacity-0",
          )}
          {...props}
        />
      )}
    </div>
  );
}

/* ------------------------------ Pagination ---------------------------- */

export function Pagination({ page, count, pageSize, onChange, className }) {
  const total = Math.ceil(count / pageSize);
  if (total <= 1) return null;

  const pages = [];
  const push = (p) => pages.push(p);
  push(1);
  for (let p = Math.max(2, page - 1); p <= Math.min(total - 1, page + 1); p++) push(p);
  if (total > 1) push(total);
  const unique = [...new Set(pages)].sort((a, b) => a - b);

  return (
    <nav className={cx("flex items-center justify-center gap-1.5", className)} aria-label="পাতা">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="আগের পাতা"
      >
        <ChevronLeft size={17} />
      </Button>

      {unique.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - unique[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
          <button
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={cx(
              "tnum h-10 min-w-10 rounded-lg border px-3 text-sm font-medium transition",
              p === page
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-line-2 bg-white text-ink-2 hover:border-brand-300 hover:text-brand-600",
            )}
          >
            {toBnDigits(p)}
          </button>
        </span>
      ))}

      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(page + 1)}
        disabled={page >= total}
        aria-label="পরের পাতা"
      >
        <ChevronRight size={17} />
      </Button>
    </nav>
  );
}

/* -------------------------------- Modal ------------------------------- */

export function Modal({ open, onClose, title, children, footer, size = "md" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          "relative flex max-h-[88vh] w-full flex-col rounded-t-2xl bg-surface shadow-lift sm:rounded-2xl",
          sizes[size],
        )}
        style={{ animation: "modalIn .2s ease-out" }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-canvas hover:text-ink"
            aria-label="বন্ধ করুন"
          >
            <X size={19} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
      <style>{`@keyframes modalIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

/* -------------------------------- Drawer ------------------------------ */

export function Drawer({ open, onClose, title, children, side = "right", width = "max-w-sm" }) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div
      className={cx("fixed inset-0 z-[95]", open ? "" : "pointer-events-none")}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={cx(
          "absolute inset-0 bg-ink/40 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cx(
          "absolute top-0 bottom-0 flex w-full flex-col bg-surface shadow-lift transition-transform duration-250 ease-out",
          width,
          side === "right" ? "right-0" : "left-0",
          open ? "translate-x-0" : side === "right" ? "translate-x-full" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <h3 className="font-display text-base font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-canvas hover:text-ink"
            aria-label="বন্ধ করুন"
          >
            <X size={19} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------- Tabs ------------------------------- */

export function Tabs({ tabs, active, onChange, className }) {
  return (
    <div className={cx("no-scrollbar flex gap-1 overflow-x-auto border-b border-line", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cx(
            "relative shrink-0 px-4 py-2.5 text-sm font-medium transition",
            active === tab.value ? "text-brand-600" : "text-muted hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count != null && (
            <span className="tnum ml-1.5 text-xs opacity-70">({toBnDigits(tab.count)})</span>
          )}
          {active === tab.value && (
            <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500" />
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ ImageUpload --------------------------- */

/** ব্যাকএন্ডের common/validators.py এর সাথে মিলিয়ে রাখা */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * একটা ছবি বেছে নেওয়ার ঘর — প্রিভিউসহ।
 *
 * `value` তিন রকম হতে পারে:
 *   File          → ব্যবহারকারী এইমাত্র বেছেছেন (এখনো আপলোড হয়নি)
 *   string (URL)  → আগে আপলোড করা, সার্ভারে আছে
 *   null          → কিছু নেই
 *
 * সার্ভারে পাঠানোর আগেই আকার ও ফরম্যাট যাচাই করা হয়, যাতে ৫ MB ছবি
 * আপলোড হওয়ার পর "খুব বড়" বলে ফেরত না আসে।
 */
export function ImageUpload({
  label, value, onChange, hint, error, required, className,
}) {
  const inputRef = useRef(null);
  const [localError, setLocalError] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    if (typeof value === "string") {
      setPreview(value);
      return;
    }
    // File — অস্থায়ী URL বানিয়ে প্রিভিউ, আর আনমাউন্টে ছেড়ে দেওয়া
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  function pick(file) {
    setLocalError(null);
    if (!file) return;

    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      setLocalError("শুধু JPG, PNG বা WEBP ছবি দেওয়া যাবে");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setLocalError(`ছবির আকার ${toBnDigits(mb)} MB — সর্বোচ্চ ৫ MB`);
      return;
    }
    onChange(file);
  }

  const shownError = error || localError;

  return (
    <div className={className}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-ink-2">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files?.[0]);
        }}
        className={cx(
          "relative overflow-hidden rounded-xl border-2 border-dashed transition",
          shownError ? "border-red-300 bg-red-50/40" : "border-line-2 bg-canvas hover:border-brand-400",
        )}
      >
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt={label}
              className="h-40 w-full bg-white object-contain"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-ink/70 px-3 py-2 backdrop-blur">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-white">
                <Check size={13} />
                {typeof value === "string" ? "জমা দেওয়া আছে" : "বাছাই হয়েছে"}
              </span>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="ml-auto rounded px-2 py-0.5 text-[12px] text-white/90 transition hover:bg-white/15"
              >
                বদলান
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setLocalError(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="rounded p-1 text-white/90 transition hover:bg-red-500"
                aria-label="ছবিটি সরান"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-40 w-full flex-col items-center justify-center gap-2 px-4 text-center"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-brand-500 shadow-soft">
              <Upload size={20} />
            </span>
            <span className="text-[13.5px] font-medium text-ink">
              ছবি বেছে নিন
            </span>
            <span className="text-[11.5px] text-muted">
              অথবা এখানে টেনে আনুন · JPG/PNG · সর্বোচ্চ ৫ MB
            </span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      {shownError ? (
        <span className="mt-1 block text-[13px] text-red-600">{shownError}</span>
      ) : hint ? (
        <span className="mt-1 block text-[12.5px] text-muted">{hint}</span>
      ) : null}
    </div>
  );
}

/* --------------------------- MobileActionBar -------------------------- */

/**
 * মোবাইলে স্ক্রিনের নিচে আটকে থাকা অ্যাকশন বার।
 * নিচের ট্যাব বারের ঠিক উপরে বসে (bottom-14), ডেস্কটপে দেখা যায় না।
 *
 * যে পাতায় ব্যবহার করবেন সেখানে নিচে `pb-32 lg:pb-0` দিতে ভুলবেন না,
 * নাহলে শেষ কনটেন্টটা বারের নিচে ঢাকা পড়বে।
 */
export function MobileActionBar({ children, className }) {
  return (
    <div
      className={cx(
        "fixed inset-x-0 bottom-14 z-30 border-t border-line bg-white/97 px-4 py-3 backdrop-blur lg:hidden",
        "shadow-[0_-4px_16px_rgb(16_32_26/0.08)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------ Accordion ----------------------------- */

/** প্রশ্ন-উত্তরের তালিকা। একবারে একটাই খোলা থাকে। */
export function Accordion({ items, className }) {
  const [open, setOpen] = useState(null);

  return (
    <div className={cx("divide-y divide-line overflow-hidden rounded-card border border-line bg-surface", className)}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-canvas/70 sm:px-5"
            >
              <span className="flex-1 font-display text-[15px] font-semibold text-ink">
                {item.q}
              </span>
              <span
                className={cx(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line-2 text-muted transition",
                  isOpen && "rotate-180 border-brand-300 bg-brand-50 text-brand-600",
                )}
              >
                <ChevronDown size={15} />
              </span>
            </button>
            {isOpen && (
              <div className="animate-fade-up px-4 pb-4 text-[14.5px] leading-relaxed text-ink-2 sm:px-5">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------- Steps ------------------------------- */

/**
 * ধাপে ধাপে নির্দেশনা। মোবাইলে খাড়া লাইন, ডেস্কটপে পাশাপাশি —
 * দুই জায়গাতেই ক্রমটা পরিষ্কার বোঝা যায়।
 */
export function Steps({ steps, className }) {
  return (
    <ol className={cx("grid gap-4 sm:gap-5 lg:grid-cols-4", className)}>
      {steps.map((step, i) => (
        <li key={i} className="relative flex gap-4 lg:flex-col lg:gap-3">
          {/* সংযোগ রেখা */}
          <span
            aria-hidden="true"
            className={cx(
              "absolute bg-line",
              i === steps.length - 1 && "hidden",
              "top-11 bottom-[-1.25rem] left-[1.375rem] w-px",
              "lg:top-[1.375rem] lg:right-[-1.25rem] lg:bottom-auto lg:left-11 lg:h-px lg:w-auto",
            )}
          />

          <span className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500 font-display text-[15px] font-bold text-white shadow-soft">
            {toBnDigits(i + 1)}
          </span>

          <div className="min-w-0 pb-1">
            <h3 className="font-display text-[15.5px] font-semibold text-ink">{step.title}</h3>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{step.text}</p>
            {step.hint && (
              <p className="mt-1.5 inline-flex rounded-md bg-accent-50 px-2 py-0.5 text-[12px] font-medium text-accent-600">
                {step.hint}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

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
