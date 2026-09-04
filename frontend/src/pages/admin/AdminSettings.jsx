import { Percent, Truck, Clock, ShoppingCart, AlertTriangle, FileCode } from "lucide-react";
import { api, isMockMode } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { Badge, Card, Skeleton } from "../../components/ui";
import { money, toBnDigits } from "../../lib/format";

const CATEGORY_NAMES = {
  electronics: "ইলেকট্রনিক্স",
  fashion: "ফ্যাশন",
  home: "ঘর ও রান্নাঘর",
  beauty: "সৌন্দর্য",
  books: "বই ও স্টেশনারি",
  grocery: "মুদি ও খাবার",
  sports: "খেলাধুলা",
  kids: "শিশু",
};

function Row({ label, value, hint }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-[13.5px] text-ink-2">{label}</p>
        {hint && <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{hint}</p>}
      </div>
      <p className="tnum shrink-0 text-[14px] font-semibold text-ink">{value}</p>
    </div>
  );
}

export default function AdminSettings() {
  const { data, loading } = useAsync(() => api.admin.settings(), []);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-56" />)}
        </div>
      </div>
    );
  }

  const commissionRows = Object.entries(data.commission.byCategory)
    .map(([slug, rate]) => ({ slug, rate: Number(rate) }))
    .sort((a, b) => a.rate - b.rate);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">সেটিংস</h1>
        <p className="mt-0.5 text-[13.5px] text-muted">
          পুরো মার্কেটপ্লেস যে নিয়মে চলছে
        </p>
      </div>

      {/* কেন এখান থেকে বদলানো যায় না */}
      <Card className="flex items-start gap-3 border-accent-200 bg-accent-50 px-4 py-3.5">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent-500" />
        <div className="min-w-0 text-[13px] leading-relaxed text-accent-600">
          <p>
            <b>এই মানগুলো এখান থেকে বদলানো যায় না</b> — ইচ্ছাকৃতভাবে।
            টাকার হিসাব ফ্রন্টএন্ড আর ব্যাকএন্ড দুই জায়গায় হয়; ওয়েব থেকে
            একটা বদলালে অন্যটা জানত না, আর ক্রেতা কার্টে এক টাকা দেখে
            চেকআউটে আরেক টাকা পেতেন।
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <FileCode size={13} />
            বদলাতে হলে <code className="rounded bg-white/70 px-1.5 py-0.5 text-[11.5px]">
              {data.source}
            </code> এ বদলে সার্ভার রিস্টার্ট করুন।
          </p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* কমিশন */}
        <Card className="p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <Percent size={19} />
            </span>
            <div>
              <h2 className="font-display text-[16px] font-semibold text-ink">কমিশন</h2>
              <p className="text-[12px] text-muted">শুধু পণ্যের দামের উপরে</p>
            </div>
            <Badge tone="neutral" className="ml-auto">
              ডিফল্ট {toBnDigits(data.commission.default)}%
            </Badge>
          </div>

          <div className="mt-4">
            {commissionRows.map((row) => (
              <div key={row.slug}
                   className="flex items-center gap-3 border-b border-line py-2 last:border-0">
                <span className="flex-1 text-[13.5px] text-ink-2">
                  {CATEGORY_NAMES[row.slug] ?? row.slug}
                </span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-brand-500"
                       style={{ width: `${(row.rate / 15) * 100}%` }} />
                </div>
                <span className="tnum w-10 text-right text-[13.5px] font-semibold text-ink">
                  {toBnDigits(row.rate)}%
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-[12px] leading-relaxed text-muted">
            কোনো দোকানে আলাদা হার বসানো থাকলে সেটাই চলে — বড় বিক্রেতার
            সাথে আলাদা চুক্তির জন্য। দোকানের পাতা থেকে বদলানো যায়।
          </p>
        </Card>

        {/* ডেলিভারি */}
        <Card className="p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent-50 text-accent-500">
              <Truck size={19} />
            </span>
            <div>
              <h2 className="font-display text-[16px] font-semibold text-ink">
                ডেলিভারি চার্জ
              </h2>
              <p className="text-[12px] text-muted">প্রতি পার্সেলে</p>
            </div>
          </div>

          <div className="mt-4">
            <Row label="ঢাকা সিটির ভেতরে" value={money(data.shipping.insideDhaka)} />
            <Row label="ঢাকার বাইরে" value={money(data.shipping.outsideDhaka)} />
            <Row
              label="২য় পার্সেল থেকে"
              value={`${toBnDigits(data.shipping.extraVendorMultiplier * 100)}%`}
              hint="তিন দোকান থেকে কিনলে ক্রেতা যেন তিনগুণ চার্জ দেখে ভয় না পান"
            />
            <Row
              label="ফ্রি ডেলিভারি"
              value={`${money(data.shipping.freeThreshold)}+`}
              hint="এক দোকান থেকে এর বেশি কিনলে সেই পার্সেল ফ্রি"
            />
          </div>
        </Card>

        {/* টাকা ছাড়ের নিয়ম */}
        <Card className="p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <Clock size={19} />
            </span>
            <div>
              <h2 className="font-display text-[16px] font-semibold text-ink">
                ভেন্ডরের টাকা
              </h2>
              <p className="text-[12px] text-muted">কখন তোলা যাবে</p>
            </div>
          </div>

          <div className="mt-4">
            <Row
              label="হোল্ড পিরিয়ড"
              value={`${toBnDigits(data.payoutHoldDays)} দিন`}
              hint="ডেলিভারির পর এই কয়দিন টাকা আটকে থাকে — ক্রেতার রিটার্নের জন্য"
            />
          </div>

          <ol className="mt-4 space-y-3">
            {[
              ["দিন ০", "অর্ডার ডেলিভারি হলো"],
              [`দিন ${toBnDigits(data.payoutHoldDays)}`, "হোল্ড শেষ, টাকা খুলে গেল"],
              ["+১-২ দিন", "ভেন্ডরের বিকাশ/ব্যাংকে পৌঁছাল"],
            ].map(([day, text], i, arr) => (
              <li key={day} className="relative flex gap-3">
                {i < arr.length - 1 && (
                  <span className="absolute top-6 bottom-[-0.75rem] left-[0.5625rem] w-px bg-line" />
                )}
                <span className="relative z-10 mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-brand-500 bg-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                </span>
                <div>
                  <p className="tnum text-[11.5px] font-semibold text-accent-600">{day}</p>
                  <p className="text-[13px] text-ink-2">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {/* অন্যান্য */}
        <Card className="p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-canvas text-ink-2">
              <ShoppingCart size={19} />
            </span>
            <div>
              <h2 className="font-display text-[16px] font-semibold text-ink">অন্যান্য</h2>
              <p className="text-[12px] text-muted">কার্ট ও স্টকের নিয়ম</p>
            </div>
          </div>

          <div className="mt-4">
            <Row
              label="এক পণ্যের সর্বোচ্চ সংখ্যা"
              value={`${toBnDigits(data.maxQtyPerItem)}টি`}
              hint="একজন ক্রেতা এক অর্ডারে এর বেশি নিতে পারবেন না"
            />
            <Row
              label="কম স্টকের সীমা"
              value={`${toBnDigits(data.lowStockThreshold)}টি`}
              hint="এর নিচে নামলে ভেন্ডরের ড্যাশবোর্ডে সতর্কতা দেখায়"
            />
            <Row
              label="ডেটার উৎস"
              value={isMockMode ? "ডেমো (mock)" : "Django API"}
              hint={isMockMode
                ? "ব্যাকএন্ড ছাড়াই চলছে — .env এ VITE_USE_MOCK=false দিলে আসল API"
                : "সব ডেটা ডেটাবেস থেকে আসছে"}
            />
          </div>

          <p className="mt-3 rounded-lg bg-canvas px-3 py-2.5 text-[12px] leading-relaxed text-muted">
            {data.note}
          </p>
        </Card>
      </div>
    </div>
  );
}
