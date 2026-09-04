import { useEffect, useState } from "react";
import { Tag, Plus, Pencil, Trash2, Store, Globe } from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../store/ToastContext";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton, Tabs,
} from "../../components/ui";
import { formatDate, money, toBnDigits } from "../../lib/format";

const EMPTY = {
  code: "", label: "", type: "flat", value: "", minOrder: "", maxDiscount: "",
  vendor: "", expiresAt: "", usageLimit: "", isActive: true,
};

const TABS = [
  { value: "", label: "সব" },
  { value: "platform", label: "প্ল্যাটফর্মের" },
  { value: "vendor", label: "দোকানের" },
];

export default function AdminCoupons() {
  const toast = useToast();
  const [scope, setScope] = useState("");
  const { data, loading, reload } = useAsync(
    () => api.admin.listCoupons({ scope: scope || undefined }), [scope],
  );
  const { data: vendors } = useAsync(() => api.admin.couponVendorOptions(), []);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (!editing) return;
    if (editing === "new") {
      setForm(EMPTY);
    } else {
      setForm({
        ...editing,
        vendor: editing.vendor ?? "",
        maxDiscount: editing.maxDiscount ?? "",
        usageLimit: editing.usageLimit ?? "",
        expiresAt: editing.expiresAt ? editing.expiresAt.slice(0, 10) : "",
      });
    }
    setErrors({});
  }, [editing]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function save(e) {
    e.preventDefault();
    const next = {};
    if (!form.code.trim()) next.code = "কোড লিখুন";
    if (!form.value || Number(form.value) <= 0) next.value = "মান দিন";
    if (form.type === "percent" && Number(form.value) > 100) {
      next.value = "শতাংশ ১০০ এর বেশি হতে পারে না";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await api.admin.saveCoupon({
        ...form,
        value: Number(form.value),
        minOrder: Number(form.minOrder) || 0,
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        vendor: form.vendor ? Number(form.vendor) : null,
        expiresAt: form.expiresAt || null,
      });
      toast.success(form.id ? "কুপন আপডেট হয়েছে" : "নতুন কুপন তৈরি হয়েছে");
      setEditing(null);
      reload();
    } catch (err) {
      setErrors(err.fields ?? {});
      if (!err.fields) toast.error(err.message || "সেভ করা গেল না");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    try {
      await api.admin.deleteCoupon(deleting.id);
      toast.success("কুপন মুছে ফেলা হয়েছে");
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(err.message || "মোছা গেল না");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">কুপন</h1>
          <p className="mt-0.5 text-[13.5px] text-muted">
            দোকানের কুপনের খরচ ওই দোকানের, প্ল্যাটফর্মেরটা আপনার
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus size={17} /> নতুন কুপন
        </Button>
      </div>

      <Tabs tabs={TABS} active={scope} onChange={setScope} />

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState icon={Tag} title="কোনো কুপন নেই" />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {data.map((c) => {
            const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
            const exhausted = c.usageLimit && c.usedCount >= c.usageLimit;
            return (
              <Card key={c.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-500">
                  <Tag size={19} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-ink px-2 py-0.5 text-[13px] font-semibold text-white">
                      {c.code}
                    </code>
                    <Badge tone={c.scope === "vendor" ? "warn" : "info"}>
                      {c.scope === "vendor" ? (
                        <><Store size={11} /> {c.vendorName}</>
                      ) : (
                        <><Globe size={11} /> সব দোকানে</>
                      )}
                    </Badge>
                    {!c.isActive && <Badge tone="danger">বন্ধ</Badge>}
                    {expired && <Badge tone="danger">মেয়াদ শেষ</Badge>}
                    {exhausted && <Badge tone="danger">সীমা শেষ</Badge>}
                  </div>
                  <p className="tnum mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted">
                    <span className="font-medium text-ink">
                      {c.type === "percent"
                        ? `${toBnDigits(c.value)}% ছাড়`
                        : `${money(c.value)} ছাড়`}
                      {c.maxDiscount ? ` (সর্বোচ্চ ${money(c.maxDiscount)})` : ""}
                    </span>
                    {c.minOrder > 0 && <span>ন্যূনতম {money(c.minOrder)}</span>}
                    <span>
                      ব্যবহার {toBnDigits(c.usedCount)}
                      {c.usageLimit ? ` / ${toBnDigits(c.usageLimit)}` : ""}
                    </span>
                    {c.expiresAt && <span>মেয়াদ {formatDate(c.expiresAt)}</span>}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                    <Pencil size={15} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(c)}
                          className="text-red-600 hover:bg-red-50">
                    <Trash2 size={15} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={form.id ? "কুপন সম্পাদনা" : "নতুন কুপন"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>বাতিল</Button>
            <Button size="sm" loading={saving} onClick={save}>সেভ করুন</Button>
          </div>
        }
      >
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="কোড" required error={errors.code}
                 hint="ক্রেতা এটাই কার্টে লিখবেন">
            <Input value={form.code}
                   onChange={(e) => set("code", e.target.value.toUpperCase())}
                   invalid={!!errors.code} placeholder="EID15" />
          </Field>

          <Field label="বর্ণনা" hint="কার্টে এটা দেখানো হয়">
            <Input value={form.label} onChange={(e) => set("label", e.target.value)}
                   placeholder="ঈদ অফার — ১৫%" />
          </Field>

          <Field label="ধরন" required>
            <Select value={form.type} onChange={(e) => set("type", e.target.value)}>
              <option value="flat">নির্দিষ্ট টাকা</option>
              <option value="percent">শতাংশ</option>
            </Select>
          </Field>

          <Field
            label={form.type === "percent" ? "কত শতাংশ" : "কত টাকা"}
            required
            error={errors.value}
          >
            <Input type="number" value={form.value}
                   onChange={(e) => set("value", e.target.value)}
                   invalid={!!errors.value} className="tnum" />
          </Field>

          <Field label="ন্যূনতম অর্ডার (৳)">
            <Input type="number" value={form.minOrder}
                   onChange={(e) => set("minOrder", e.target.value)} className="tnum" />
          </Field>

          <Field label="সর্বোচ্চ ছাড় (৳)" hint="শতাংশের ক্ষেত্রে দরকারি">
            <Input type="number" value={form.maxDiscount}
                   onChange={(e) => set("maxDiscount", e.target.value)} className="tnum" />
          </Field>

          <Field
            label="কোন দোকানে"
            hint="খালি রাখলে সব দোকানে চলবে, খরচ প্ল্যাটফর্মের"
            className="sm:col-span-2"
          >
            <Select value={form.vendor ?? ""} onChange={(e) => set("vendor", e.target.value)}>
              <option value="">সব দোকানে (প্ল্যাটফর্মের কুপন)</option>
              {(vendors ?? []).map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="মেয়াদ শেষ">
            <Input type="date" value={form.expiresAt}
                   onChange={(e) => set("expiresAt", e.target.value)} />
          </Field>

          <Field label="সর্বোচ্চ কতবার" hint="খালি = সীমা নেই">
            <Input type="number" value={form.usageLimit}
                   onChange={(e) => set("usageLimit", e.target.value)} className="tnum" />
          </Field>

          <label className="flex items-center gap-2.5 sm:col-span-2">
            <input type="checkbox" checked={form.isActive}
                   onChange={(e) => set("isActive", e.target.checked)}
                   className="h-4 w-4 accent-brand-500" />
            <span className="text-[13.5px] text-ink-2">কুপনটি চালু আছে</span>
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="কুপন মুছবেন?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>না</Button>
            <Button variant="danger" size="sm" onClick={confirmDelete}>হ্যাঁ, মুছুন</Button>
          </div>
        }
      >
        <p className="text-[14px] text-ink-2">
          <b className="text-ink">{deleting?.code}</b> মুছে ফেললে কেউ আর এটা ব্যবহার
          করতে পারবেন না। শুধু সাময়িকভাবে বন্ধ করতে চাইলে সম্পাদনা করে
          “চালু আছে” টিক তুলে দিন।
        </p>
      </Modal>
    </div>
  );
}
