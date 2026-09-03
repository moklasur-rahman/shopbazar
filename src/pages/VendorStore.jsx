import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { BadgeCheck, MapPin, Star, Package, Clock, MessageSquare, Store } from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { ProductGrid } from "../components/product/ProductCard";
import { Badge, Button, Card, EmptyState, Pagination, Select, Skeleton, SmartImage } from "../components/ui";
import { formatDate, toBnDigits } from "../lib/format";
import { RULES } from "../config";

const SORTS = [
  { value: "-created_at", label: "নতুন আগে" },
  { value: "-sold_count", label: "জনপ্রিয়তা" },
  { value: "price", label: "দাম: কম থেকে বেশি" },
  { value: "-price", label: "দাম: বেশি থেকে কম" },
];

export default function VendorStore() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);

  const ordering = params.get("ordering") ?? "-created_at";

  const vendor = useAsync(() => api.vendors.get(slug), [slug]);
  const products = useAsync(
    () => api.vendors.products(slug, { ordering, page, page_size: RULES.pageSize }),
    [slug, ordering, page],
  );

  if (vendor.loading) {
    return (
      <div className="container-page space-y-4 py-5">
        <Skeleton className="h-44 rounded-card" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!vendor.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card>
          <EmptyState
            icon={Store}
            title="দোকানটি পাওয়া যায়নি"
            action={<Button as={Link} to="/shops">সব দোকান</Button>}
          />
        </Card>
      </div>
    );
  }

  const v = vendor.data;

  const stats = [
    { icon: Star, label: "রেটিং", value: `${toBnDigits(v.rating.toFixed(1))} / ৫` },
    { icon: Package, label: "পণ্য", value: `${toBnDigits(v.productCount)}টি` },
    { icon: MessageSquare, label: "রেসপন্স", value: `${toBnDigits(v.responseRate)}%` },
    { icon: Clock, label: "পাঠায়", value: `${toBnDigits(v.shipsIn)} দিনে` },
  ];

  return (
    <div className="container-page py-5">
      {/* দোকানের হেডার */}
      <Card className="overflow-hidden">
        <div className="relative h-32 sm:h-44">
          <img src={v.banner} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-ink/10" />
        </div>

        <div className="px-4 pb-4 sm:px-6">
          <div className="-mt-12 flex flex-wrap items-end gap-4">
            <SmartImage
              src={v.logo}
              alt={v.shopName}
              className="h-24 w-24 shrink-0 rounded-2xl border-4 border-white shadow-lift"
            />
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">
                  {v.shopName}
                </h1>
                {v.isVerified && (
                  <Badge tone="ok">
                    <BadgeCheck size={12} /> যাচাই করা
                  </Badge>
                )}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted">
                <span className="flex items-center gap-1">
                  <MapPin size={13} /> {v.district}
                </span>
                <span>যুক্ত হয়েছে {formatDate(v.since)}</span>
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-2.5 rounded-lg border border-line bg-canvas px-3 py-2.5"
              >
                <s.icon size={17} className="shrink-0 text-brand-500" />
                <div className="min-w-0">
                  <p className="text-[11.5px] text-muted">{s.label}</p>
                  <p className="tnum truncate text-[13.5px] font-semibold text-ink">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* পণ্য */}
      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">
          এই দোকানের পণ্য
          {products.data && (
            <span className="tnum ml-2 text-[13.5px] font-normal text-muted">
              ({toBnDigits(products.data.count)}টি)
            </span>
          )}
        </h2>
        <Select
          value={ordering}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            next.set("ordering", e.target.value);
            setParams(next);
            setPage(1);
          }}
          className="h-9 w-48 text-[13px]"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
      </div>

      <ProductGrid
        products={products.data?.results ?? []}
        loading={products.loading}
        skeletonCount={RULES.pageSize}
      />

      <Pagination
        page={page}
        count={products.data?.count ?? 0}
        pageSize={RULES.pageSize}
        onChange={(p) => {
          setPage(p);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="mt-8"
      />
    </div>
  );
}
