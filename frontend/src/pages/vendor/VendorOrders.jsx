import { useState } from "react";
import { ClipboardList, Truck, MapPin, ChevronDown, Check } from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../store/ToastContext";
import {
  Badge, Button, Card, EmptyState, Pagination, Skeleton, SmartImage, Tabs,
} from "../../components/ui";
import { classNames as cx, formatDate, money, toBnDigits } from "../../lib/format";
import { ORDER_FLOW, ORDER_STATUS } from "../../lib/bd";
import { RULES } from "../../config";

const TABS = [
  { value: "", label: "সব" },
  { value: "pending", label: "নতুন" },
  { value: "confirmed", label: "নিশ্চিত" },
  { value: "packed", label: "প্যাক" },
  { value: "shipped", label: "পথে" },
  { value: "delivered", label: "সম্পন্ন" },
];

/** পরের ধাপ কোনটা — ভেন্ডর শুধু এক ধাপ করে এগোতে পারে */
function nextStatus(status) {
  const i = ORDER_FLOW.indexOf(status);
  return i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1] : null;
}

const ACTION_LABEL = {
  confirmed: "অর্ডার নিশ্চিত করুন",
  packed: "প্যাক হয়েছে",
  shipped: "কুরিয়ারে দিন",
  delivered: "ডেলিভারি সম্পন্ন",
};

function OrderRow({ vo, onChanged }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const status = ORDER_STATUS[vo.status];
  const next = nextStatus(vo.status);

  // কমিশন ও প্রাপ্য — ভেন্ডর সবসময় দেখতে পাবে
  const commission = vo.commission ?? Math.round((vo.itemsTotal * RULES.defaultCommissionRate) / 100);
  const payable = vo.payable ?? vo.itemsTotal - commission;

  async function advance() {
    setBusy(true);
    try {
      await api.vendorPanel.updateOrderStatus(vo.id, next);
      toast.success(`অবস্থা বদলে "${ORDER_STATUS[next].label}" করা হলো`);
      onChanged();
    } catch (err) {
      toast.error(err.message || "অবস্থা বদলানো গেল না");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-canvas/60"
      >
        <div className="flex -space-x-2">
          {vo.items.slice(0, 3).map((item, i) => (
            <SmartImage
              key={i}
              src={item.image}
              alt=""
              className="h-10 w-10 shrink-0 rounded-lg border-2 border-white"
            />
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <p className="tnum text-[13.5px] font-semibold text-ink">{vo.subNumber}</p>
          <p className="tnum text-[12px] text-muted">
            {toBnDigits(vo.items.length)}টি পণ্য · {formatDate(vo.createdAt)}
          </p>
        </div>

        <div className="hidden text-right sm:block">
          <p className="tnum text-[13.5px] font-semibold text-ink">{money(vo.itemsTotal)}</p>
          <p className="tnum text-[11.5px] text-brand-600">আপনি পাবেন {money(payable)}</p>
        </div>

        <Badge tone={status.tone}>{status.label}</Badge>
        <ChevronDown
          size={17}
          className={cx("shrink-0 text-muted transition", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t border-line">
          <ul className="divide-y divide-line">
            {vo.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <SmartImage src={item.image} alt="" className="h-12 w-12 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2-safe text-[13px] leading-snug text-ink">
                    {item.productTitle}
                  </p>
                  {Object.keys(item.options ?? {}).length > 0 && (
                    <p className="text-[12px] text-muted">
                      {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                    </p>
                  )}
                </div>
                <span className="tnum shrink-0 text-[13px] text-muted">
                  {toBnDigits(item.quantity)} × {money(item.unitPrice)}
                </span>
              </li>
            ))}
          </ul>

          {vo.address && (
            <div className="flex items-start gap-2 border-t border-line bg-canvas px-4 py-3 text-[12.5px]">
              <MapPin size={14} className="mt-0.5 shrink-0 text-muted" />
              <div>
                <p className="font-medium text-ink">
                  {vo.address.name} · <span className="tnum">{toBnDigits(vo.address.phone)}</span>
                </p>
                <p className="text-muted">
                  {vo.address.addressLine}, {vo.address.thana}, {vo.address.district}
                </p>
              </div>
            </div>
          )}

          {/* হিসাব */}
          <dl className="space-y-1.5 border-t border-line px-4 py-3 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted">পণ্যমূল্য</dt>
              <dd className="tnum">{money(vo.itemsTotal)}</dd>
            </div>
            {vo.discount > 0 && (
              <div className="flex justify-between text-brand-600">
                <dt>কুপন ছাড়</dt>
                <dd className="tnum">−{money(vo.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between text-muted">
              <dt>প্ল্যাটফর্ম কমিশন</dt>
              <dd className="tnum">−{money(commission)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
              <dt>আপনার প্রাপ্য</dt>
              <dd className="tnum text-brand-700">{money(payable)}</dd>
            </div>
          </dl>

          {vo.trackingCode && (
            <div className="flex items-center gap-2 border-t border-line bg-brand-50 px-4 py-2.5 text-[13px] text-brand-800">
              <Truck size={15} />
              {vo.courier}
              <span className="tnum ml-auto font-semibold">{vo.trackingCode}</span>
            </div>
          )}

          {next && vo.status !== "cancelled" && (
            <div className="border-t border-line px-4 py-3">
              <Button size="sm" loading={busy} onClick={advance}>
                <Check size={15} /> {ACTION_LABEL[next]}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function VendorOrders() {
  const [tab, setTab] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading, reload } = useAsync(
    () => api.vendorPanel.listOrders({ status: tab || undefined, page, page_size: 10 }),
    [tab, page],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">অর্ডার</h1>
        <p className="mt-0.5 text-[13.5px] text-muted">
          শুধু আপনার দোকানের পার্সেলগুলো — অন্য বিক্রেতার পণ্য এখানে আসবে না
        </p>
      </div>

      <Tabs
        tabs={TABS}
        active={tab}
        onChange={(v) => {
          setTab(v);
          setPage(1);
        }}
      />

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : data?.results.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="এই অবস্থায় কোনো অর্ডার নেই"
            description="সাইট থেকে একটা ডেমো অর্ডার করলে সেটা এখানে চলে আসবে।"
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {data.results.map((vo) => (
            <OrderRow key={vo.id} vo={vo} onChanged={reload} />
          ))}
        </div>
      )}

      <Pagination page={page} count={data?.count ?? 0} pageSize={10} onChange={setPage} />
    </div>
  );
}
