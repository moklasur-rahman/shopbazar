import { useState } from "react";
import {
  BarChart3, Download, TrendingUp, Percent, Truck, PackageCheck,
  Store, Package, AlertTriangle, Calendar,
} from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../store/ToastContext";
import { Badge, Button, Card, Input, Select, Skeleton, Tabs } from "../../components/ui";
import { compactNumber, money, toBnDigits } from "../../lib/format";

/* --------------------------- তারিখের সীমা --------------------------- */

function isoDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "৭ দিন", days: 6 },
  { label: "৩০ দিন", days: 29 },
  { label: "৯০ দিন", days: 89 },
];

/* ----------------------------- লাইন চার্ট ---------------------------- */

function TrendChart({ series = [] }) {
  if (series.length === 0) {
    return (
      <p className="py-12 text-center text-[13.5px] text-muted">
        এই সময়ে কোনো বিক্রি নেই
      </p>
    );
  }

  const max = Math.max(...series.map((d) => d.sales), 1);
  const ceiling = Math.ceil(max / 5000) * 5000 || 5000;
  const W = 720, H = 240, padL = 62, padB = 34, padT = 14;
  const chartW = W - padL - 14;
  const chartH = H - padB - padT;
  const step = series.length > 1 ? chartW / (series.length - 1) : 0;

  const point = (d, i) => [
    padL + i * step,
    padT + chartH - (d.sales / ceiling) * chartH,
  ];

  const line = series.map((d, i) => point(d, i).join(",")).join(" ");
  const area = `${padL},${padT + chartH} ${line} ${padL + (series.length - 1) * step},${padT + chartH}`;

  // অনেক তারিখ হলে সব লেবেল লিখলে জট পাকে
  const labelEvery = Math.ceil(series.length / 8);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-60 w-full min-w-[520px]" role="img"
           aria-label="নির্বাচিত সময়ের বিক্রির রেখাচিত্র">
        {[0, 0.5, 1].map((f) => {
          const y = padT + chartH - f * chartH;
          return (
            <g key={f}>
              <line x1={padL} y1={y} x2={W - 14} y2={y}
                    stroke="var(--color-line)" strokeDasharray={f ? "3 3" : "0"} />
              <text x={padL - 8} y={y + 4} textAnchor="end"
                    fill="var(--color-muted)" fontSize="11">
                {f === 0 ? "০" : `৳${compactNumber(ceiling * f)}`}
              </text>
            </g>
          );
        })}

        <polygon points={area} fill="var(--color-brand-100)" opacity="0.55" />
        <polyline points={line} fill="none" stroke="var(--color-brand-500)"
                  strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {series.map((d, i) => {
          const [x, y] = point(d, i);
          const isLast = i === series.length - 1;
          return (
            <g key={d.date}>
              <circle cx={x} cy={y} r={isLast ? 5 : 3}
                      fill={isLast ? "var(--color-brand-600)" : "var(--color-surface)"}
                      stroke="var(--color-brand-500)" strokeWidth="2" />
              {(i % labelEvery === 0 || isLast) && (
                <text x={x} y={H - 12} textAnchor="middle"
                      fill="var(--color-muted)" fontSize="10.5">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------- টাইল ------------------------------- */

function Metric({ icon: Icon, label, value, sub, tone = "brand" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    accent: "bg-accent-50 text-accent-500",
    ink: "bg-ink text-white",
  };
  return (
    <Card className="p-4">
      <span className={`grid h-10 w-10 place-items-center rounded-lg ${tones[tone]}`}>
        <Icon size={19} />
      </span>
      <p className="mt-3 text-[12.5px] text-muted">{label}</p>
      <p className="tnum mt-0.5 font-display text-xl font-bold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-muted">{sub}</p>}
    </Card>
  );
}

/* -------------------------------- পেজ -------------------------------- */

export default function AdminReports() {
  const toast = useToast();
  const [range, setRange] = useState({ from: isoDaysAgo(29), to: isoDaysAgo(0) });
  const [groupBy, setGroupBy] = useState("day");
  const [tab, setTab] = useState("vendors");
  const [exporting, setExporting] = useState(null);

  const params = { from: range.from, to: range.to };

  const sales = useAsync(
    () => api.admin.salesReport({ ...params, group_by: groupBy }),
    [range.from, range.to, groupBy],
  );
  const vendors = useAsync(() => api.admin.vendorReport(params), [range.from, range.to]);
  const products = useAsync(() => api.admin.productReport(params), [range.from, range.to]);

  async function exportCsv(type) {
    setExporting(type);
    try {
      const name = await api.admin.exportReport(type, params);
      toast.success(`ফাইল নামানো হয়েছে — ${name}`);
    } catch (err) {
      toast.error(err.message || "ফাইলটি নামানো গেল না");
    } finally {
      setExporting(null);
    }
  }

  const t = sales.data?.totals;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">রিপোর্ট</h1>
        <p className="mt-0.5 text-[13.5px] text-muted">
          বাতিল হওয়া পার্সেল বাদ দিয়ে হিসাব করা
        </p>
      </div>

      {/* সময়ের সীমা */}
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-muted" />
          <span className="text-[13px] font-medium text-ink-2">সময়</span>
        </div>

        <div className="flex gap-1.5">
          {PRESETS.map((p) => {
            const active = range.from === isoDaysAgo(p.days) && range.to === isoDaysAgo(0);
            return (
              <button
                key={p.label}
                onClick={() => setRange({ from: isoDaysAgo(p.days), to: isoDaysAgo(0) })}
                className={
                  active
                    ? "rounded-lg bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white"
                    : "rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-ink-2 transition hover:border-brand-300"
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-end gap-2">
          <Input type="date" value={range.from} className="h-9 w-36"
                 onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          <span className="pb-2 text-muted">–</span>
          <Input type="date" value={range.to} className="h-9 w-36"
                 onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
        </div>

        <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
                className="h-9 w-32 text-[13px]">
          <option value="day">দিন অনুযায়ী</option>
          <option value="month">মাস অনুযায়ী</option>
        </Select>

        <div className="ml-auto flex flex-wrap gap-1.5">
          {[
            ["orders", "অর্ডার"],
            ["vendors", "দোকান"],
            ["products", "পণ্য"],
          ].map(([type, label]) => (
            <Button key={type} variant="outline" size="sm"
                    loading={exporting === type} onClick={() => exportCsv(type)}>
              <Download size={14} /> {label} CSV
            </Button>
          ))}
        </div>
      </Card>

      {/* মূল সংখ্যা */}
      {sales.loading || !t ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={TrendingUp} label="মোট বিক্রি" value={money(t.sales)}
                  sub={`${toBnDigits(t.parcels)}টি পার্সেল`} tone="ink" />
          <Metric icon={Percent} label="প্ল্যাটফর্মের কমিশন" value={money(t.commission)}
                  sub={t.sales > 0
                    ? `বিক্রির ${toBnDigits((t.commission / t.sales * 100).toFixed(1))}%`
                    : "—"} />
          <Metric icon={Truck} label="ডেলিভারি চার্জ" value={money(t.shipping)}
                  sub={`ছাড় দেওয়া হয়েছে ${money(t.discount)}`} tone="accent" />
          <Metric icon={PackageCheck} label="ডেলিভারি হার"
                  value={`${toBnDigits(t.deliveryRate)}%`}
                  sub={`${toBnDigits(t.delivered)}টি সফল`} />
        </div>
      )}

      {/* চার্ট */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">বিক্রির ধারা</h2>
            <p className="tnum text-[12.5px] text-muted">
              {sales.data ? `${sales.data.from} থেকে ${sales.data.to}` : ""}
            </p>
          </div>
          <Badge tone="neutral">
            {groupBy === "month" ? "মাস অনুযায়ী" : "দিন অনুযায়ী"}
          </Badge>
        </div>
        {sales.loading ? (
          <Skeleton className="h-60" />
        ) : (
          <TrendChart series={sales.data.series} />
        )}
      </Card>

      {/* বিস্তারিত টেবিল */}
      <Card className="overflow-hidden">
        <Tabs
          active={tab}
          onChange={setTab}
          className="px-2"
          tabs={[
            { value: "vendors", label: "দোকান অনুযায়ী" },
            { value: "products", label: "সেরা পণ্য" },
            { value: "categories", label: "ক্যাটাগরি" },
            { value: "stock", label: "কম স্টক" },
          ]}
        />

        <div className="overflow-x-auto">
          {tab === "vendors" && (
            vendors.loading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : (
              <table className="w-full min-w-[620px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-line bg-canvas text-left text-[12px] text-muted">
                    <th className="px-4 py-2.5 font-medium">দোকান</th>
                    <th className="px-4 py-2.5 font-medium">পার্সেল</th>
                    <th className="px-4 py-2.5 font-medium">বিক্রি</th>
                    <th className="px-4 py-2.5 font-medium">কমিশন</th>
                    <th className="px-4 py-2.5 font-medium">ভেন্ডরের প্রাপ্য</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {vendors.data.map((row) => (
                    <tr key={row.vendorId} className="transition hover:bg-canvas/60">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <Store size={13} className="text-muted" />
                          {row.shopName}
                        </span>
                        {row.district && (
                          <span className="text-[11.5px] text-muted">{row.district}</span>
                        )}
                      </td>
                      <td className="tnum px-4 py-2.5">{toBnDigits(row.parcels)}</td>
                      <td className="tnum px-4 py-2.5 font-medium">{money(row.sales)}</td>
                      <td className="tnum px-4 py-2.5 text-brand-700">
                        {money(row.commission)}
                      </td>
                      <td className="tnum px-4 py-2.5">{money(row.payable)}</td>
                    </tr>
                  ))}
                  {vendors.data.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted">
                        এই সময়ে কোনো বিক্রি নেই
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )
          )}

          {tab === "products" && (
            products.loading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : (
              <table className="w-full min-w-[520px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-line bg-canvas text-left text-[12px] text-muted">
                    <th className="px-4 py-2.5 font-medium">পণ্য</th>
                    <th className="px-4 py-2.5 font-medium">সংখ্যা</th>
                    <th className="px-4 py-2.5 font-medium">আয়</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {products.data.topProducts.map((row, i) => (
                    <tr key={`${row.slug}-${i}`} className="transition hover:bg-canvas/60">
                      <td className="px-4 py-2.5">
                        <span className="tnum mr-2 text-muted">{toBnDigits(i + 1)}.</span>
                        {row.title}
                      </td>
                      <td className="tnum px-4 py-2.5">{toBnDigits(row.quantity)}</td>
                      <td className="tnum px-4 py-2.5 font-medium">{money(row.revenue)}</td>
                    </tr>
                  ))}
                  {products.data.topProducts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-muted">
                        এই সময়ে কোনো বিক্রি নেই
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )
          )}

          {tab === "categories" && !products.loading && (
            <div className="space-y-3 p-4">
              {products.data.byCategory.map((row) => {
                const top = products.data.byCategory[0]?.revenue || 1;
                return (
                  <div key={row.slug || row.name}>
                    <div className="mb-1 flex items-baseline justify-between text-[13.5px]">
                      <span className="text-ink">{row.name}</span>
                      <span className="tnum font-medium text-ink">
                        {money(row.revenue)}
                        <span className="ml-2 text-[12px] text-muted">
                          {toBnDigits(row.quantity)}টি
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-brand-500"
                           style={{ width: `${(row.revenue / top) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
              {products.data.byCategory.length === 0 && (
                <p className="py-10 text-center text-muted">এই সময়ে কোনো বিক্রি নেই</p>
              )}
            </div>
          )}

          {tab === "stock" && !products.loading && (
            <table className="w-full min-w-[520px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-[12px] text-muted">
                  <th className="px-4 py-2.5 font-medium">পণ্য</th>
                  <th className="px-4 py-2.5 font-medium">দোকান</th>
                  <th className="px-4 py-2.5 font-medium">স্টক</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {products.data.lowStock.map((row) => (
                  <tr key={row.slug} className="transition hover:bg-canvas/60">
                    <td className="px-4 py-2.5">{row.title}</td>
                    <td className="px-4 py-2.5 text-muted">{row.vendor}</td>
                    <td className="px-4 py-2.5">
                      <span className="tnum inline-flex items-center gap-1.5 font-semibold text-accent-600">
                        <AlertTriangle size={13} /> {toBnDigits(row.stock)}
                      </span>
                    </td>
                  </tr>
                ))}
                {products.data.lowStock.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-muted">
                      <Package size={20} className="mx-auto mb-2 text-line-2" />
                      সব পণ্যের স্টক ঠিক আছে
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-[12px] text-muted">
        <BarChart3 size={13} />
        CSV ফাইলগুলো Excel-এ বাংলা ঠিকভাবে দেখাবে
      </p>
    </div>
  );
}
