import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X, PackageSearch, Check } from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { ProductGrid } from "../components/product/ProductCard";
import { Button, Card, Drawer, EmptyState, Pagination, Select } from "../components/ui";
import { classNames as cx, money, toBnDigits } from "../lib/format";
import { RULES } from "../config";

const SORT_OPTIONS = [
  { value: "-created_at", label: "নতুন আগে" },
  { value: "-sold_count", label: "জনপ্রিয়তা" },
  { value: "price", label: "দাম: কম থেকে বেশি" },
  { value: "-price", label: "দাম: বেশি থেকে কম" },
  { value: "-rating_avg", label: "রেটিং" },
];

const PRICE_BUCKETS = [
  { label: "৳৫০০ এর নিচে", min: "", max: "500" },
  { label: "৳৫০০ – ৳১,৫০০", min: "500", max: "1500" },
  { label: "৳১,৫০০ – ৳৩,০০০", min: "1500", max: "3000" },
  { label: "৳৩,০০০ – ৳১০,০০০", min: "3000", max: "10000" },
  { label: "৳১০,০০০ এর উপরে", min: "10000", max: "" },
];

/*
 * ⚠️ Group আর Row ইচ্ছে করে FilterPanel-এর **বাইরে**।
 *
 * ভেতরে থাকলে প্রতিবার FilterPanel রেন্ডার হওয়ার সময় নতুন করে ফাংশন
 * তৈরি হতো, আর React নতুন ফাংশনকে সম্পূর্ণ আলাদা কম্পোনেন্ট ধরে পুরো
 * সাবট্রি খুলে আবার বসাত। ফল: দামের ঘরে একটা অক্ষর টাইপ করলেই ইনপুট
 * থেকে ফোকাস হারিয়ে যেত — প্রতিটা সংখ্যার পর আবার ক্লিক করতে হতো।
 */

function Group({ title, children }) {
  return (
    <div className="border-b border-line py-4 first:pt-0 last:border-0">
      <h3 className="mb-2.5 font-display text-[15px] font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

function Row({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13.5px] transition",
        active ? "bg-brand-50 font-medium text-brand-700" : "text-ink-2 hover:bg-canvas",
      )}
    >
      <span className="truncate">{children}</span>
      {active && <Check size={15} className="shrink-0" />}
    </button>
  );
}

/* ----------------------------- ফিল্টার প্যানেল ---------------------------- */

function FilterPanel({ params, update, categories, vendors, onDone }) {
  const [minPrice, setMinPrice] = useState(params.get("min_price") ?? "");
  const [maxPrice, setMaxPrice] = useState(params.get("max_price") ?? "");

  const activeCategory = params.get("category") ?? "";
  const activeVendor = params.get("vendor") ?? "";
  const activeRating = params.get("rating") ?? "";
  const freeShipping = params.get("free_shipping") === "true";

  function applyPrice() {
    update({ min_price: minPrice, max_price: maxPrice, page: 1 });
    onDone?.();
  }

  return (
    <div className="px-1">
      <Group title="ক্যাটাগরি">
        <div className="space-y-0.5">
          <Row
            active={!activeCategory}
            onClick={() => {
              update({ category: "", page: 1 });
              onDone?.();
            }}
          >
            সব ক্যাটাগরি
          </Row>
          {(categories ?? []).map((c) => (
            <Row
              key={c.slug}
              active={activeCategory === c.slug}
              onClick={() => {
                update({ category: c.slug, page: 1 });
                onDone?.();
              }}
            >
              <span className="mr-1.5">{c.icon}</span>
              {c.name}
            </Row>
          ))}
        </div>
      </Group>

      <Group title="দাম">
        <div className="space-y-0.5">
          {PRICE_BUCKETS.map((b) => {
            const active =
              (params.get("min_price") ?? "") === b.min &&
              (params.get("max_price") ?? "") === b.max;
            return (
              <Row
                key={b.label}
                active={active}
                onClick={() => {
                  setMinPrice(b.min);
                  setMaxPrice(b.max);
                  update({ min_price: b.min, max_price: b.max, page: 1 });
                  onDone?.();
                }}
              >
                {b.label}
              </Row>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="সর্বনিম্ন"
            className="h-9 w-full rounded-lg border border-line-2 px-2.5 text-[13px] focus:border-brand-400 focus:outline-none"
          />
          <span className="text-muted">–</span>
          <input
            type="number"
            inputMode="numeric"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="সর্বোচ্চ"
            className="h-9 w-full rounded-lg border border-line-2 px-2.5 text-[13px] focus:border-brand-400 focus:outline-none"
          />
          <Button size="sm" variant="subtle" onClick={applyPrice}>
            ঠিক আছে
          </Button>
        </div>
      </Group>

      <Group title="রেটিং">
        <div className="space-y-0.5">
          {[4.5, 4, 3.5].map((r) => (
            <Row
              key={r}
              active={activeRating === String(r)}
              onClick={() => {
                update({ rating: activeRating === String(r) ? "" : String(r), page: 1 });
                onDone?.();
              }}
            >
              {toBnDigits(r)} ★ এবং উপরে
            </Row>
          ))}
        </div>
      </Group>

      <Group title="দোকান">
        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          {(vendors ?? []).map((v) => (
            <Row
              key={v.slug}
              active={activeVendor === v.slug}
              onClick={() => {
                update({ vendor: activeVendor === v.slug ? "" : v.slug, page: 1 });
                onDone?.();
              }}
            >
              {v.shopName}
            </Row>
          ))}
        </div>
      </Group>

      <Group title="অন্যান্য">
        <Row
          active={freeShipping}
          onClick={() => {
            update({ free_shipping: freeShipping ? "" : "true", page: 1 });
            onDone?.();
          }}
        >
          শুধু ফ্রি ডেলিভারি
        </Row>
      </Group>
    </div>
  );
}

/* --------------------------------- পেজ ---------------------------------- */

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [filterOpen, setFilterOpen] = useState(false);

  const query = useMemo(
    () => ({
      search: params.get("search") ?? "",
      category: params.get("category") ?? "",
      vendor: params.get("vendor") ?? "",
      min_price: params.get("min_price") ?? "",
      max_price: params.get("max_price") ?? "",
      rating: params.get("rating") ?? "",
      free_shipping: params.get("free_shipping") ?? "",
      ordering: params.get("ordering") ?? "-created_at",
      page: Number(params.get("page") ?? 1),
      page_size: RULES.pageSize,
    }),
    [params],
  );

  const categories = useAsync(() => api.catalog.listCategories(), []);
  const vendors = useAsync(() => api.vendors.list({ page_size: 50 }), []);
  const products = useAsync(
    () => api.catalog.listProducts(query),
    [JSON.stringify(query)],
  );

  function update(patch) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === "" || value == null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { preventScrollReset: false });
  }

  const activeChips = [
    query.search && { key: "search", label: `“${query.search}”` },
    query.category && {
      key: "category",
      label: categories.data?.find((c) => c.slug === query.category)?.name ?? query.category,
    },
    query.vendor && {
      key: "vendor",
      label: vendors.data?.results.find((v) => v.slug === query.vendor)?.shopName ?? query.vendor,
    },
    (query.min_price || query.max_price) && {
      key: "price",
      label: `${query.min_price ? money(query.min_price) : "৳ ০"} – ${query.max_price ? money(query.max_price) : "সব"}`,
    },
    query.rating && { key: "rating", label: `${toBnDigits(query.rating)}★+` },
    query.free_shipping && { key: "free_shipping", label: "ফ্রি ডেলিভারি" },
  ].filter(Boolean);

  function clearChip(key) {
    if (key === "price") update({ min_price: "", max_price: "", page: 1 });
    else update({ [key]: "", page: 1 });
  }

  const heading =
    categories.data?.find((c) => c.slug === query.category)?.name ??
    (query.search ? `“${query.search}” এর ফলাফল` : "সব পণ্য");

  return (
    <div className="container-page py-5">
      <nav className="mb-3 flex items-center gap-1.5 text-[13px] text-muted">
        <Link to="/" className="hover:text-brand-600">হোম</Link>
        <span>/</span>
        <span className="text-ink">{heading}</span>
      </nav>

      <div className="flex gap-6">
        {/* ডেস্কটপ সাইডবার */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <Card className="sticky top-36 p-4">
            <FilterPanel
              params={params}
              update={update}
              categories={categories.data}
              vendors={vendors.data?.results}
            />
          </Card>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-semibold text-ink sm:text-2xl">{heading}</h1>
              <p className="tnum mt-0.5 text-[13px] text-muted">
                {products.loading
                  ? "খোঁজা হচ্ছে…"
                  : `${toBnDigits(products.data?.count ?? 0)}টি পণ্য পাওয়া গেছে`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setFilterOpen(true)}
              >
                <SlidersHorizontal size={15} /> ফিল্টার
                {activeChips.length > 0 && (
                  <span className="tnum ml-1 rounded bg-brand-500 px-1.5 text-[11px] text-white">
                    {toBnDigits(activeChips.length)}
                  </span>
                )}
              </Button>

              <Select
                value={query.ordering}
                onChange={(e) => update({ ordering: e.target.value, page: 1 })}
                className="h-9 w-44 text-[13px]"
                aria-label="সাজান"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={() => clearChip(chip.key)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-[12.5px] font-medium text-brand-700 transition hover:bg-brand-100"
                >
                  {chip.label}
                  <X size={13} />
                </button>
              ))}
              <button
                onClick={() => setParams(new URLSearchParams())}
                className="text-[12.5px] text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                সব মুছুন
              </button>
            </div>
          )}

          {!products.loading && products.data?.results.length === 0 ? (
            <Card>
              <EmptyState
                icon={PackageSearch}
                title="কোনো পণ্য পাওয়া যায়নি"
                description="ফিল্টার একটু কমিয়ে বা অন্য শব্দ দিয়ে খুঁজে দেখুন।"
                action={
                  <Button onClick={() => setParams(new URLSearchParams())}>ফিল্টার মুছুন</Button>
                }
              />
            </Card>
          ) : (
            <ProductGrid
              products={products.data?.results ?? []}
              loading={products.loading}
              skeletonCount={RULES.pageSize}
            />
          )}

          <Pagination
            page={query.page}
            count={products.data?.count ?? 0}
            pageSize={RULES.pageSize}
            onChange={(p) => {
              update({ page: p });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="mt-8"
          />
        </div>
      </div>

      {/* মোবাইল ফিল্টার */}
      <Drawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="ফিল্টার"
        side="left"
        width="max-w-xs"
      >
        <div className="p-4">
          <FilterPanel
            params={params}
            update={update}
            categories={categories.data}
            vendors={vendors.data?.results}
            onDone={() => setFilterOpen(false)}
          />
        </div>
      </Drawer>
    </div>
  );
}
