import { useEffect, useState } from "react";
import { LayoutGrid, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../store/ToastContext";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton,
} from "../../components/ui";
import { toBnDigits } from "../../lib/format";

const EMPTY = { name: "", slug: "", icon: "", parent: "", sortOrder: 0, isActive: true };

export default function AdminCategories() {
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => api.admin.listCategories(), []);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (!editing) return;
    setForm(editing === "new" ? EMPTY : { ...editing, parent: editing.parent ?? "" });
    setErrors({});
  }, [editing]);

  const topLevel = (data ?? []).filter((c) => !c.parent);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function save(e) {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      setErrors({ name: "নাম লিখুন" });
      return;
    }
    setSaving(true);
    try {
      await api.admin.saveCategory({ ...form, parent: form.parent || null });
      toast.success(form.id ? "ক্যাটাগরি আপডেট হয়েছে" : "নতুন ক্যাটাগরি যোগ হয়েছে");
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
      await api.admin.deleteCategory(deleting.id);
      toast.success("ক্যাটাগরি মুছে ফেলা হয়েছে");
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(err.message || "মোছা গেল না");
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">ক্যাটাগরি</h1>
          <p className="mt-0.5 text-[13.5px] text-muted">
            সাইটের ক্যাটাগরি ও উপ-ক্যাটাগরি — ক্রম বদলালে হোম পেজেও বদলাবে
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus size={17} /> নতুন ক্যাটাগরি
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState icon={LayoutGrid} title="কোনো ক্যাটাগরি নেই" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {data.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <GripVertical size={15} className="shrink-0 text-line-2" />
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-canvas text-lg">
                  {c.icon || "•"}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-ink">{c.name}</span>
                    {c.parentName && (
                      <Badge tone="neutral">{c.parentName} এর ভেতরে</Badge>
                    )}
                    {!c.isActive && <Badge tone="danger">বন্ধ</Badge>}
                  </div>
                  <p className="tnum text-[12px] text-muted">
                    <code>{c.slug}</code> · {toBnDigits(c.productCount)}টি পণ্য
                    · ক্রম {toBnDigits(c.sortOrder)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(c)}
                          aria-label="সম্পাদনা">
                    <Pencil size={15} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(c)}
                          aria-label="মুছুন" className="text-red-600 hover:bg-red-50">
                    <Trash2 size={15} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ফর্ম */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={form.id ? "ক্যাটাগরি সম্পাদনা" : "নতুন ক্যাটাগরি"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>বাতিল</Button>
            <Button size="sm" loading={saving} onClick={save}>সেভ করুন</Button>
          </div>
        }
      >
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="নাম" required error={errors.name} className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)}
                   invalid={!!errors.name} placeholder="যেমন: ইলেকট্রনিক্স" />
          </Field>

          <Field
            label="URL slug"
            error={errors.slug}
            hint="ইংরেজিতে দিন — লিংকে এটাই দেখা যাবে (/products?category=electronics)"
            className="sm:col-span-2"
          >
            <Input value={form.slug} onChange={(e) => set("slug", e.target.value)}
                   invalid={!!errors.slug} placeholder="electronics" />
          </Field>

          <Field label="আইকন (ইমোজি)">
            <Input value={form.icon} onChange={(e) => set("icon", e.target.value)}
                   placeholder="📱" maxLength={4} />
          </Field>

          <Field label="ক্রম" hint="ছোট সংখ্যা আগে দেখাবে">
            <Input type="number" value={form.sortOrder}
                   onChange={(e) => set("sortOrder", e.target.value)} className="tnum" />
          </Field>

          <Field label="উপরের ধাপ" className="sm:col-span-2">
            <Select value={form.parent ?? ""} onChange={(e) => set("parent", e.target.value)}>
              <option value="">কোনোটির ভেতরে নয় (মূল ক্যাটাগরি)</option>
              {topLevel
                .filter((c) => c.id !== form.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
            </Select>
          </Field>

          <label className="flex items-center gap-2.5 sm:col-span-2">
            <input type="checkbox" checked={form.isActive}
                   onChange={(e) => set("isActive", e.target.checked)}
                   className="h-4 w-4 accent-brand-500" />
            <span className="text-[13.5px] text-ink-2">সাইটে দেখানো হবে</span>
          </label>
        </form>
      </Modal>

      {/* মোছার নিশ্চিতকরণ */}
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="ক্যাটাগরি মুছবেন?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>না</Button>
            <Button variant="danger" size="sm" onClick={confirmDelete}>হ্যাঁ, মুছুন</Button>
          </div>
        }
      >
        <p className="text-[14px] text-ink-2">
          <b className="text-ink">{deleting?.name}</b> মুছে ফেলা হবে।
          {deleting?.productCount > 0 && (
            <span className="mt-2 block rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
              এতে {toBnDigits(deleting.productCount)}টি পণ্য আছে — আগে সেগুলো অন্য
              ক্যাটাগরিতে সরাতে হবে, নাহলে মোছা যাবে না।
            </span>
          )}
        </p>
      </Modal>
    </div>
  );
}
