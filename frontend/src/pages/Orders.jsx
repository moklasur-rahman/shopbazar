import { useState } from "react";
import { Link } from "react-router-dom";
import { Package, ChevronRight, Store, ShoppingBag } from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { Badge, Button, Card, EmptyState, Pagination, Skeleton, SmartImage, Tabs } from "../components/ui";
import { formatDate, money, toBnDigits } from "../lib/format";
import { ORDER_STATUS } from "../lib/bd";

const TABS = [
  { value: "", label: "সব অর্ডার" },
  { value: "pending", label: "অপেক্ষমাণ" },
  { value: "shipped", label: "পথে আছে" },
  { value: "delivered", label: "ডেলিভারি হয়েছে" },
];

/** অর্ডারের সব পার্সেলের অবস্থা মিলিয়ে একটা সামগ্রিক অবস্থা বের করে */
function overallStatus(order) {
  const statuses = order.vendorOrders.map((v) => v.status);
  if (statuses.every((s) => s === "delivered")) return "delivered";
  if (statuses.every((s) => s === "cancelled")) return "cancelled";
  if (statuses.some((s) => s === "shipped")) return "shipped";
  if (statuses.some((s) => s === "packed")) return "packed";
  if (statuses.some((s) => s === "confirmed")) return "confirmed";
  return "pending";
}

export default function Orders() {
  const [tab, setTab] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading } = useAsync(
    () => api.orders.list({ status: tab || undefined, page, page_size: 10 }),
    [tab, page],
  );

  const orders = data?.results ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">আমার অর্ডার</h1>
      <p className="mt-0.5 text-[13.5px] text-muted">
        প্রতিটি অর্ডারের ভেতরে দোকান অনুযায়ী আলাদা পার্সেল থাকে
      </p>

      <Tabs
        tabs={TABS}
        active={tab}
        onChange={(v) => {
          setTab(v);
          setPage(1);
        }}
        className="mt-4 mb-5"
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShoppingBag}
            title="কোনো অর্ডার নেই"
            description="কেনাকাটা শুরু করলে আপনার অর্ডারগুলো এখানে দেখা যাবে।"
            action={<Button as={Link} to="/products">কেনাকাটা শুরু করুন</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const status = ORDER_STATUS[overallStatus(order)];
            const totalItems = order.vendorOrders.reduce(
              (s, v) => s + v.items.reduce((n, i) => n + i.quantity, 0),
              0,
            );
            const previews = order.vendorOrders.flatMap((v) => v.items).slice(0, 4);

            return (
              <Card key={order.number} hover className="overflow-hidden">
                <Link to={`/orders/${order.number}`} className="block">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Package size={16} className="text-muted" />
                      <span className="tnum text-[14px] font-semibold text-ink">
                        {order.number}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <span className="text-[12.5px] text-muted">
                      {formatDate(order.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 p-4">
                    <div className="flex -space-x-2">
                      {previews.map((item, i) => (
                        <SmartImage
                          key={i}
                          src={item.image}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-lg border-2 border-white"
                        />
                      ))}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="tnum text-[13.5px] font-medium text-ink">
                        {toBnDigits(totalItems)}টি পণ্য ·{" "}
                        {toBnDigits(order.vendorOrders.length)}টি দোকান
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-muted">
                        <Store size={12} className="shrink-0" />
                        {order.vendorOrders.map((v) => v.vendor.shopName).join(", ")}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="tnum font-display text-lg font-bold text-brand-700">
                        {money(order.grandTotal)}
                      </p>
                      <span className="flex items-center justify-end gap-0.5 text-[12.5px] text-brand-600">
                        বিস্তারিত <ChevronRight size={13} />
                      </span>
                    </div>
                  </div>
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        count={data?.count ?? 0}
        pageSize={10}
        onChange={setPage}
        className="mt-6"
      />
    </div>
  );
}
