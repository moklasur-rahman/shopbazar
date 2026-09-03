import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Package, Store, Truck, Home, Receipt } from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { Badge, Button, Card, Skeleton, SmartImage } from "../components/ui";
import { formatDate, money, toBnDigits } from "../lib/format";
import { PAYMENT_METHODS } from "../lib/bd";

export default function OrderSuccess() {
  const { number } = useParams();
  const { data: order, loading } = useAsync(() => api.orders.get(number), [number]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 text-center">
        <p className="text-muted">অর্ডারটি পাওয়া যায়নি।</p>
        <Button as={Link} to="/" className="mt-4">হোমে যান</Button>
      </div>
    );
  }

  const paymentLabel =
    PAYMENT_METHODS.find((m) => m.id === order.paymentMethod)?.name ?? order.paymentMethod;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* সফল বার্তা */}
      <div className="rounded-card border border-brand-200 bg-brand-50 p-6 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-500 text-white">
          <CheckCircle2 size={32} />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-brand-800">
          অর্ডার সফল হয়েছে!
        </h1>
        <p className="mt-1.5 text-[14.5px] text-brand-700">
          ধন্যবাদ। আপনার অর্ডার নম্বর{" "}
          <b className="tnum">{order.number}</b>
        </p>
        <p className="mt-1 text-[13px] text-brand-600">
          {formatDate(order.createdAt, { withTime: true })} · {paymentLabel}
        </p>
      </div>

      {order.vendorOrders.length > 1 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-card border border-sky-200 bg-sky-50 px-4 py-3">
          <Package size={17} className="mt-0.5 shrink-0 text-sky-600" />
          <p className="text-[13px] leading-relaxed text-sky-900">
            আপনার অর্ডারটি <b>{toBnDigits(order.vendorOrders.length)}টি দোকান</b> থেকে আসছে,
            তাই <b>{toBnDigits(order.vendorOrders.length)}টি আলাদা পার্সেলে</b> পৌঁছাবে।
            প্রতিটি পার্সেল আলাদাভাবে ট্র্যাক করতে পারবেন।
          </p>
        </div>
      )}

      {/* পার্সেলগুলো */}
      <div className="mt-4 space-y-3">
        {order.vendorOrders.map((vo, i) => (
          <Card key={vo.id} className="overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-line bg-canvas px-4 py-3">
              <Store size={15} className="shrink-0 text-muted" />
              <span className="flex-1 truncate text-[14px] font-semibold text-ink">
                {vo.vendor.shopName}
              </span>
              <Badge tone="warn">পার্সেল {toBnDigits(i + 1)}</Badge>
            </div>

            <ul className="divide-y divide-line">
              {vo.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <SmartImage
                    src={item.image}
                    alt={item.productTitle}
                    className="h-12 w-12 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2-safe text-[13px] leading-snug text-ink">
                      {item.productTitle}
                    </p>
                    <p className="tnum text-[12px] text-muted">
                      {toBnDigits(item.quantity)} × {money(item.unitPrice)}
                    </p>
                  </div>
                  <span className="tnum shrink-0 text-[13.5px] font-semibold">
                    {money(item.unitPrice * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[12.5px] text-muted">
              <span className="flex items-center gap-1.5">
                <Truck size={13} />
                {toBnDigits(vo.vendor.shipsIn)}-{toBnDigits(vo.vendor.shipsIn + 2)} দিনে পৌঁছাবে
              </span>
              <span className="tnum font-semibold text-ink">{money(vo.itemsTotal + vo.shipping - vo.discount)}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* বিল */}
      <Card className="mt-4 p-5">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold">
          <Receipt size={16} className="text-brand-500" /> বিলের হিসাব
        </h2>
        <dl className="mt-3 space-y-2 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-muted">পণ্যমূল্য</dt>
            <dd className="tnum">{money(order.itemsTotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-brand-600">
              <dt>ছাড়</dt>
              <dd className="tnum">−{money(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">ডেলিভারি চার্জ</dt>
            <dd className="tnum">{money(order.shippingTotal)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 font-semibold">
            <dt>সর্বমোট</dt>
            <dd className="tnum text-brand-700">{money(order.grandTotal)}</dd>
          </div>
        </dl>

        <div className="mt-4 rounded-lg bg-canvas p-3 text-[13px] text-ink-2">
          <p className="font-medium text-ink">{order.address.name} · {toBnDigits(order.address.phone)}</p>
          <p className="mt-0.5 text-muted">
            {order.address.addressLine}, {order.address.thana}, {order.address.district}
          </p>
        </div>
      </Card>

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <Button as={Link} to={`/orders/${order.number}`} size="lg" className="flex-1">
          <Package size={17} /> অর্ডার ট্র্যাক করুন
        </Button>
        <Button as={Link} to="/products" variant="outline" size="lg" className="flex-1">
          <Home size={17} /> আরও কেনাকাটা
        </Button>
      </div>
    </div>
  );
}
