/**
 * অবস্থা জানানো — লোডিং, খালি তালিকা, রেটিং, দাম
 *
 * ডিজাইন সিস্টেমের অংশ। সব কম্পোনেন্ট `../ui` থেকে ইমপোর্ট করুন —
 * এই ফাইলটা সরাসরি ইমপোর্ট করার দরকার নেই।
 */

import { Star, Loader2 } from "lucide-react";
import { classNames as cx, money, toBnDigits } from "../../lib/format";

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
