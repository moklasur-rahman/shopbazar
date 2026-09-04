/**
 * পাতা বদলানোর নিয়ন্ত্রণ
 *
 * ডিজাইন সিস্টেমের অংশ। সব কম্পোনেন্ট `../ui` থেকে ইমপোর্ট করুন —
 * এই ফাইলটা সরাসরি ইমপোর্ট করার দরকার নেই।
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { classNames as cx, toBnDigits } from "../../lib/format";
import { Button } from "./primitives";

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
