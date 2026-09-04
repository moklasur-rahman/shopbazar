import { Link } from "react-router-dom";
import {
  TrendingUp, Store, Package, ClipboardList, Wallet, Users,
  ArrowUpRight, AlertCircle, Percent,
} from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { Badge, Button, Card, Skeleton } from "../../components/ui";
import { compactNumber, money, toBnDigits } from "../../lib/format";

/* -------------------------- সাপ্তাহিক বিক্রির চার্ট ------------------------ */

function SalesChart({ data = [] }) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => Number(d.amount)), 1);
  const ceiling = Math.ceil(max / 5000) * 5000 || 5000;
  const ticks = [0, ceiling / 2, ceiling];

  const W = 620, H = 200, padL = 58, padB = 26, padT = 12;
  const chartW = W - padL - 12;
  const chartH = H - padB - padT;
  const bandW = chartW / data.length;
  const barW = Math.min(40, bandW * 0.55);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full min-w-[460px]" role="img"
           aria-label="গত সাত দিনের প্ল্যাটফর্ম বিক্রির বার চার্ট">
        {ticks.map((t) => {
          const y = padT + chartH - (t / ceiling) * chartH;
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={W - 12} y2={y}
                    stroke="var(--color-line)" strokeWidth="1"
                    strokeDasharray={t === 0 ? "0" : "3 3"} />
              <text x={padL - 8} y={y + 4} textAnchor="end"
                    fill="var(--color-muted)" fontSize="11">
                {t === 0 ? "০" : `৳${compactNumber(t)}`}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const value = Number(d.amount);
          const h = (value / ceiling) * chartH;
          const x = padL + i * bandW + (bandW - barW) / 2;
          const y = padT + chartH - h;
          const isLast = i === data.length - 1;
          return (
            <g key={`${d.day}-${i}`}>
              <rect x={x} y={y} width={barW} height={Math.max(2, h)} rx="4"
                    fill={isLast ? "var(--color-ink)" : "var(--color-brand-200)"} />
              <text x={x + barW / 2} y={y - 5} textAnchor="middle"
                    fill="var(--color-ink-2)" fontSize="10" fontWeight="600">
                {compactNumber(value)}
              </text>
              <text x={x + barW / 2} y={H - 8} textAnchor="middle"
                    fill="var(--color-muted)" fontSize="11">
                {d.day}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* -------------------------------- টাইল -------------------------------- */

function Tile({ icon: Icon, label, value, sub, tone = "ink", to }) {
  const tones = {
    ink: "bg-ink text-white",
    brand: "bg-brand-50 text-brand-600",
    accent: "bg-accent-50 text-accent-500",
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

/* --------------------------------- পেজ -------------------------------- */

export default function AdminDashboard() {
  const { data, loading } = useAsync(() => api.admin.stats(), []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const s = data;
  const todoItems = [
    {
      count: s.todo.vendor_approvals ?? 0,
      label: "দোকান অনুমোদনের অপেক্ষায়",
      hint: "NID দেখে অনুমোদন দিন",
      to: "/admin/vendors?status=pending",
      icon: Store,
    },
    {
      count: s.todo.product_approvals ?? 0,
      label: "পণ্য অনুমোদনের অপেক্ষায়",
      hint: "সাইটে প্রকাশের আগে দেখে নিন",
      to: "/admin/products?status=pending",
      icon: Package,
    },
    {
      count: s.todo.payouts ?? 0,
      label: "পে-আউট পাঠানো বাকি",
      hint: `মোট ${money(s.payoutsPendingAmount)}`,
      to: "/admin/payouts?status=processing",
      icon: Wallet,
    },
  ];
  const pendingWork = todoItems.filter((t) => t.count > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">ড্যাশবোর্ড</h1>
        <p className="mt-0.5 text-[13.5px] text-muted">পুরো প্ল্যাটফর্মের অবস্থা</p>
      </div>

      {/* যা করা বাকি */}
      {pendingWork.length > 0 ? (
        <Card className="overflow-hidden border-accent-200">
          <div className="flex items-center gap-2 border-b border-accent-200 bg-accent-50 px-4 py-2.5">
            <AlertCircle size={16} className="text-accent-500" />
            <span className="text-[13.5px] font-semibold text-accent-600">
              আপনার সিদ্ধান্তের অপেক্ষায়
            </span>
          </div>
          <div className="grid gap-px bg-line sm:grid-cols-3">
            {pendingWork.map((item) => (
              <Link key={item.label} to={item.to}
                    className="flex items-center gap-3 bg-white px-4 py-4 transition hover:bg-canvas">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-500">
                  <item.icon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="tnum font-display text-xl font-bold text-ink">
                    {toBnDigits(item.count)}
                  </p>
                  <p className="text-[13px] leading-tight font-medium text-ink-2">
                    {item.label}
                  </p>
                  <p className="text-[11.5px] text-muted">{item.hint}</p>
                </div>
                <ArrowUpRight size={16} className="shrink-0 text-muted" />
              </Link>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="flex items-center gap-3 border-brand-200 bg-brand-50 px-4 py-3.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-white">
            <TrendingUp size={17} />
          </span>
          <p className="text-[14px] text-brand-800">
            সব কাজ শেষ — এখন কোনো অনুমোদন বা পে-আউট বাকি নেই।
          </p>
        </Card>
      )}

      {/* মূল সংখ্যা */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={TrendingUp} label="আজকের বিক্রি" value={money(s.gmvToday)}
              sub={`এ মাসে ${money(s.gmvMonth)}`} />
        <Tile icon={Percent} label="এ মাসের কমিশন" value={money(s.commissionMonth)}
              sub="প্ল্যাটফর্মের আয়" tone="brand" />
        <Tile icon={ClipboardList} label="আজকের অর্ডার"
              value={`${toBnDigits(s.ordersToday)}টি`}
              sub={`মোট ${toBnDigits(s.ordersTotal)}টি`} to="/admin/orders" tone="brand" />
        <Tile icon={Users} label="ক্রেতা" value={toBnDigits(s.customers)}
              sub="নিবন্ধিত অ্যাকাউন্ট" tone="brand" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="p-5">
          <div className="mb-3">
            <h2 className="font-display text-lg font-semibold text-ink">
              গত ৭ দিনের বিক্রি
            </h2>
            <p className="text-[12.5px] text-muted">সব দোকান মিলিয়ে, কমিশনের আগে</p>
          </div>
          <SalesChart data={s.salesTrend} />
        </Card>

        <div className="space-y-3">
          <Card className="p-5">
            <h2 className="font-display text-[15px] font-semibold text-ink">দোকান</h2>
            <div className="mt-3 space-y-2 text-[13.5px]">
              {[
                ["অনুমোদিত", s.vendors.approved, "ok"],
                ["অপেক্ষমাণ", s.vendors.pending, "warn"],
                ["স্থগিত", s.vendors.suspended, "danger"],
              ].map(([label, count, tone]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-muted">{label}</span>
                  <Badge tone={tone}>{toBnDigits(count ?? 0)}</Badge>
                </div>
              ))}
            </div>
            <Button as={Link} to="/admin/vendors" variant="outline" size="sm"
                    className="mt-4 w-full">
              সব দোকান দেখুন
            </Button>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-[15px] font-semibold text-ink">পণ্য</h2>
            <div className="mt-3 space-y-2 text-[13.5px]">
              {[
                ["সচল", s.products.live, "ok"],
                ["অপেক্ষমাণ", s.products.pending, "warn"],
                ["মোট", s.products.total, "neutral"],
              ].map(([label, count, tone]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-muted">{label}</span>
                  <Badge tone={tone}>{toBnDigits(count ?? 0)}</Badge>
                </div>
              ))}
            </div>
            <Button as={Link} to="/admin/products" variant="outline" size="sm"
                    className="mt-4 w-full">
              সব পণ্য দেখুন
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
