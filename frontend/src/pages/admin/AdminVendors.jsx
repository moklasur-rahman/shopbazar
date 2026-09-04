import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Store, Search, BadgeCheck, Phone, IdCard, Wallet, ExternalLink,
  Check, Ban, RotateCcw, ImageOff, AlertTriangle,
} from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { useToast } from "../../store/ToastContext";
import {
  Badge, Button, Card, EmptyState, Input, Modal, Pagination, Skeleton,
  SmartImage, Tabs, Textarea,
} from "../../components/ui";
import { classNames as cx, formatDate, toBnDigits } from "../../lib/format";

const TABS = [
  { value: "pending", label: "অপেক্ষমাণ" },
  { value: "approved", label: "অনুমোদিত" },
  { value: "suspended", label: "স্থগিত" },
  { value: "", label: "সব" },
];

const STATUS = {
  pending: { label: "অপেক্ষমাণ", tone: "warn" },
  approved: { label: "অনুমোদিত", tone: "ok" },
  suspended: { label: "স্থগিত", tone: "danger" },
};

/* ------------------------------ কাগজপত্র ------------------------------ */

function DocumentSlot({ label, url }) {
  if (!url) {
    return (
      <div className="rounded-xl border border-dashed border-line-2 bg-canvas p-4 text-center">
        <ImageOff size={20} className="mx-auto text-line-2" />
        <p className="mt-1.5 text-[12px] text-muted">{label}</p>
        <p className="text-[11px] text-muted">দেওয়া হয়নি</p>
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer"
       className="group block overflow-hidden rounded-xl border border-line transition hover:border-brand-400">
      <img src={url} alt={label} className="h-36 w-full bg-canvas object-contain" />
      <div className="flex items-center justify-between border-t border-line bg-white px-3 py-2">
        <span className="text-[12px] font-medium text-ink">{label}</span>
        <ExternalLink size={13} className="text-muted transition group-hover:text-brand-600" />
      </div>
    </a>
  );
}

/* ------------------------------ বিস্তারিত ------------------------------ */

function VendorDetail({ vendorId, onClose, onChanged }) {
  const toast = useToast();
  const { data: vendor, loading } = useAsync(
    () => api.admin.getVendor(vendorId), [vendorId], { skip: !vendorId },
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(null);

  useEffect(() => setNote(""), [vendorId]);

  async function act(action) {
    setBusy(action);
    try {
      await api.admin.vendorAction(vendorId, action, note);
      const messages = {
        approve: "দোকানটি অনুমোদিত হয়েছে — এখন সাইটে দেখা যাবে",
        suspend: "দোকানটি স্থগিত করা হয়েছে",
        reactivate: "দোকানটি আবার চালু হয়েছে",
      };
      toast.success(messages[action]);
      onChanged();
      onClose();
    } catch (err) {
      toast.error(err.message || "কাজটি করা গেল না");
    } finally {
      setBusy(null);
    }
  }

  const status = vendor ? STATUS[vendor.status] : null;
  const canApprove = vendor?.status !== "approved";
  const docsMissing = vendor && !(vendor.kyc?.nidFront && vendor.kyc?.nidBack);

  return (
    <Modal
      open={Boolean(vendorId)}
      onClose={onClose}
      size="lg"
      title={vendor ? vendor.shopName : "দোকানের তথ্য"}
      footer={
        vendor && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>বন্ধ করুন</Button>

            {vendor.status === "suspended" ? (
              <Button size="sm" loading={busy === "reactivate"}
                      onClick={() => act("reactivate")}>
                <RotateCcw size={15} /> আবার চালু করুন
              </Button>
            ) : (
              <Button variant="danger" size="sm" loading={busy === "suspend"}
                      onClick={() => act("suspend")}>
                <Ban size={15} /> স্থগিত করুন
              </Button>
            )}

            {canApprove && (
              <Button size="sm" loading={busy === "approve"} disabled={docsMissing}
                      onClick={() => act("approve")}>
                <Check size={15} /> অনুমোদন দিন
              </Button>
            )}
          </div>
        )
      }
    >
      {loading || !vendor ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <div className="space-y-5">
          {/* দোকান ও মালিক */}
          <div className="flex flex-wrap items-start gap-4">
            <SmartImage src={vendor.logo} alt={vendor.shopName}
                        className="h-16 w-16 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold text-ink">
                  {vendor.shopName}
                </h3>
                <Badge tone={status.tone}>{status.label}</Badge>
                {vendor.isVerified && (
                  <Badge tone="info"><BadgeCheck size={11} /> যাচাই করা</Badge>
                )}
              </div>
              <p className="mt-1 text-[13px] text-ink-2">{vendor.ownerName}</p>
              <p className="tnum flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted">
                <span className="flex items-center gap-1">
                  <Phone size={12} /> {toBnDigits(vendor.ownerPhone)}
                </span>
                {vendor.district && <span>{vendor.district}</span>}
                <span>আবেদন {formatDate(vendor.createdAt)}</span>
              </p>
            </div>
            {vendor.status === "approved" && (
              <Button as={Link} to={`/shop/${vendor.slug}`} target="_blank"
                      variant="outline" size="sm">
                <ExternalLink size={14} /> দোকান
              </Button>
            )}
          </div>

          {docsMissing && (
            <div className="flex items-start gap-2.5 rounded-lg border border-accent-200 bg-accent-50 px-3.5 py-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-accent-500" />
              <p className="text-[13px] leading-relaxed text-accent-600">
                NID-র ছবি এখনো জমা পড়েনি, তাই অনুমোদন দেওয়া যাচ্ছে না।
                বিক্রেতাকে ফোন করে কাগজপত্র জমা দিতে বলুন।
              </p>
            </div>
          )}

          {/* কাগজপত্র */}
          <div>
            <p className="mb-2.5 flex items-center gap-2 text-[13.5px] font-semibold text-ink">
              <IdCard size={15} className="text-brand-500" /> জমা দেওয়া কাগজপত্র
            </p>
            {vendor.kyc ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <DocumentSlot label="NID — সামনে" url={vendor.kyc.nidFront} />
                  <DocumentSlot label="NID — পেছনে" url={vendor.kyc.nidBack} />
                  <DocumentSlot label="ট্রেড লাইসেন্স" url={vendor.kyc.tradeLicense} />
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1.5 rounded-lg bg-canvas p-3.5 text-[13px] sm:grid-cols-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">NID নম্বর</dt>
                    <dd className="tnum font-medium text-ink">
                      {vendor.kyc.nidNumber ? toBnDigits(vendor.kyc.nidNumber) : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-muted">
                      <Wallet size={13} /> টাকা যাবে
                    </dt>
                    <dd className="tnum font-medium text-ink">
                      {vendor.kyc.payoutTarget || "নির্ধারিত হয়নি"}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="rounded-lg bg-canvas p-4 text-center text-[13px] text-muted">
                কোনো কাগজপত্র জমা পড়েনি
              </p>
            )}
          </div>

          {/* দোকানের হিসাব */}
          {vendor.stats && (
            <div className="grid grid-cols-3 gap-2.5">
              {[
                ["অর্ডার", vendor.stats.orders],
                ["পণ্য", vendor.stats.products],
                ["সচল পণ্য", vendor.stats.live_products],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line bg-white px-3 py-2.5 text-center">
                  <p className="tnum font-display text-lg font-bold text-ink">
                    {toBnDigits(value ?? 0)}
                  </p>
                  <p className="text-[11.5px] text-muted">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* নোট */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-2">
              নোট (বিক্রেতা দেখতে পাবেন)
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="যেমন: NID-র ছবি ঝাপসা, আবার তুলে দিন"
              className="min-h-20"
            />
            {vendor.kyc?.reviewNote && (
              <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-[12.5px] text-muted">
                আগের নোট: {vendor.kyc.reviewNote}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* --------------------------------- পেজ -------------------------------- */

export default function AdminVendors() {
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const search = useDebounce(term, 350);

  const status = params.get("status") ?? "pending";

  const { data, loading, reload } = useAsync(
    () => api.admin.listVendors({ status: status || undefined, search, page, page_size: 20 }),
    [status, search, page],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">দোকান</h1>
          <p className="tnum mt-0.5 text-[13.5px] text-muted">
            {loading ? "লোড হচ্ছে…" : `${toBnDigits(data?.count ?? 0)}টি দোকান`}
          </p>
        </div>
        <Input
          icon={Search}
          value={term}
          onChange={(e) => { setTerm(e.target.value); setPage(1); }}
          placeholder="দোকান বা মোবাইল নম্বর…"
          className="w-full sm:w-64"
        />
      </div>

      <Tabs
        tabs={TABS}
        active={status}
        onChange={(v) => {
          const next = new URLSearchParams(params);
          if (v) next.set("status", v); else next.delete("status");
          setParams(next);
          setPage(1);
        }}
      />

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : data?.results.length === 0 ? (
        <Card>
          <EmptyState icon={Store} title="এই অবস্থায় কোনো দোকান নেই" />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {data.results.map((v) => {
            const st = STATUS[v.status];
            return (
              <Card key={v.id} className="overflow-hidden">
                <button
                  onClick={() => setOpenId(v.id)}
                  className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-canvas/60"
                >
                  <SmartImage src={v.logo} alt="" className="h-12 w-12 shrink-0 rounded-xl" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-display text-[15px] font-semibold text-ink">
                        {v.shopName}
                      </span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {v.status === "pending" && (
                        <Badge tone={v.documentsReady ? "ok" : "danger"}>
                          {v.documentsReady ? "কাগজপত্র জমা" : "কাগজপত্র বাকি"}
                        </Badge>
                      )}
                    </div>
                    <p className="tnum mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted">
                      <span>{v.ownerName}</span>
                      <span>{toBnDigits(v.ownerPhone)}</span>
                      {v.district && <span>{v.district}</span>}
                    </p>
                  </div>

                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="tnum text-[13px] font-medium text-ink">
                      {toBnDigits(v.productCount)}টি পণ্য
                    </p>
                    <p className="tnum text-[11.5px] text-muted">
                      কমিশন {toBnDigits(v.commissionRate)}%
                    </p>
                  </div>

                  <span className={cx(
                    "shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-medium",
                    v.status === "pending"
                      ? "bg-ink text-white"
                      : "border border-line text-ink-2",
                  )}>
                    {v.status === "pending" ? "যাচাই করুন" : "দেখুন"}
                  </span>
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <Pagination page={page} count={data?.count ?? 0} pageSize={20} onChange={setPage} />

      <VendorDetail vendorId={openId} onClose={() => setOpenId(null)} onChanged={reload} />
    </div>
  );
}
