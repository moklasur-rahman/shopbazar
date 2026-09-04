import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Flame, Store, Clock, BadgeCheck, Sparkles,
  Search, ShoppingBag, Boxes, ShieldCheck,
} from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { useCart } from "../store/CartContext";
import { ProductGrid } from "../components/product/ProductCard";
import { Badge, Button, Card, Rating, SectionHeader, Skeleton, SmartImage } from "../components/ui";
import { classNames as cx, compactNumber, toBnDigits } from "../lib/format";

/* ------------------------------- হিরো ------------------------------- */

function Hero({ banners, loading }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!banners?.length) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), 6000);
    return () => clearInterval(timer);
  }, [banners]);

  if (loading || !banners?.length) {
    return <Skeleton className="h-56 w-full rounded-card sm:h-72 lg:h-80" />;
  }

  const banner = banners[index];
  const tones = {
    brand: "from-brand-800/95 via-brand-700/80",
    dark: "from-ink/95 via-ink/75",
    accent: "from-accent-600/95 via-accent-500/75",
  };

  return (
    <div className="relative overflow-hidden rounded-card">
      <div className="relative h-56 sm:h-72 lg:h-80">
        {banners.map((b, i) => (
          <img
            key={b.id}
            src={b.image}
            alt=""
            className={cx(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
              i === index ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
        <div className={cx("absolute inset-0 bg-gradient-to-r to-transparent", tones[banner.tone])} />

        <div className="relative flex h-full flex-col justify-center px-6 sm:px-10 lg:px-14">
          <Badge tone="glass" className="mb-3 w-fit">
            <Sparkles size={12} /> চলছে অফার
          </Badge>
          <h1 className="max-w-md font-display text-2xl leading-tight font-bold text-white sm:text-3xl lg:text-4xl">
            {banner.title}
          </h1>
          <p className="mt-2 max-w-sm text-sm text-white/85 sm:text-base">{banner.subtitle}</p>
          <Button as={Link} to={banner.href} variant="accent" className="mt-5 w-fit" size="lg">
            {banner.cta} <ArrowRight size={17} />
          </Button>
        </div>
      </div>

      <div className="absolute bottom-4 left-6 flex gap-1.5 sm:left-10 lg:left-14">
        {banners.map((b, i) => (
          <button
            key={b.id}
            onClick={() => setIndex(i)}
            aria-label={`ব্যানার ${i + 1}`}
            className={cx(
              "h-1.5 rounded-full transition-all",
              i === index ? "w-7 bg-white" : "w-2 bg-white/50 hover:bg-white/80",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- ক্যাটাগরি ---------------------------- */

function CategoryStrip({ categories, loading }) {
  return (
    <section>
      <SectionHeader
        title="ক্যাটাগরি"
        subtitle="যা খুঁজছেন, সরাসরি সেখানে যান"
        action={
          <Link to="/products" className="text-sm font-medium text-brand-600 hover:underline">
            সব দেখুন
          </Link>
        }
      />
      <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
        {loading
          ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)
          : categories.map((c) => (
              <Link
                key={c.slug}
                to={`/products?category=${c.slug}`}
                className="group flex flex-col items-center gap-2 rounded-card border border-line bg-surface p-3 text-center shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-xl transition group-hover:bg-brand-100">
                  {c.icon}
                </span>
                <span className="text-[12.5px] leading-tight font-medium text-ink">{c.name}</span>
              </Link>
            ))}
      </div>
    </section>
  );
}

/* ---------------------------- ফ্ল্যাশ সেল --------------------------- */

function Countdown({ endsAt }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(endsAt) - Date.now()));

  useEffect(() => {
    const timer = setInterval(
      () => setLeft(Math.max(0, new Date(endsAt) - Date.now())),
      1000,
    );
    return () => clearInterval(timer);
  }, [endsAt]);

  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const pad = (n) => toBnDigits(String(n).padStart(2, "0"));

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Clock size={14} className="text-sale" />
      <span className="text-muted">শেষ হবে</span>
      {[h, m, s].map((unit, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted">:</span>}
          <span className="tnum rounded bg-ink px-1.5 py-0.5 text-[13px] font-semibold text-white">
            {pad(unit)}
          </span>
        </span>
      ))}
    </span>
  );
}

function FlashSale() {
  const { data, loading } = useAsync(() => api.catalog.getFlashSale(), []);

  return (
    <section>
      <div className="rounded-card border border-accent-200 bg-gradient-to-br from-accent-50 to-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-sale text-white">
              <Flame size={18} />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">ফ্ল্যাশ সেল</h2>
              <p className="text-[13px] text-muted">সীমিত সময়ের জন্য সেরা দাম</p>
            </div>
          </div>
          {data && <Countdown endsAt={data.endsAt} />}
        </div>

        <ProductGrid products={data?.products ?? []} loading={loading} skeletonCount={6} compact />
      </div>
    </section>
  );
}

/* ------------------------------ ভেন্ডর ----------------------------- */

function TopVendors() {
  const { data, loading } = useAsync(() => api.vendors.list({ page_size: 4 }), []);

  return (
    <section>
      <SectionHeader
        title="জনপ্রিয় দোকান"
        subtitle="যাদের কাছ থেকে ক্রেতারা বারবার কেনেন"
        action={
          <Link to="/shops" className="text-sm font-medium text-brand-600 hover:underline">
            সব দোকান
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40" />)
          : data.results.map((v) => (
              <Card key={v.id} hover className="overflow-hidden">
                <Link to={`/shop/${v.slug}`}>
                  <div className="relative h-20">
                    <img src={v.banner} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-ink/25" />
                  </div>
                  <div className="px-4 pb-4">
                    <div className="-mt-7 mb-2 flex items-end gap-3">
                      <SmartImage
                        src={v.logo}
                        alt={v.shopName}
                        className="h-14 w-14 shrink-0 rounded-xl border-2 border-white shadow-soft"
                      />
                      <div className="mb-1 flex items-center gap-1">
                        {v.isVerified && <BadgeCheck size={15} className="text-brand-500" />}
                      </div>
                    </div>
                    <h3 className="truncate font-display text-[15px] font-semibold text-ink">
                      {v.shopName}
                    </h3>
                    <Rating value={v.rating} count={v.ratingCount} size={12} className="mt-1" />
                    <p className="tnum mt-1.5 text-[12.5px] text-muted">
                      {toBnDigits(v.productCount)}টি পণ্য · {v.district}
                    </p>
                  </div>
                </Link>
              </Card>
            ))}
      </div>
    </section>
  );
}

/* ------------------------- সাম্প্রতিক দেখা --------------------------- */

function RecentlyViewed() {
  const { recent } = useCart();
  if (recent.length === 0) return null;

  return (
    <section>
      <SectionHeader title="সম্প্রতি দেখেছেন" />
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        {recent.map((p) => (
          <Link
            key={p.id}
            to={`/product/${p.slug}`}
            className="w-36 shrink-0 overflow-hidden rounded-card border border-line bg-surface shadow-soft transition hover:shadow-lift"
          >
            <SmartImage src={p.image} alt={p.title} />
            <div className="p-2.5">
              <p className="line-clamp-2-safe min-h-[2.6em] text-[12.5px] leading-snug text-ink">
                {p.title}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* --------------------------- কীভাবে কাজ করে -------------------------- */

const HOW_STEPS = [
  {
    icon: Search,
    title: "পছন্দ করুন",
    text: "হাজারো দোকানের পণ্য এক জায়গায়। দাম, রেটিং বা দোকান দিয়ে ফিল্টার করে খুঁজুন।",
  },
  {
    icon: ShoppingBag,
    title: "একসাথে কিনুন",
    text: "আলাদা আলাদা দোকান থেকে নিলেও কার্ট একটাই, পেমেন্টও একবার।",
  },
  {
    icon: Boxes,
    title: "আলাদা পার্সেল পান",
    text: "প্রতিটি দোকান নিজের পণ্য নিজে পাঠায়, তাই পার্সেল আলাদা আসে — ট্র্যাকিংও আলাদা।",
  },
  {
    icon: ShieldCheck,
    title: "নিশ্চিন্তে বুঝে নিন",
    text: "ক্যাশ অন ডেলিভারি, আর পছন্দ না হলে ৭ দিনের মধ্যে ফেরত দেওয়ার সুযোগ।",
  },
];

function HowItWorks() {
  return (
    <section>
      <SectionHeader
        title="কীভাবে কাজ করে"
        subtitle="প্রথমবার কিনছেন? পুরো ব্যাপারটা এক নজরে"
        action={
          <Link to="/help" className="text-sm font-medium text-brand-600 hover:underline">
            বিস্তারিত সাহায্য
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {HOW_STEPS.map((step, i) => (
          <Card key={step.title} className="relative overflow-hidden p-5">
            {/* বড় ম্লান সংখ্যা — ক্রমটা দূর থেকেও বোঝা যায় */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-2 right-2 font-display text-6xl font-bold text-brand-50 select-none"
            >
              {toBnDigits(i + 1)}
            </span>

            <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-brand-500 text-white shadow-soft">
              <step.icon size={20} />
            </span>
            <h3 className="relative mt-3.5 font-display text-[15.5px] font-semibold text-ink">
              {step.title}
            </h3>
            <p className="relative mt-1 text-[13.5px] leading-relaxed text-muted">{step.text}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* -------------------------- ভেন্ডর হওয়ার CTA ------------------------- */

function BecomeVendor() {
  return (
    <section className="bg-dark-gradient bg-dots overflow-hidden rounded-card">
      <div className="grid items-center gap-6 p-6 sm:p-10 lg:grid-cols-2">
        <div>
          <Badge tone="gold" className="mb-3">
            <Store size={12} /> বিক্রেতাদের জন্য
          </Badge>
          <h2 className="font-display text-2xl leading-tight font-bold text-white sm:text-3xl">
            আপনার দোকান এখন সারা দেশে
          </h2>
          <p className="mt-2.5 max-w-md text-sm leading-relaxed text-white/70">
            বিনামূল্যে দোকান খুলুন, পণ্য আপলোড করুন, আর অর্ডার আসা শুরু হলে
            শুধু বিক্রির উপর কমিশন দিন। কোনো মাসিক ফি নেই।
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button as={Link} to="/sell" variant="accent" size="lg">
              কীভাবে শুরু করবেন <ArrowRight size={17} />
            </Button>
            <Button as={Link} to="/register?role=vendor" variant="onDark" size="lg">
              এখনই দোকান খুলুন
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            ["৮%", "গড় কমিশন"],
            ["৪৮ ঘণ্টা", "পেমেন্ট সেটেলমেন্ট"],
            ["০ টাকা", "সেটআপ খরচ"],
          ].map(([big, small]) => (
            <div key={small} className="rounded-xl bg-white/8 p-4 text-center backdrop-blur">
              <p className="font-display text-lg font-bold text-accent-300">{big}</p>
              <p className="mt-0.5 text-[11.5px] leading-tight text-white/60">{small}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- পেজ ------------------------------- */

export default function Home() {
  const banners = useAsync(() => api.catalog.listBanners(), []);
  const categories = useAsync(() => api.catalog.listCategories(), []);
  const trending = useAsync(
    () => api.catalog.listProducts({ ordering: "-sold_count", page_size: 10 }),
    [],
  );
  const newest = useAsync(
    () => api.catalog.listProducts({ ordering: "-created_at", page_size: 10 }),
    [],
  );

  return (
    <div className="container-page space-y-10 py-5 sm:space-y-12 sm:py-7">
      <Hero banners={banners.data} loading={banners.loading} />

      <CategoryStrip categories={categories.data ?? []} loading={categories.loading} />

      <FlashSale />

      <section>
        <SectionHeader
          title="এখন জনপ্রিয়"
          subtitle="সবচেয়ে বেশি বিক্রি হওয়া পণ্য"
          action={
            <Link
              to="/products?ordering=-sold_count"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              সব দেখুন
            </Link>
          }
        />
        <ProductGrid
          products={trending.data?.results ?? []}
          loading={trending.loading}
          skeletonCount={10}
        />
      </section>

      <HowItWorks />

      <TopVendors />

      <section>
        <SectionHeader
          title="নতুন এসেছে"
          subtitle={
            newest.data ? `${compactNumber(newest.data.count)}টি পণ্যের মধ্যে সবচেয়ে নতুন` : ""
          }
          action={
            <Link
              to="/products?ordering=-created_at"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              সব দেখুন
            </Link>
          }
        />
        <ProductGrid
          products={newest.data?.results ?? []}
          loading={newest.loading}
          skeletonCount={10}
        />
      </section>

      <RecentlyViewed />

      <BecomeVendor />
    </div>
  );
}
