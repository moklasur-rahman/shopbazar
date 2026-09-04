import { Link } from "react-router-dom";
import { Heart, X, ShoppingCart } from "lucide-react";
import { useCart } from "../store/CartContext";
import { useToast } from "../store/ToastContext";
import { api } from "../api";
import { Button, Card, EmptyState, Price, Rating, SmartImage } from "../components/ui";
import { toBnDigits } from "../lib/format";

export default function Wishlist() {
  const { wishlist, toggleWishlist, addItem } = useCart();
  const toast = useToast();

  async function moveToCart(item) {
    try {
      const product = await api.catalog.getProduct(item.slug);
      const variant = product.variants.find((v) => v.stock > 0);
      if (!variant) {
        toast.error("এই পণ্যের স্টক শেষ");
        return;
      }
      if (product.variants.length > 1) {
        toast.info("সাইজ/রঙ বেছে নিতে পণ্যের পাতায় যান");
        return;
      }
      addItem(product, variant, 1);
      toggleWishlist(item);
      toast.success("কার্টে যোগ হয়েছে");
    } catch {
      toast.error("পণ্যটি আনা গেল না");
    }
  }

  if (wishlist.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Card>
          <EmptyState
            icon={Heart}
            title="উইশলিস্ট খালি"
            description="পছন্দের পণ্যে ♥ চাপলে সেটা এখানে জমা থাকবে, পরে কেনার জন্য।"
            action={<Button as={Link} to="/products">পণ্য দেখুন</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">উইশলিস্ট</h1>
      <p className="tnum mt-0.5 mb-5 text-[13.5px] text-muted">
        {toBnDigits(wishlist.length)}টি পণ্য সংরক্ষিত
      </p>

      <div className="space-y-3">
        {wishlist.map((item) => (
          <Card key={item.id} className="flex items-center gap-3 p-3">
            <Link to={`/product/${item.slug}`} className="shrink-0">
              <SmartImage src={item.image} alt={item.title} className="h-20 w-20 rounded-lg" />
            </Link>

            <div className="min-w-0 flex-1">
              <Link
                to={`/product/${item.slug}`}
                className="line-clamp-2-safe text-[14px] leading-snug font-medium text-ink hover:text-brand-600"
              >
                {item.title}
              </Link>
              {item.vendorName && (
                <p className="mt-0.5 truncate text-[12px] text-muted">{item.vendorName}</p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <Price value={item.price} compareAt={item.compareAtPrice} size="sm" />
                <Rating value={item.rating} size={11} />
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              <Button size="sm" onClick={() => moveToCart(item)}>
                <ShoppingCart size={14} />
                <span className="hidden sm:inline">কার্টে</span>
              </Button>
              <button
                onClick={() => {
                  toggleWishlist(item);
                  toast.info("সরানো হলো");
                }}
                className="flex items-center justify-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-muted transition hover:border-red-300 hover:text-red-600"
              >
                <X size={13} />
                <span className="hidden sm:inline">সরান</span>
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
