/**
 * অ্যাকাউন্ট ছাড়া করা অর্ডার খোঁজার পাতা।
 *
 * ক্যাশ অন ডেলিভারিতে লগইন ছাড়াই অর্ডার করা যায়, তাই ওই ক্রেতাদের
 * অর্ডার দেখার একটা পথ থাকতেই হয় — নইলে অর্ডার করার পর তাঁরা আর
 * কখনো জানতেই পারতেন না পণ্যটা কোথায়।
 *
 * নম্বরের সাথে ফোনও কেন চাওয়া হয়: অর্ডার নম্বর অনুমান করা সহজ
 * (SB-000001, SB-000002…)। শুধু নম্বরে খুলতে দিলে যে কেউ অন্যের নাম,
 * ঠিকানা আর ফোন দেখে ফেলতে পারত।
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { PackageSearch, Search, ArrowRight } from "lucide-react";

import { api } from "../api";
import { Button, Card, Field, Input } from "../components/ui";
import { ORDER_STATUS } from "../lib/bd";
import { classNames as cx, money, toBnDigits } from "../lib/format";

export default function TrackOrder() {
  const [form, setForm] = useState({ orderNumber: "", phone: "" });
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOrder(null);
    try {
      setOrder(await api.orders.track(form));
    } catch (err) {
      setError(err.message || "অর্ডারটি পাওয়া যায়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <PackageSearch size={26} />
        </span>
        <h1 className="mt-3 font-display text-2xl font-semibold text-ink">অর্ডার খুঁজুন</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted">
          অ্যাকাউন্ট ছাড়া অর্ডার করেছেন? অর্ডার নম্বর আর যে মোবাইল নম্বর দিয়ে
          অর্ডার করেছিলেন, দুটো দিলেই অবস্থা দেখতে পাবেন।
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="অর্ডার নম্বর" required>
            <Input
              value={form.orderNumber}
              onChange={(e) => set("orderNumber", e.target.value)}
              placeholder="SB-123456"
              autoComplete="off"
              required
            />
          </Field>
          <Field label="মোবাইল নম্বর" required>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="01712345678"
              inputMode="tel"
              autoComplete="tel"
              required
            />
          </Field>

          {error && (
            <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-[13.5px] text-red-700">
              {error}
            </p>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" loading={busy} className="w-full sm:w-auto">
              <Search size={16} /> খুঁজুন
            </Button>
          </div>
        </form>
      </Card>

      {order && (
        <Card className="mt-5 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
            <div>
              <p className="text-[12.5px] text-muted">অর্ডার নম্বর</p>
              <p className="font-display text-lg font-semibold text-ink">{order.number}</p>
            </div>
            <div className="text-right">
              <p className="text-[12.5px] text-muted">মোট</p>
              <p className="tnum font-display text-lg font-semibold text-ink">
                {money(order.grandTotal)}
              </p>
            </div>
          </div>

          <p className="mt-3 mb-2 text-[13px] font-medium text-ink-2">
            {toBnDigits(order.vendorOrders.length)}টি দোকান থেকে
          </p>

          <ul className="space-y-2.5">
            {order.vendorOrders.map((vo) => {
              const status = ORDER_STATUS[vo.status] ?? { label: vo.status, tone: "neutral" };
              return (
                <li
                  key={vo.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-canvas p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-ink">
                      {vo.vendor?.shopName ?? "দোকান"}
                    </p>
                    <p className="truncate text-[12px] text-muted">
                      {vo.items.map((i) => i.productTitle).join(", ")}
                    </p>
                  </div>
                  <span
                    className={cx(
                      "shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium",
                      status.tone === "success"
                        ? "bg-brand-50 text-brand-700"
                        : status.tone === "danger"
                          ? "bg-red-50 text-red-700"
                          : "bg-line text-ink-2",
                    )}
                  >
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-brand-800">
            অ্যাকাউন্ট খুললে প্রতিবার নম্বর না লিখেই সব অর্ডার এক জায়গায় দেখতে
            পাবেন।{" "}
            <Link to="/register" className="font-medium underline">
              অ্যাকাউন্ট খুলুন
            </Link>
          </p>
        </Card>
      )}

      <p className="mt-6 text-center text-[13.5px] text-muted">
        অ্যাকাউন্ট আছে?{" "}
        <Link
          to="/orders"
          className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
        >
          সব অর্ডার দেখুন <ArrowRight size={14} />
        </Link>
      </p>
    </div>
  );
}
