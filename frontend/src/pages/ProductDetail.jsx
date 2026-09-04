import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Heart, ShoppingCart, Zap, Truck, RotateCcw, ShieldCheck, Store,
  BadgeCheck, ChevronRight, MessageSquare, AlertCircle,
} from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { useCart } from "../store/CartContext";
import { useToast } from "../store/ToastContext";
import { ProductGrid } from "../components/product/ProductCard";
import {
  Badge, Button, Card, EmptyState, MobileActionBar, Price, QtyStepper, Rating,
  SectionHeader, Skeleton, SmartImage, Tabs,
} from "../components/ui";
import { classNames as cx, discountPercent, formatDate, money, timeAgo, toBnDigits } from "../lib/format";
import { RULES } from "../config";

/* ------------------------------ গ্যালারি ------------------------------ */

function Gallery({ images = [], title }) {
  const [active, setActive] = useState(0);

  useEffect(() => setActive(0), [title]);

  return (
    <div className="space-y-3">
      <SmartImage
        src={images[active]}
        alt={title}
        className="rounded-card border border-line"
      />
      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cx(
                "h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition",
                i === active ? "border-brand-500" : "border-line hover:border-brand-300",
              )}
              aria-label={`ছবি ${i + 1}`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------- ভ্যারিয়েন্ট পিকার -------------------------- */

/**
 * ভ্যারিয়েন্টের options অবজেক্ট থেকে (যেমন {সাইজ, রঙ}) নিজে থেকেই
 * অপশনের সারি বানায়। ভেন্ডর নতুন ধরনের অপশন যোগ করলেও কোড বদলাতে হবে না।
 */
function VariantPicker({ variants, selected, onSelect }) {
  const optionKeys = useMemo(() => {
    const keys = new Set();
    variants.forEach((v) => Object.keys(v.options ?? {}).forEach((k) => keys.add(k)));
    return [...keys];
  }, [variants]);

  // কোনো আলাদা state নেই — বাছাই করা ভ্যারিয়েন্টই একমাত্র সত্য।
  // (আগে ভেতরে useState ছিল, ফলে প্যারেন্ট ভ্যারিয়েন্ট সেট করলেও এখানে
  //  "বেছে নিন" দেখাত আর কোনো বাটন হাইলাইট হতো না।)
  const choice = selected?.options ?? {};

  if (optionKeys.length === 0) return null;

  function pick(key, value) {
    const next = { ...choice, [key]: value };

    // আগে পুরোপুরি মেলে এমন স্টকে থাকা ভ্যারিয়েন্ট খুঁজি,
    // না পেলে অন্তত এই অপশনটা মেলে এমন একটা
    const match =
      variants.find((v) => v.stock > 0 && optionKeys.every((k) => v.options[k] === next[k])) ??
      variants.find((v) => optionKeys.every((k) => v.options[k] === next[k])) ??
      variants.find((v) => v.options[key] === value && v.stock > 0) ??
      variants.find((v) => v.options[key] === value);

    if (match) onSelect(match);
  }

  return (
    <div className="space-y-4">
      {optionKeys.map((key) => {
        const values = [...new Set(variants.map((v) => v.options[key]).filter(Boolean))];
        return (
          <div key={key}>
            <p className="mb-2 text-[13.5px] font-medium text-ink-2">
              {key}:{" "}
              <span className="font-semibold text-ink">{choice[key] ?? "বেছে নিন"}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {values.map((value) => {
                // এই অপশন বাছলে আদৌ স্টক আছে কি না
                const possible = variants.some(
                  (v) =>
                    v.options[key] === value &&
                    v.stock > 0 &&
                    optionKeys.every((k) => k === key || !choice[k] || v.options[k] === choice[k]),
                );
                const isActive = choice[key] === value;

                return (
                  <button
                    key={value}
                    onClick={() => pick(key, value)}
                    disabled={!possible}
                    className={cx(
                      "min-w-11 rounded-lg border px-3 py-2 text-[13px] font-medium transition",
                      isActive
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : possible
                          ? "border-line-2 bg-white text-ink-2 hover:border-brand-300"
                          : "cursor-not-allowed border-line bg-canvas text-muted line-through",
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------- রিভিউ ------------------------------- */

function ReviewSection({ slug, product }) {
  const { data, loading } = useAsync(() => api.catalog.listReviews(slug), [slug]);
  const reviews = useMemo(() => data?.results ?? [], [data]);

  const buckets = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      counts[5 - Math.round(r.rating)] += 1;
    });
    return counts;
  }, [reviews]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="এখনো কোনো রিভিউ নেই"
        description="এই পণ্যটি কিনলে আপনিই প্রথম রিভিউ দিতে পারেন।"
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <div className="rounded-card border border-line bg-canvas p-5 text-center">
        <p className="tnum font-display text-4xl font-bold text-ink">
          {toBnDigits(product.rating.toFixed(1))}
        </p>
        <Rating value={product.rating} size={16} showValue={false} className="mt-1 justify-center" />
        <p className="tnum mt-1 text-[13px] text-muted">
          {toBnDigits(product.ratingCount)}টি রেটিং
        </p>

        <div className="mt-4 space-y-1.5">
          {buckets.map((count, i) => {
            const star = 5 - i;
            const pct = reviews.length ? (count / reviews.length) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="tnum w-3 text-[12px] text-muted">{toBnDigits(star)}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-accent-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="tnum w-6 text-right text-[12px] text-muted">
                  {toBnDigits(count)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-card border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {r.author.charAt(0)}
                </span>
                <div>
                  <p className="text-[13.5px] font-medium text-ink">{r.author}</p>
                  <div className="flex items-center gap-2">
                    <Rating value={r.rating} size={11} showValue={false} />
                    {r.isVerified && (
                      <Badge tone="ok" className="px-1.5 py-0 text-[10.5px]">
                        যাচাই করা ক্রেতা
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <span className="shrink-0 text-[12px] text-muted">{timeAgo(r.createdAt)}</span>
            </div>

            <p className="mt-2.5 text-[14px] leading-relaxed text-ink-2">{r.comment}</p>

            {r.photos?.length > 0 && (
              <div className="mt-3 flex gap-2">
                {r.photos.map((p, i) => (
                  <img key={i} src={p} alt="" className="h-16 w-16 rounded-lg object-cover" />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- পেজ -------------------------------- */

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { addItem, toggleWishlist, inWishlist, pushRecent, getQuantity } = useCart();

  const { data: product, loading, error } = useAsync(
    () => api.catalog.getProduct(slug),
    [slug],
  );

  const [variant, setVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState("description");

  useEffect(() => {
    if (!product) return;
    const first = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
    setVariant(first);
    setQuantity(1);
    pushRecent(product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const related = useAsync(
    () =>
      product
        ? api.catalog.listProducts({ category: product.category, page_size: 10 })
        : Promise.resolve(null),
    [product?.category],
    { skip: !product },
  );

  if (loading) {
    return (
      <div className="container-page py-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square rounded-card" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card>
          <EmptyState
            icon={AlertCircle}
            title="পণ্যটি পাওয়া যায়নি"
            description="লিংকটি ভুল হতে পারে, অথবা পণ্যটি আর বিক্রি হচ্ছে না।"
            action={<Button as={Link} to="/products">সব পণ্য দেখুন</Button>}
          />
        </Card>
      </div>
    );
  }

  const stock = variant?.stock ?? 0;
  const inCart = variant ? getQuantity(product.id, variant.id) : 0;
  const off = discountPercent(variant?.price ?? product.price, variant?.compareAtPrice);
  const wished = inWishlist(product.id);
  const maxQty = Math.min(stock, RULES.maxQtyPerItem);

  function handleAdd(goToCart = false) {
    if (!variant || stock <= 0) return;
    addItem(product, variant, quantity);
    if (goToCart) navigate("/cart");
    else toast.success(`কার্টে যোগ হয়েছে (${toBnDigits(quantity)}টি)`);
  }

  return (
    <div className="container-page py-5 pb-32 lg:pb-8">
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
        <Link to="/" className="hover:text-brand-600">হোম</Link>
        <ChevronRight size={13} />
        <Link to={`/products?category=${product.category}`} className="hover:text-brand-600">
          {product.categoryName}
        </Link>
        <ChevronRight size={13} />
        <span className="truncate text-ink">{product.title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,460px)_1fr] lg:gap-10">
        <Gallery images={product.images} title={product.title} />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {off > 0 && <Badge tone="sale">-{toBnDigits(off)}% ছাড়</Badge>}
            {product.isFreeShipping && <Badge tone="ok">ফ্রি ডেলিভারি</Badge>}
            {product.soldCount > 200 && (
              <Badge tone="warn">
                <Zap size={11} /> {toBnDigits(product.soldCount)}+ বিক্রি
              </Badge>
            )}
          </div>

          <h1 className="mt-2.5 font-display text-xl leading-snug font-semibold text-ink sm:text-2xl">
            {product.title}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Rating value={product.rating} count={product.ratingCount} size={15} />
            <span className="tnum text-[13px] text-muted">
              {toBnDigits(product.soldCount)} বার বিক্রি হয়েছে
            </span>
          </div>

          <div className="mt-4 rounded-card bg-canvas p-4">
            <Price value={variant?.price ?? product.price} compareAt={variant?.compareAtPrice} size="lg" />
            {off > 0 && (
              <p className="tnum mt-1 text-[13px] font-medium text-sale">
                আপনি বাঁচাচ্ছেন {money((variant?.compareAtPrice ?? 0) - (variant?.price ?? 0))}
              </p>
            )}
          </div>

          <div className="mt-5">
            <VariantPicker
              variants={product.variants}
              selected={variant}
              onSelect={(v) => {
                setVariant(v);
                setQuantity(1);
              }}
            />
          </div>

          {/* স্টক */}
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2.5">
              <span className="text-[13.5px] font-medium text-ink-2">পরিমাণ</span>
              <QtyStepper
                value={quantity}
                onChange={setQuantity}
                max={Math.max(1, maxQty)}
              />
            </div>

            {stock <= 0 ? (
              <Badge tone="danger">স্টক শেষ</Badge>
            ) : stock <= 5 ? (
              <span className="tnum text-[13px] font-medium text-accent-600">
                মাত্র {toBnDigits(stock)}টি বাকি
              </span>
            ) : (
              <span className="tnum text-[13px] text-muted">স্টকে আছে ({toBnDigits(stock)})</span>
            )}
          </div>

          {inCart > 0 && (
            <p className="tnum mt-2 text-[13px] text-brand-600">
              এই ভ্যারিয়েন্টের {toBnDigits(inCart)}টি ইতিমধ্যে কার্টে আছে
            </p>
          )}

          {/* অ্যাকশন */}
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button
              size="lg"
              variant="outline"
              onClick={() => handleAdd(false)}
              disabled={stock <= 0}
              className="flex-1 sm:flex-none sm:px-8"
            >
              <ShoppingCart size={18} /> কার্টে যোগ
            </Button>
            <Button
              size="lg"
              onClick={() => handleAdd(true)}
              disabled={stock <= 0}
              className="flex-1 sm:flex-none sm:px-8"
            >
              এখনই কিনুন
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                toggleWishlist(product);
                toast.info(wished ? "উইশলিস্ট থেকে সরানো হলো" : "উইশলিস্টে যোগ হলো");
              }}
              aria-label="উইশলিস্ট"
              className={cx("h-12 w-12", wished && "border-red-300 text-red-500")}
            >
              <Heart size={19} className={wished ? "fill-current" : ""} />
            </Button>
          </div>

          {/* ভেন্ডর কার্ড */}
          <Card className="mt-5 p-4">
            <div className="flex items-center gap-3">
              <SmartImage
                src={product.vendor.logo}
                alt={product.vendor.shopName}
                className="h-12 w-12 shrink-0 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Link
                    to={`/shop/${product.vendor.slug}`}
                    className="truncate font-display text-[15px] font-semibold text-ink hover:text-brand-600"
                  >
                    {product.vendor.shopName}
                  </Link>
                  {product.vendor.isVerified && (
                    <BadgeCheck size={15} className="shrink-0 text-brand-500" />
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted">
                  <Rating value={product.vendor.rating} size={11} />
                  <span className="tnum">{toBnDigits(product.vendor.productCount)}টি পণ্য</span>
                  <span>{product.vendor.district}</span>
                </div>
              </div>
              <Button as={Link} to={`/shop/${product.vendor.slug}`} variant="subtle" size="sm">
                <Store size={14} /> দোকান
              </Button>
            </div>
          </Card>

          {/* ভরসা */}
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            {[
              [Truck, "ডেলিভারি", `${toBnDigits(product.vendor.shipsIn)}-${toBnDigits(product.vendor.shipsIn + 2)} দিনে`],
              [RotateCcw, "রিটার্ন", "৭ দিনের মধ্যে"],
              [ShieldCheck, "পেমেন্ট", "ক্যাশ অন ডেলিভারি"],
            ].map(([Icon, title, text]) => (
              <div key={title} className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-3 py-2.5">
                <Icon size={17} className="shrink-0 text-brand-500" />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-ink">{title}</p>
                  <p className="truncate text-[11.5px] text-muted">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ট্যাব */}
      <Card className="mt-10 overflow-hidden">
        <Tabs
          active={tab}
          onChange={setTab}
          className="px-2"
          tabs={[
            { value: "description", label: "বিবরণ" },
            { value: "specs", label: "স্পেসিফিকেশন" },
            { value: "reviews", label: "রিভিউ", count: product.ratingCount },
          ]}
        />

        <div className="p-5">
          {tab === "description" && (
            <div className="max-w-2xl text-[14.5px] leading-relaxed text-ink-2">
              <p>{product.description}</p>
              <ul className="mt-4 space-y-1.5">
                {[
                  "১০০% আসল পণ্যের নিশ্চয়তা",
                  "সারা বাংলাদেশে হোম ডেলিভারি",
                  "পণ্যে সমস্যা থাকলে ৭ দিনের মধ্যে ফেরত",
                  `বিক্রেতা: ${product.vendor.shopName}, ${product.vendor.district}`,
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "specs" && (
            <dl className="max-w-xl divide-y divide-line">
              {Object.entries(product.specs).map(([key, value]) => (
                <div key={key} className="flex gap-4 py-2.5">
                  <dt className="w-36 shrink-0 text-[13.5px] text-muted">{key}</dt>
                  <dd className="text-[13.5px] font-medium text-ink">{value}</dd>
                </div>
              ))}
              <div className="flex gap-4 py-2.5">
                <dt className="w-36 shrink-0 text-[13.5px] text-muted">যোগ হয়েছে</dt>
                <dd className="text-[13.5px] font-medium text-ink">
                  {formatDate(product.createdAt)}
                </dd>
              </div>
            </dl>
          )}

          {tab === "reviews" && <ReviewSection slug={slug} product={product} />}
        </div>
      </Card>

      {/* একই ক্যাটাগরির পণ্য */}
      <section className="mt-10">
        <SectionHeader title="একই ধরনের পণ্য" />
        <ProductGrid
          products={(related.data?.results ?? []).filter((p) => p.id !== product.id).slice(0, 10)}
          loading={related.loading}
          skeletonCount={5}
        />
      </section>

      {/* মোবাইলে নিচে আটকানো কেনার বার */}
      <MobileActionBar>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <Price value={variant?.price ?? product.price} compareAt={variant?.compareAtPrice} />
            <p className="text-[11.5px] text-muted">
              {stock > 0 ? `স্টকে আছে · ${toBnDigits(quantity)}টি নিচ্ছেন` : "স্টক শেষ"}
            </p>
          </div>
          <Button
            variant="outline"
            size="lg"
            onClick={() => handleAdd(false)}
            disabled={stock <= 0}
            className="shrink-0 px-4"
            aria-label="কার্টে যোগ করুন"
          >
            <ShoppingCart size={18} />
          </Button>
          <Button
            size="lg"
            onClick={() => handleAdd(true)}
            disabled={stock <= 0}
            className="shrink-0"
          >
            এখনই কিনুন
          </Button>
        </div>
      </MobileActionBar>
    </div>
  );
}
