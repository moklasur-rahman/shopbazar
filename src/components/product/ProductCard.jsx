import { Link } from "react-router-dom";
import { Heart, ShoppingCart, Store, Zap } from "lucide-react";
import { Badge, Price, Rating, SmartImage, Skeleton, Card } from "../ui";
import { classNames as cx, discountPercent, toBnDigits } from "../../lib/format";
import { useCart } from "../../store/CartContext";
import { useToast } from "../../store/ToastContext";

export function ProductCard({ product, compact = false }) {
  const { addItem, toggleWishlist, inWishlist } = useCart();
  const toast = useToast();

  const off = discountPercent(product.price, product.compareAtPrice);
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;
  const wished = inWishlist(product.id);

  // এক ভ্যারিয়েন্ট হলে সরাসরি কার্টে, একাধিক হলে ডিটেইল পেজে পাঠানো হয়
  const singleVariant = product.variants?.length === 1 ? product.variants[0] : null;

  function handleAdd(e) {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;
    if (!singleVariant) {
      toast.info("সাইজ বা রঙ বেছে নিতে পণ্যের পাতায় যান");
      return;
    }
    addItem(product, singleVariant, 1);
    toast.success(`কার্টে যোগ হয়েছে — ${product.title.slice(0, 28)}…`);
  }

  function handleWish(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
    toast.info(wished ? "উইশলিস্ট থেকে সরানো হলো" : "উইশলিস্টে যোগ হলো");
  }

  return (
    <Card
      hover
      className="group relative flex h-full flex-col overflow-hidden"
    >
      <Link to={`/product/${product.slug}`} className="block">
        <div className="relative">
          <SmartImage
            src={product.images?.[0]}
            alt={product.title}
            className="transition-transform duration-500 group-hover:scale-[1.04]"
          />

          <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
            {off > 0 && <Badge tone="sale">-{toBnDigits(off)}%</Badge>}
            {product.isFreeShipping && !compact && (
              <Badge tone="ok" className="bg-white/95">ফ্রি ডেলিভারি</Badge>
            )}
          </div>

          <button
            onClick={handleWish}
            aria-label={wished ? "উইশলিস্ট থেকে সরান" : "উইশলিস্টে যোগ করুন"}
            className={cx(
              "absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full backdrop-blur transition",
              wished
                ? "bg-red-500 text-white"
                : "bg-white/90 text-ink-2 hover:bg-white hover:text-red-500",
            )}
          >
            <Heart size={15} className={wished ? "fill-current" : ""} />
          </button>

          {outOfStock && (
            <div className="absolute inset-0 grid place-items-center bg-white/70">
              <span className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white">
                স্টক শেষ
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link to={`/product/${product.slug}`} className="block">
          <h3 className="line-clamp-2-safe min-h-[2.7em] text-[13.5px] leading-snug font-medium text-ink transition group-hover:text-brand-600">
            {product.title}
          </h3>
        </Link>

        <Rating value={product.rating} count={product.ratingCount} size={12} />

        <div className="mt-auto space-y-2">
          <Price value={product.price} compareAt={product.compareAtPrice} />

          {lowStock && (
            <p className="flex items-center gap-1 text-[12px] font-medium text-accent-600">
              <Zap size={12} /> মাত্র {toBnDigits(product.stock)}টি বাকি
            </p>
          )}

          {!compact && product.vendor && (
            <Link
              to={`/shop/${product.vendor.slug}`}
              className="flex items-center gap-1.5 text-[12px] text-muted transition hover:text-brand-600"
            >
              <Store size={12} className="shrink-0" />
              <span className="truncate">{product.vendor.shopName}</span>
            </Link>
          )}

          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className={cx(
              "flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium transition",
              outOfStock
                ? "cursor-not-allowed bg-canvas text-muted"
                : "bg-brand-50 text-brand-700 hover:bg-brand-500 hover:text-white active:scale-[.98]",
            )}
          >
            <ShoppingCart size={14} />
            {outOfStock ? "স্টক নেই" : "কার্টে যোগ করুন"}
          </button>
        </div>
      </div>
    </Card>
  );
}

export function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-2.5 p-3">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-full" />
      </div>
    </Card>
  );
}

export function ProductGrid({ products = [], loading, skeletonCount = 10, compact = false, className }) {
  return (
    <div
      className={cx(
        "grid gap-3 sm:gap-4",
        compact
          ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-6"
          : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
        className,
      )}
    >
      {loading
        ? Array.from({ length: skeletonCount }, (_, i) => <ProductCardSkeleton key={i} />)
        : products.map((p) => <ProductCard key={p.id} product={p} compact={compact} />)}
    </div>
  );
}
