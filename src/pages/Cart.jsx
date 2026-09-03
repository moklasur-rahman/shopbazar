import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShoppingCart, Trash2, Store, Tag, X, Truck, ArrowRight, ShieldCheck, Info,
} from "lucide-react";
import { api } from "../api";
import { useCart } from "../store/CartContext";
import { useToast } from "../store/ToastContext";
import {
  Badge, Button, Card, EmptyState, Input, MobileActionBar, Price, QtyStepper,
  Select, SmartImage,
} from "../components/ui";
import { money, toBnDigits } from "../lib/format";
import { DIVISIONS, isInsideDhaka } from "../lib/bd";
import { RULES } from "../config";

/* --------------------------- ভেন্ডর অনুযায়ী গ্রুপ -------------------------- */

function VendorGroup({ group, index }) {
  const { setQuantity, removeItem, removeVendor } = useCart();
  const toast = useToast();

  return (
    <Card className="overflow-hidden">
      {/* দোকানের হেডার */}
      <div className="flex items-center gap-3 border-b border-line bg-canvas px-4 py-3">
        <SmartImage
          src={group.vendor.logo}
          alt={group.vendor.shopName}
          className="h-9 w-9 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <Link
            to={`/shop/${group.vendor.slug}`}
            className="flex items-center gap-1.5 truncate text-[14px] font-semibold text-ink hover:text-brand-600"
          >
            <Store size={14} className="shrink-0 text-muted" />
            {group.vendor.shopName}
          </Link>
          <p className="tnum text-[12px] text-muted">
            পার্সেল {toBnDigits(index + 1)} · {toBnDigits(group.itemCount)}টি পণ্য
          </p>
        </div>
        <button
          onClick={() => {
            removeVendor(group.vendor.id);
            toast.info(`${group.vendor.shopName} এর পণ্য সরানো হলো`);
          }}
          className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600"
          aria-label="এই দোকানের সব পণ্য সরান"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* পণ্যের লাইন */}
      <ul className="divide-y divide-line">
        {group.items.map((item) => {
          const optionText = Object.entries(item.options ?? {})
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ");

          return (
            <li key={item.id} className="flex gap-3 p-4">
              <Link to={`/product/${item.slug}`} className="shrink-0">
                <SmartImage src={item.image} alt={item.title} className="h-20 w-20 rounded-lg" />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Link
                  to={`/product/${item.slug}`}
                  className="line-clamp-2-safe text-[13.5px] leading-snug font-medium text-ink hover:text-brand-600"
                >
                  {item.title}
                </Link>

                {optionText && <p className="text-[12px] text-muted">{optionText}</p>}

                {item.quantity >= item.stock && (
                  <p className="tnum text-[12px] text-accent-600">
                    স্টকে আর মাত্র {toBnDigits(item.stock)}টি আছে
                  </p>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                  <QtyStepper
                    size="sm"
                    value={item.quantity}
                    min={1}
                    max={Math.min(item.stock, RULES.maxQtyPerItem)}
                    onChange={(q) => setQuantity(item.id, q, item.stock)}
                  />

                  <div className="flex items-center gap-3">
                    <Price value={item.price * item.quantity} size="sm" />
                    <button
                      onClick={() => {
                        removeItem(item.id);
                        toast.info("পণ্যটি কার্ট থেকে সরানো হলো");
                      }}
                      className="rounded p-1 text-muted transition hover:text-red-600"
                      aria-label="সরান"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* এই দোকানের সাব-টোটাল */}
      <div className="space-y-1 border-t border-line bg-canvas/60 px-4 py-3 text-[13px]">
        <div className="flex justify-between text-muted">
          <span>পণ্যমূল্য</span>
          <span className="tnum">{money(group.itemsTotal)}</span>
        </div>
        {group.discount > 0 && (
          <div className="flex justify-between text-brand-600">
            <span>কুপন ছাড়</span>
            <span className="tnum">−{money(group.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-muted">
          <span className="flex items-center gap-1.5">
            <Truck size={13} /> ডেলিভারি চার্জ
          </span>
          <span className="tnum">
            {group.shipping === 0 ? (
              <span className="font-medium text-brand-600">ফ্রি</span>
            ) : (
              money(group.shipping)
            )}
          </span>
        </div>
        <div className="flex justify-between border-t border-line pt-1.5 font-semibold text-ink">
          <span>পার্সেল মোট</span>
          <span className="tnum">{money(group.payableTotal)}</span>
        </div>
      </div>
    </Card>
  );
}

/* -------------------------------- কুপন -------------------------------- */

function CouponBox() {
  const { coupon, setCoupon, summary } = useCart();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const found = await api.checkout.validateCoupon(code.trim());
      setCoupon(found);
      toast.success(`কুপন প্রয়োগ হয়েছে — ${found.label}`);
      setCode("");
    } catch (err) {
      toast.error(err.message || "কুপনটি প্রয়োগ করা গেল না");
    } finally {
      setBusy(false);
    }
  }

  if (coupon) {
    return (
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
        <div className="flex items-start gap-2.5">
          <Tag size={16} className="mt-0.5 shrink-0 text-brand-600" />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-brand-800">{coupon.code}</p>
            <p className="text-[12.5px] text-brand-700">{coupon.label}</p>
            {summary.couponError && (
              <p className="mt-1 text-[12.5px] font-medium text-red-600">{summary.couponError}</p>
            )}
          </div>
          <button
            onClick={() => setCoupon(null)}
            className="shrink-0 rounded p-1 text-brand-700 hover:bg-brand-100"
            aria-label="কুপন সরান"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={apply} className="flex gap-2">
      <Input
        icon={Tag}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="কুপন কোড"
        className="h-10"
      />
      <Button type="submit" variant="outline" size="sm" loading={busy} className="h-10 shrink-0">
        প্রয়োগ
      </Button>
    </form>
  );
}

/* --------------------------------- পেজ -------------------------------- */

export default function Cart() {
  const { items, summary, district, setDistrict, clear } = useCart();
  const navigate = useNavigate();

  const allDistricts = Object.values(DIVISIONS).flat().sort();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <EmptyState
            icon={ShoppingCart}
            title="আপনার কার্ট খালি"
            description="পছন্দের পণ্য যোগ করে কেনাকাটা শুরু করুন। এক অর্ডারেই একাধিক দোকান থেকে কিনতে পারবেন।"
            action={
              <Button as={Link} to="/products" size="lg">
                কেনাকাটা শুরু করুন <ArrowRight size={17} />
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="container-page pb-32 lg:pb-8">
      <div className="mt-5 mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">আমার কার্ট</h1>
          <p className="tnum mt-0.5 text-[13.5px] text-muted">
            {toBnDigits(summary.itemCount)}টি পণ্য · {toBnDigits(summary.groups.length)}টি দোকান
          </p>
        </div>
        <button
          onClick={clear}
          className="text-[13px] text-muted underline-offset-2 hover:text-red-600 hover:underline"
        >
          কার্ট খালি করুন
        </button>
      </div>

      {summary.groups.length > 1 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-card border border-sky-200 bg-sky-50 px-4 py-3">
          <Info size={17} className="mt-0.5 shrink-0 text-sky-600" />
          <p className="text-[13px] leading-relaxed text-sky-900">
            আপনার পণ্যগুলো <b>{toBnDigits(summary.groups.length)}টি আলাদা দোকান</b> থেকে আসছে,
            তাই আলাদা পার্সেলে পৌঁছাবে। প্রথম পার্সেলের পূর্ণ ডেলিভারি চার্জ, বাকিগুলোর অর্ধেক —
            আর কোনো দোকান থেকে {money(RULES.shipping.freeShippingThreshold)} টাকার বেশি কিনলে সেই
            পার্সেল ফ্রি।
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {summary.groups.map((group, i) => (
            <VendorGroup key={group.vendor.id} group={group} index={i} />
          ))}
        </div>

        {/* সারাংশ */}
        <div className="lg:sticky lg:top-36 lg:self-start">
          <Card className="p-5">
            <h2 className="font-display text-lg font-semibold text-ink">অর্ডার সারাংশ</h2>

            <div className="mt-4">
              <label className="mb-1.5 block text-[13px] font-medium text-ink-2">
                ডেলিভারি জেলা
              </label>
              <Select value={district} onChange={(e) => setDistrict(e.target.value)}>
                {allDistricts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
              <p className="mt-1.5 text-[12px] text-muted">
                {isInsideDhaka(district)
                  ? `ঢাকা সিটির ভেতরে — ${money(RULES.shipping.insideDhaka)}`
                  : `ঢাকার বাইরে — ${money(RULES.shipping.outsideDhaka)}`}
              </p>
            </div>

            <div className="mt-4">
              <CouponBox />
            </div>

            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-muted">পণ্যমূল্য</dt>
                <dd className="tnum font-medium">{money(summary.itemsTotal)}</dd>
              </div>
              {summary.discount > 0 && (
                <div className="flex justify-between text-brand-600">
                  <dt>কুপন ছাড়</dt>
                  <dd className="tnum font-medium">−{money(summary.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">ডেলিভারি চার্জ</dt>
                <dd className="tnum font-medium">
                  {summary.shippingTotal === 0 ? (
                    <span className="text-brand-600">ফ্রি</span>
                  ) : (
                    money(summary.shippingTotal)
                  )}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-display text-[15px] font-semibold">সর্বমোট</dt>
                <dd className="tnum font-display text-xl font-bold text-brand-700">
                  {money(summary.grandTotal)}
                </dd>
              </div>
            </dl>

            <Button
              size="lg"
              className="mt-4 w-full"
              onClick={() => navigate("/checkout")}
            >
              চেকআউট করুন <ArrowRight size={17} />
            </Button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-muted">
              <ShieldCheck size={13} className="text-brand-500" />
              নিরাপদ পেমেন্ট · ক্যাশ অন ডেলিভারি সুবিধা
            </p>
          </Card>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {["SHOPBAZAR100", "EID15"].map((c) => (
              <Badge key={c} tone="warn" className="cursor-default">
                <Tag size={11} /> {c}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* মোবাইলে নিচে আটকানো চেকআউট বার — অনেক নিচে স্ক্রল করতে হবে না */}
      <MobileActionBar>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] text-muted">
              সর্বমোট ({toBnDigits(summary.itemCount)}টি পণ্য)
            </p>
            <p className="tnum font-display text-lg font-bold text-brand-700">
              {money(summary.grandTotal)}
            </p>
          </div>
          <Button size="lg" onClick={() => navigate("/checkout")} className="shrink-0">
            চেকআউট <ArrowRight size={17} />
          </Button>
        </div>
      </MobileActionBar>
    </div>
  );
}
