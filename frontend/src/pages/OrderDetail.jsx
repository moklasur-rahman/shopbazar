import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Store, Truck, MapPin, Receipt, Check, X, Copy, PackageX,
} from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { useToast } from "../store/ToastContext";
import { Badge, Button, Card, EmptyState, Skeleton, SmartImage } from "../components/ui";
import { classNames as cx, formatDate, money, toBnDigits } from "../lib/format";
import { ORDER_FLOW, ORDER_STATUS, PAYMENT_METHODS } from "../lib/bd";

/** এক পার্সেলের অগ্রগতি — pending → confirmed → packed → shipped → delivered */
function StatusTimeline({ status }) {
  if (status === "cancelled" || status === "returned") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
        <PackageX size={16} />
        {ORDER_STATUS[status].label} হয়েছে
      </div>
    );
  }

  const currentIndex = ORDER_FLOW.indexOf(status);

  return (
    <ol className="flex items-start">
      {ORDER_FLOW.map((step, i) => {
        const done = i <= currentIndex;
        const isLast = i === ORDER_FLOW.length - 1;
        return (
          <li key={step} className={cx("flex items-start", !isLast && "flex-1")}>
            <div className="flex w-14 flex-col items-center gap-1.5">
              <span
                className={cx(
                  "grid h-7 w-7 place-items-center rounded-full border-2 text-[11px] transition",
                  done
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-line-2 bg-white text-muted",
                )}
              >
                {done ? <Check size={13} /> : toBnDigits(i + 1)}
              </span>
              <span
                className={cx(
                  "text-center text-[10.5px] leading-tight",
                  done ? "font-medium text-ink" : "text-muted",
                )}
              >
                {ORDER_STATUS[step].label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cx(
                  "mt-3.5 h-0.5 flex-1 rounded",
                  i < currentIndex ? "bg-brand-500" : "bg-line",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderDetail() {
  const { number } = useParams();
  const toast = useToast();
  const { data: order, loading, reload } = useAsync(() => api.orders.get(number), [number]);

  async function cancel(vendorOrderId) {
    try {
      await api.orders.cancelVendorOrder(vendorOrderId, "ক্রেতা বাতিল করেছেন");
      toast.success("পার্সেলটি বাতিল করা হয়েছে");
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Card>
          <EmptyState
            icon={PackageX}
            title="অর্ডারটি পাওয়া যায়নি"
            action={<Button as={Link} to="/orders">সব অর্ডার</Button>}
          />
        </Card>
      </div>
    );
  }

  const paymentLabel =
    PAYMENT_METHODS.find((m) => m.id === order.paymentMethod)?.name ?? order.paymentMethod;

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
      <Link
        to="/orders"
        className="mb-3 inline-flex items-center gap-1.5 text-[13.5px] text-muted transition hover:text-brand-600"
      >
        <ArrowLeft size={15} /> সব অর্ডার
      </Link>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="tnum font-display text-xl font-semibold text-ink">{order.number}</h1>
            <p className="mt-0.5 text-[13px] text-muted">
              {formatDate(order.createdAt, { withTime: true })}
            </p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(order.number);
              toast.info("অর্ডার নম্বর কপি হয়েছে");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-ink-2 transition hover:border-brand-300 hover:text-brand-600"
          >
            <Copy size={13} /> কপি
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-canvas p-3.5">
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
              <MapPin size={13} /> ডেলিভারি ঠিকানা
            </p>
            <p className="mt-1.5 text-[13.5px] font-medium text-ink">
              {order.address.name} · <span className="tnum">{toBnDigits(order.address.phone)}</span>
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">
              {order.address.addressLine}, {order.address.thana}, {order.address.district},{" "}
              {order.address.division}
            </p>
          </div>

          <div className="rounded-lg bg-canvas p-3.5">
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
              <Receipt size={13} /> পেমেন্ট
            </p>
            <p className="mt-1.5 text-[13.5px] font-medium text-ink">{paymentLabel}</p>
            <Badge tone={order.paymentStatus === "paid" ? "ok" : "warn"} className="mt-1.5">
              {order.paymentStatus === "paid" ? "পরিশোধিত" : "ডেলিভারিতে পরিশোধ"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* পার্সেলগুলো */}
      <h2 className="mt-6 mb-3 font-display text-lg font-semibold text-ink">
        পার্সেল ({toBnDigits(order.vendorOrders.length)}টি)
      </h2>

      <div className="space-y-3">
        {order.vendorOrders.map((vo, i) => {
          const status = ORDER_STATUS[vo.status];
          const canCancel = ["pending", "confirmed"].includes(vo.status);

          return (
            <Card key={vo.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas px-4 py-3">
                <Store size={15} className="shrink-0 text-muted" />
                <Link
                  to={`/shop/${vo.vendor.slug}`}
                  className="truncate text-[14px] font-semibold text-ink hover:text-brand-600"
                >
                  {vo.vendor.shopName}
                </Link>
                <Badge tone={status.tone}>{status.label}</Badge>
                <span className="tnum ml-auto text-[12px] text-muted">
                  পার্সেল {toBnDigits(i + 1)} · {vo.subNumber}
                </span>
              </div>

              <div className="border-b border-line px-4 py-4">
                <StatusTimeline status={vo.status} />
              </div>

              {vo.trackingCode && (
                <div className="flex items-center gap-2 border-b border-line bg-brand-50 px-4 py-2.5 text-[13px] text-brand-800">
                  <Truck size={15} />
                  <span>{vo.courier}</span>
                  <span className="tnum ml-auto font-semibold">{vo.trackingCode}</span>
                </div>
              )}

              <ul className="divide-y divide-line">
                {vo.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <Link to={`/product/${item.productSlug}`} className="shrink-0">
                      <SmartImage
                        src={item.image}
                        alt={item.productTitle}
                        className="h-14 w-14 rounded-lg"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/product/${item.productSlug}`}
                        className="line-clamp-2-safe text-[13.5px] leading-snug text-ink hover:text-brand-600"
                      >
                        {item.productTitle}
                      </Link>
                      {Object.keys(item.options ?? {}).length > 0 && (
                        <p className="text-[12px] text-muted">
                          {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                        </p>
                      )}
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

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
                <div className="text-[12.5px] text-muted">
                  <span className="tnum">পণ্য {money(vo.itemsTotal)}</span>
                  {vo.discount > 0 && (
                    <span className="tnum text-brand-600"> · ছাড় −{money(vo.discount)}</span>
                  )}
                  <span className="tnum"> · ডেলিভারি {money(vo.shipping)}</span>
                </div>
                <div className="flex items-center gap-3">
                  {canCancel && (
                    <button
                      onClick={() => cancel(vo.id)}
                      className="inline-flex items-center gap-1 text-[12.5px] font-medium text-red-600 hover:underline"
                    >
                      <X size={13} /> বাতিল করুন
                    </button>
                  )}
                  <span className="tnum text-[15px] font-semibold text-ink">
                    {money(vo.itemsTotal - vo.discount + vo.shipping)}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* সর্বমোট */}
      <Card className="mt-4 p-5">
        <dl className="space-y-2 text-[14px]">
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
          <div className="flex items-baseline justify-between border-t border-line pt-2.5">
            <dt className="font-display font-semibold">সর্বমোট</dt>
            <dd className="tnum font-display text-xl font-bold text-brand-700">
              {money(order.grandTotal)}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
