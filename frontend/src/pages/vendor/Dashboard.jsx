import { Link } from "react-router-dom";
import {
  TrendingUp, Package, ClipboardList, Wallet, AlertTriangle, Star,
  ArrowUpRight, Clock,
} from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { Badge, Button, Card, Skeleton } from "../../components/ui";
import { compactNumber, money, toBnDigits } from "../../lib/format";
import { RULES } from "../../config";

/* ------------------------- সাপ্তাহিক বিক্রির চার্ট ------------------------ */

function SalesChart({ data = [] }) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.amount));
  // পড়ার মতো ছক — সবচেয়ে বড় মানের ঠিক উপরে গোল সংখ্যায় সিলিং
  const ceiling = Math.ceil(max / 5000) * 5000;
  const ticks = [0, ceiling / 2, ceiling];

  const W = 560;
  const H = 190;
  const padL = 54;
  const padB = 26;
  const padT = 10;
  const chartW = W - padL - 10;
  const chartH = H - padB - padT;
  const bandW = chartW / data.length;
  const barW = Math.min(38, bandW * 0.58);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full min-w-[440px]" role="img"
           aria-label="গত সাত দিনের বিক্রির বার চার্ট">
        {/* গ্রিড ও অক্ষের লেবেল */}
        {ticks.map((t) => {
          const y = padT + chartH - (t / ceiling) * chartH;
          return (
            <g key={t}>
              <line
                x1={padL} y1={y} x2={W - 10} y2={y}
                stroke="var(--color-line)" strokeWidth="1"
                strokeDasharray={t === 0 ? "0" : "3 3"}
              />
              <text
                x={padL - 8} y={y + 4} textAnchor="end"
                fill="var(--color-muted)" fontSize="11"
              >
                {t === 0 ? "০" : `৳${compactNumber(t)}`}
              </text>
            </g>
          );
        })}

        {/* বার */}
        {data.map((d, i) => {
          const h = (d.amount / ceiling) * chartH;
          const x = padL + i * bandW + (bandW - barW) / 2;
          const y = padT + chartH - h;
          const isLast = i === data.length - 1;

          return (
            <g key={d.day}>
              <rect
                x={x} y={y} width={barW} height={Math.max(2, h)} rx="4"
                fill={isLast ? "var(--color-brand-500)" : "var(--color-brand-200)"}
              />
              <text
                x={x + barW / 2} y={y - 5} textAnchor="middle"
                fill="var(--color-ink-2)" fontSize="10" fontWeight="600"
              >
                {compactNumber(d.amount)}
              </text>
              <text
                x={x + barW / 2} y={H - 8} textAnchor="middle"
                fill="var(--color-muted)" fontSize="11"
              >
                {d.day}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* --------------------------------- টাইল -------------------------------- */

function StatTile({ icon: Icon, label, value, sub, tone = "brand", to }) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    accent: "bg-accent-50 text-accent-500",
    warn: "bg-red-50 text-red-600",
  };

  const inner = (
    <Card className="h-full p-4 transition hover:shadow-lift">
      <div className="flex items-start justify-between gap-2">
        <span className={`grid h-10 w-10 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon size={19} />
        </span>
        {to && <ArrowUpRight size={15} className="text-muted" />}
      </div>
      <p className="mt-3 text-[12.5px] text-muted">{label}</p>
      <p className="tnum mt-0.5 font-display text-xl font-bold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-muted">{sub}</p>}
    </Card>
  );

  return to ? <Link to={to} className="block h-full">{inner}</Link> : inner;
}

/* --------------------------------- পেজ --------------------------------- */

export default function VendorDashboard() {
  const stats = useAsync(() => api.vendorPanel.stats(), []);
  const recent = useAsync(() => api.vendorPanel.listOrders({ page_size: 5 }), []);

  if (stats.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const s = stats.data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">ড্যাশবোর্ড</h1>
        <p className="mt-0.5 text-[13.5px] text-muted">
          আজকের অবস্থা এক নজরে
        </p>
      </div>

      {/* মূল টাইল */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={TrendingUp}
          label="আজকের বিক্রি"
          value={money(s.todaySales)}
          sub={`এ মাসে ${money(s.monthSales)}`}
        />
        <StatTile
          icon={ClipboardList}
          label="অপেক্ষমাণ অর্ডার"
          value={`${toBnDigits(s.pendingOrders)}টি`}
          sub="দ্রুত কনফার্ম করুন"
          tone="accent"
          to="/vendor/orders"
        />
        <StatTile
          icon={Wallet}
          label="তোলা যাবে"
          value={money(s.availableBalance)}
          sub={`${money(s.onHold)} হোল্ডে আছে`}
          to="/vendor/payouts"
        />
        <StatTile
          icon={Package}
          label="মোট পণ্য"
          value={`${toBnDigits(s.totalProducts)}টি`}
          sub={s.lowStock > 0 ? `${toBnDigits(s.lowStock)}টির স্টক কম` : "স্টক ঠিক আছে"}
          tone={s.lowStock > 0 ? "warn" : "brand"}
          to="/vendor/products"
        />
      </div>

      {s.lowStock > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-accent-200 bg-accent-50 px-4 py-3">
          <AlertTriangle size={18} className="shrink-0 text-accent-500" />
          <p className="flex-1 text-[13.5px] text-accent-600">
            <b className="tnum">{toBnDigits(s.lowStock)}টি পণ্যের</b> স্টক ১৫-এর নিচে নেমেছে।
            স্টক শেষ হলে অর্ডার হারাবেন।
          </p>
          <Button as={Link} to="/vendor/products" size="sm" variant="outline">
            দেখুন
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* চার্ট */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">গত ৭ দিনের বিক্রি</h2>
              <p className="text-[12.5px] text-muted">কমিশন কাটার আগের অঙ্ক</p>
            </div>
            <Badge tone="ok">
              <TrendingUp size={11} /> চলমান
            </Badge>
          </div>
          <SalesChart data={s.salesTrend} />
        </Card>

        {/* দোকানের অবস্থা */}
        <Card className="p-5">
          <h2 className="font-display text-lg font-semibold text-ink">দোকানের অবস্থা</h2>

          <div className="mt-4 space-y-3.5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent-50 text-accent-500">
                <Star size={18} />
              </span>
              <div>
                <p className="tnum text-[15px] font-semibold text-ink">
                  {toBnDigits(s.rating.toFixed(1))} / ৫
                </p>
                <p className="text-[12px] text-muted">ক্রেতাদের গড় রেটিং</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <Clock size={18} />
              </span>
              <div>
                <p className="tnum text-[15px] font-semibold text-ink">
                  {toBnDigits(RULES.payoutHoldDays)} দিন
                </p>
                <p className="text-[12px] text-muted">ডেলিভারির পর টাকা ছাড়ার সময়</p>
              </div>
            </div>

            <div className="rounded-lg bg-canvas p-3 text-[12.5px] leading-relaxed text-muted">
              ডেলিভারি হওয়ার <b className="text-ink">{toBnDigits(RULES.payoutHoldDays)} দিন</b> পর
              টাকা তোলার জন্য খুলে যায় — এই সময়টা রিটার্নের জন্য রাখা হয়।
            </div>
          </div>

          <Button as={Link} to="/vendor/products/new" className="mt-4 w-full">
            নতুন পণ্য যোগ করুন
          </Button>
        </Card>
      </div>

      {/* সাম্প্রতিক অর্ডার */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-display text-lg font-semibold text-ink">সাম্প্রতিক অর্ডার</h2>
          <Link to="/vendor/orders" className="text-[13px] font-medium text-brand-600 hover:underline">
            সব দেখুন
          </Link>
        </div>

        {recent.loading ? (
          <div className="space-y-2 p-5">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : recent.data?.results.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13.5px] text-muted">
            এখনো কোনো অর্ডার আসেনি। ডেমো অর্ডার তৈরি করতে সাইট থেকে কিছু কিনে দেখুন।
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.data.results.map((vo) => (
              <li key={vo.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="tnum text-[13.5px] font-medium text-ink">{vo.subNumber}</p>
                  <p className="tnum text-[12px] text-muted">
                    {toBnDigits(vo.items.length)}টি পণ্য · {money(vo.itemsTotal)}
                  </p>
                </div>
                <Badge tone="warn">{vo.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
