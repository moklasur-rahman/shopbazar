import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, CreditCard, Package, Check, ArrowLeft, Store, Truck } from "lucide-react";
import { api } from "../api";
import { useCart } from "../store/CartContext";
import { useAuth } from "../store/AuthContext";
import { useToast } from "../store/ToastContext";
import { Button, Card, Field, Input, Select, Textarea, SmartImage, Badge } from "../components/ui";
import { classNames as cx, isValidBdPhone, money, toBnDigits } from "../lib/format";
import { DIVISIONS, DIVISION_NAMES, PAYMENT_METHODS, isInsideDhaka } from "../lib/bd";

const STEPS = [
  { id: 1, label: "ঠিকানা", icon: MapPin },
  { id: 2, label: "পেমেন্ট", icon: CreditCard },
  { id: 3, label: "যাচাই", icon: Package },
];

function Stepper({ current }) {
  return (
    <ol className="mb-6 flex items-center">
      {STEPS.map((step, i) => {
        const done = current > step.id;
        const active = current === step.id;
        return (
          <li key={step.id} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2.5">
              <span
                className={cx(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition",
                  done
                    ? "border-brand-500 bg-brand-500 text-white"
                    : active
                      ? "border-brand-500 bg-white text-brand-600"
                      : "border-line-2 bg-white text-muted",
                )}
              >
                {done ? <Check size={16} /> : <step.icon size={16} />}
              </span>
              <span
                className={cx(
                  "hidden text-[13.5px] font-medium sm:block",
                  active || done ? "text-ink" : "text-muted",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cx(
                  "mx-3 h-0.5 flex-1 rounded transition",
                  done ? "bg-brand-500" : "bg-line",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { items, summary, coupon, district, setDistrict, clear } = useCart();

  const [step, setStep] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [errors, setErrors] = useState({});

  const [address, setAddress] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    division: "ঢাকা",
    district: district,
    thana: "",
    addressLine: "",
    note: "",
  });
  const [payment, setPayment] = useState("cod");

  // কার্ট খালি হয়ে গেলে চেকআউটে থাকার মানে নেই।
  // `placed` শর্তটা জরুরি: অর্ডার সফল হলে কার্ট খালি করা হয়, তখন এই
  // গার্ডটা "সফল হয়েছে" পাতার বদলে কার্টে ফেরত পাঠিয়ে দিচ্ছিল।
  useEffect(() => {
    if (!placed && items.length === 0) navigate("/cart", { replace: true });
  }, [items.length, navigate, placed]);

  // ইউজারের তথ্য আসার পর নাম ও মোবাইল বসিয়ে দাও।
  // useState-এর initializer একবারই চলে, আর আসল API থেকে ইউজার আসতে
  // নেটওয়ার্ক রাউন্ড-ট্রিপ লাগে — তাই ওখানে ভরসা করা যায় না।
  // যা ইতিমধ্যে টাইপ করা হয়েছে সেটা কখনো মুছবে না।
  useEffect(() => {
    if (!user) return;
    setAddress((current) => ({
      ...current,
      name: current.name || user.name || "",
      phone: current.phone || user.phone || "",
    }));
  }, [user]);

  // জেলা বদলালে ডেলিভারি চার্জও বদলাবে
  useEffect(() => {
    setDistrict(address.district);
  }, [address.district, setDistrict]);

  function set(field, value) {
    setAddress((a) => ({ ...a, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validateAddress() {
    const next = {};
    if (!address.name.trim()) next.name = "নাম লিখুন";
    if (!isValidBdPhone(address.phone)) next.phone = "সঠিক মোবাইল নম্বর দিন (যেমন ০১৭xxxxxxxx)";
    if (!address.district) next.district = "জেলা বেছে নিন";
    if (!address.thana.trim()) next.thana = "থানা/উপজেলা লিখুন";
    if (address.addressLine.trim().length < 10) {
      next.addressLine = "বিস্তারিত ঠিকানা লিখুন (অন্তত ১০ অক্ষর)";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function placeOrder() {
    setPlacing(true);
    try {
      const order = await api.orders.create({
        items,
        address,
        paymentMethod: payment,
        couponCode: coupon?.code ?? null,
      });
      setPlaced(true);
      clear();
      navigate(`/order-success/${order.number}`, { replace: true });
    } catch (err) {
      toast.error(err.message || "অর্ডার করা গেল না, আবার চেষ্টা করুন");
    } finally {
      setPlacing(false);
    }
  }

  // কার্ট খালি মানে হয় রিডাইরেক্ট হচ্ছে, নয় অর্ডার হয়ে গেছে — দুই ক্ষেত্রেই
  // এখানে কিছু আঁকার দরকার নেই।
  if (items.length === 0) return null;

  const districts = DIVISIONS[address.division] ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      <Link
        to="/cart"
        className="mb-3 inline-flex items-center gap-1.5 text-[13.5px] text-muted transition hover:text-brand-600"
      >
        <ArrowLeft size={15} /> কার্টে ফিরে যান
      </Link>

      <h1 className="mb-5 font-display text-2xl font-semibold text-ink">চেকআউট</h1>

      <Stepper current={step} />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* ধাপ ১ — ঠিকানা */}
          <Card className={cx("p-5", step !== 1 && "opacity-60")}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <MapPin size={18} className="text-brand-500" /> ডেলিভারি ঠিকানা
              </h2>
              {step > 1 && (
                <button
                  onClick={() => setStep(1)}
                  className="text-[13px] font-medium text-brand-600 hover:underline"
                >
                  বদলান
                </button>
              )}
            </div>

            {step === 1 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="প্রাপকের নাম" required error={errors.name}>
                  <Input
                    value={address.name}
                    onChange={(e) => set("name", e.target.value)}
                    invalid={!!errors.name}
                    placeholder="যেমন: রফিকুল ইসলাম"
                  />
                </Field>

                <Field label="মোবাইল নম্বর" required error={errors.phone}>
                  <Input
                    value={address.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    invalid={!!errors.phone}
                    inputMode="numeric"
                    placeholder="01712345678"
                    className="tnum"
                  />
                </Field>

                <Field label="বিভাগ" required>
                  <Select
                    value={address.division}
                    onChange={(e) => {
                      const div = e.target.value;
                      setAddress((a) => ({ ...a, division: div, district: DIVISIONS[div][0] }));
                    }}
                  >
                    {DIVISION_NAMES.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="জেলা" required error={errors.district}>
                  <Select
                    value={address.district}
                    onChange={(e) => set("district", e.target.value)}
                    invalid={!!errors.district}
                  >
                    {districts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="থানা / উপজেলা" required error={errors.thana}>
                  <Input
                    value={address.thana}
                    onChange={(e) => set("thana", e.target.value)}
                    invalid={!!errors.thana}
                    placeholder="যেমন: ধানমন্ডি"
                  />
                </Field>

                <Field
                  label="বিস্তারিত ঠিকানা"
                  required
                  error={errors.addressLine}
                  className="sm:col-span-2"
                  hint="বাসা/হোল্ডিং নম্বর, রোড, এলাকা — কুরিয়ার যেন সহজে খুঁজে পায়"
                >
                  <Textarea
                    value={address.addressLine}
                    onChange={(e) => set("addressLine", e.target.value)}
                    invalid={!!errors.addressLine}
                    placeholder="বাসা ১২, রোড ৫, ধানমন্ডি আবাসিক এলাকা"
                  />
                </Field>

                <Field label="ডেলিভারি নোট (ঐচ্ছিক)" className="sm:col-span-2">
                  <Input
                    value={address.note}
                    onChange={(e) => set("note", e.target.value)}
                    placeholder="যেমন: বিকেলের পর কল দিবেন"
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Button
                    size="lg"
                    onClick={() => validateAddress() && setStep(2)}
                    className="w-full sm:w-auto"
                  >
                    পেমেন্টে যান
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-[14px] text-ink-2">
                <p className="font-medium text-ink">
                  {address.name} · <span className="tnum">{toBnDigits(address.phone)}</span>
                </p>
                <p className="mt-0.5">
                  {address.addressLine}, {address.thana}, {address.district}, {address.division}
                </p>
                {address.note && <p className="mt-0.5 text-muted">নোট: {address.note}</p>}
              </div>
            )}
          </Card>

          {/* ধাপ ২ — পেমেন্ট */}
          <Card className={cx("p-5", step < 2 && "pointer-events-none opacity-50")}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <CreditCard size={18} className="text-brand-500" /> পেমেন্ট পদ্ধতি
              </h2>
              {step > 2 && (
                <button
                  onClick={() => setStep(2)}
                  className="text-[13px] font-medium text-brand-600 hover:underline"
                >
                  বদলান
                </button>
              )}
            </div>

            {step >= 2 && (
              <>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPayment(m.id)}
                      disabled={step > 2}
                      className={cx(
                        "flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition",
                        payment === m.id
                          ? "border-brand-500 bg-brand-50"
                          : "border-line bg-white hover:border-brand-300",
                      )}
                    >
                      <span className="text-2xl">{m.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-ink">{m.name}</span>
                        <span className="block text-[12px] text-muted">{m.hint}</span>
                      </span>
                      {payment === m.id && (
                        <Check size={17} className="shrink-0 text-brand-600" />
                      )}
                    </button>
                  ))}
                </div>

                {payment !== "cod" && (
                  <p className="mt-3 rounded-lg bg-accent-50 px-3.5 py-2.5 text-[13px] text-accent-600">
                    ডেমো মোডে আসল পেমেন্ট হবে না। Django-তে SSLCommerz যুক্ত করলে এখান থেকে
                    গেটওয়ের পেজে পাঠানো হবে, আর ওয়েবহুক এসে অর্ডার নিশ্চিত করবে।
                  </p>
                )}

                {step === 2 && (
                  <Button size="lg" className="mt-4 w-full sm:w-auto" onClick={() => setStep(3)}>
                    অর্ডার যাচাই করুন
                  </Button>
                )}
              </>
            )}
          </Card>

          {/* ধাপ ৩ — যাচাই */}
          {step === 3 && (
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
                <Package size={18} className="text-brand-500" /> যা যা আসছে
              </h2>

              <div className="space-y-3">
                {summary.groups.map((group, i) => (
                  <div key={group.vendor.id} className="rounded-xl border border-line">
                    <div className="flex items-center gap-2.5 border-b border-line bg-canvas px-3.5 py-2.5">
                      <Store size={14} className="shrink-0 text-muted" />
                      <span className="flex-1 truncate text-[13.5px] font-semibold text-ink">
                        {group.vendor.shopName}
                      </span>
                      <Badge tone="neutral">পার্সেল {toBnDigits(i + 1)}</Badge>
                    </div>

                    <ul className="divide-y divide-line">
                      {group.items.map((item) => (
                        <li key={item.id} className="flex items-center gap-3 px-3.5 py-2.5">
                          <SmartImage
                            src={item.image}
                            alt={item.title}
                            className="h-11 w-11 shrink-0 rounded-lg"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2-safe text-[13px] leading-snug text-ink">
                              {item.title}
                            </p>
                            <p className="tnum text-[12px] text-muted">
                              {toBnDigits(item.quantity)} × {money(item.price)}
                            </p>
                          </div>
                          <span className="tnum shrink-0 text-[13.5px] font-semibold">
                            {money(item.price * item.quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center justify-between border-t border-line px-3.5 py-2 text-[12.5px]">
                      <span className="flex items-center gap-1.5 text-muted">
                        <Truck size={13} />
                        {group.shipping === 0 ? "ফ্রি ডেলিভারি" : `ডেলিভারি ${money(group.shipping)}`}
                      </span>
                      <span className="tnum font-semibold text-ink">
                        {money(group.payableTotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                size="lg"
                className="mt-5 w-full"
                loading={placing}
                onClick={placeOrder}
              >
                {placing ? "অর্ডার হচ্ছে…" : `অর্ডার নিশ্চিত করুন · ${money(summary.grandTotal)}`}
              </Button>

              <p className="mt-2.5 text-center text-[12px] text-muted">
                অর্ডার করলে আপনি আমাদের শর্তাবলী মেনে নিচ্ছেন।
              </p>
            </Card>
          )}
        </div>

        {/* সারাংশ */}
        <div className="lg:sticky lg:top-36 lg:self-start">
          <Card className="p-5">
            <h2 className="font-display text-lg font-semibold">সারাংশ</h2>

            <dl className="mt-4 space-y-2 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-muted">পণ্য ({toBnDigits(summary.itemCount)}টি)</dt>
                <dd className="tnum font-medium">{money(summary.itemsTotal)}</dd>
              </div>
              {summary.discount > 0 && (
                <div className="flex justify-between text-brand-600">
                  <dt>কুপন ({coupon?.code})</dt>
                  <dd className="tnum font-medium">−{money(summary.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">
                  ডেলিভারি ({toBnDigits(summary.groups.length)} পার্সেল)
                </dt>
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

            <div className="mt-4 rounded-lg bg-canvas p-3 text-[12.5px] leading-relaxed text-muted">
              <p>
                <b className="text-ink">ডেলিভারি:</b>{" "}
                {isInsideDhaka(address.district) ? "ঢাকা সিটি — ২৪-৪৮ ঘণ্টা" : "ঢাকার বাইরে — ৩-৫ দিন"}
              </p>
              <p className="mt-1">
                <b className="text-ink">পেমেন্ট:</b>{" "}
                {PAYMENT_METHODS.find((m) => m.id === payment)?.name}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
