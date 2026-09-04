/**
 * পাতার কাঠামো — কার্ড, শিরোনাম, ট্যাব, অ্যাকর্ডিয়ন, ধাপ
 *
 * ডিজাইন সিস্টেমের অংশ। সব কম্পোনেন্ট `../ui` থেকে ইমপোর্ট করুন —
 * এই ফাইলটা সরাসরি ইমপোর্ট করার দরকার নেই।
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { classNames as cx, toBnDigits } from "../../lib/format";

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
