import { useState } from "react";
import { ClipboardList, Search, ChevronDown, Store, Phone } from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import {
  Badge, Card, EmptyState, Input, Pagination, Skeleton,
} from "../../components/ui";
import { classNames as cx, formatDate, money, toBnDigits } from "../../lib/format";
import { ORDER_STATUS, PAYMENT_METHODS } from "../../lib/bd";

function OrderRow({ order }) {
  const [open, setOpen] = useState(false);
  const status = ORDER_STATUS[order.status] ?? ORDER_STATUS.pending;
  const payment = PAYMENT_METHODS.find((m) => m.id === order.paymentMethod);
  const commission = order.parcels.reduce((sum, p) => sum + p.commission, 0);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-canvas/60"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tnum text-[14px] font-semibold text-ink">{order.number}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone={order.paymentStatus === "paid" ? "ok" : "neutral"}>
              {payment?.name ?? order.paymentMethod}
            </Badge>
          </div>
          <p className="tnum mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted">
            <span>{order.customerName}</span>
            <span className="flex items-center gap-1">
              <Phone size={11} /> {toBnDigits(order.customerPhone)}
            </span>
            <span>{formatDate(order.createdAt)}</span>
            <span>{toBnDigits(order.parcels.length)} পার্সেল</span>
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="tnum font-display text-[16px] font-bold text-ink">
            {money(order.grandTotal)}
          </p>
          <p className="tnum text-[11.5px] text-brand-600">
            কমিশন {money(commission)}
          </p>
        </div>

        <ChevronDown size={17}
                     className={cx("shrink-0 text-muted transition", open && "rotate-180")} />
      </button>

      {open && (
        <ul className="divide-y divide-line border-t border-line">
          {order.parcels.map((parcel) => {
            const st = ORDER_STATUS[parcel.status] ?? ORDER_STATUS.pending;
            return (
              <li key={parcel.id} className="flex flex-wrap items-center gap-3 bg-canvas/40 px-4 py-3">
                <Store size={14} className="shrink-0 text-muted" />
                <span className="text-[13.5px] font-medium text-ink">{parcel.vendor}</span>
                <Badge tone={st.tone}>{st.label}</Badge>
                <span className="tnum text-[12px] text-muted">{parcel.subNumber}</span>
                <span className="tnum ml-auto text-[12.5px] text-muted">
                  পণ্য {money(parcel.subtotal)} · কমিশন {money(parcel.commission)}
                </span>
                <span className="tnum text-[13.5px] font-semibold text-brand-700">
                  {money(parcel.payable)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default function AdminOrders() {
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(term, 350);

  const { data, loading } = useAsync(
    () => api.admin.listOrders({ search, page, page_size: 20 }),
    [search, page],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">অর্ডার</h1>
          <p className="tnum mt-0.5 text-[13.5px] text-muted">
            {loading ? "লোড হচ্ছে…" : `${toBnDigits(data?.count ?? 0)}টি অর্ডার`}
          </p>
        </div>
        <Input
          icon={Search}
          value={term}
          onChange={(e) => { setTerm(e.target.value); setPage(1); }}
          placeholder="অর্ডার নম্বর বা মোবাইল…"
          className="w-full sm:w-64"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : data?.results.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="কোনো অর্ডার নেই" />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {data.results.map((order) => (
            <OrderRow key={order.number} order={order} />
          ))}
        </div>
      )}

      <Pagination page={page} count={data?.count ?? 0} pageSize={20} onChange={setPage} />
    </div>
  );
}
