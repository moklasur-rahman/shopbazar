import { useEffect, useState } from "react";
import { Images, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../store/ToastContext";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton, SmartImage,
} from "../../components/ui";
import { toBnDigits } from "../../lib/format";

const EMPTY = {
  title: "", subtitle: "", cta: "দেখুন", href: "/products",
  imageUrl: "", tone: "brand", sortOrder: 0, isActive: true,
};

const TONES = [
  { value: "brand", label: "সবুজ" },
  { value: "dark", label: "গাঢ়" },
  { value: "accent", label: "সোনালি" },
];

export default function AdminBanners() {
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => api.admin.listBanners(), []);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (!editing) return;
    setForm(editing === "new" ? EMPTY : { ...editing });
    setErrors({});
  }, [editing]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function save(e) {
    e.preventDefault();
    const next = {};
    if (form.title.trim().length < 3) next.title = "শিরোনাম লিখুন";
    if (!form.imageUrl.trim()) next.imageUrl = "ছবির URL দিন";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await api.admin.saveBanner(form);
      toast.success(form.id ? "ব্যানার আপডেট হয়েছে" : "নতুন ব্যানার যোগ হয়েছে");
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
      await api.admin.deleteBanner(deleting.id);
      toast.success("ব্যানার মুছে ফেলা হয়েছে");
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
          <h1 className="font-display text-2xl font-semibold text-ink">ব্যানার</h1>
          <p className="mt-0.5 text-[13.5px] text-muted">
            হোম পেজের উপরের স্লাইডার — ক্রম অনুযায়ী ঘোরে
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus size={17} /> নতুন ব্যানার
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState icon={Images} title="কোনো ব্যানার নেই"
                      description="হোম পেজের হিরো স্লাইডারে দেখানোর জন্য ব্যানার যোগ করুন।" />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((b) => (
            <Card key={b.id} className="overflow-hidden">
              <div className="relative">
                <SmartImage src={b.preview} alt={b.title} ratio="wide" />
                <div className="absolute top-2 left-2 flex gap-1.5">
                  <Badge tone="glass">ক্রম {toBnDigits(b.sortOrder)}</Badge>
                  {!b.isActive && <Badge tone="danger">বন্ধ</Badge>}
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-display text-[15px] font-semibold text-ink">
                  {b.title}
                </h3>
                <p className="mt-0.5 line-clamp-2-safe text-[13px] text-muted">
                  {b.subtitle}
                </p>
                <p className="tnum mt-1.5 flex items-center gap-1.5 text-[12px] text-muted">
                  <ExternalLink size={11} />
                  <code>{b.href}</code> · বোতাম “{b.cta}”
                </p>

                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(b)}>
                    <Pencil size={14} /> সম্পাদনা
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(b)}
                          className="text-red-600 hover:bg-red-50">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={form.id ? "ব্যানার সম্পাদনা" : "নতুন ব্যানার"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>বাতিল</Button>
            <Button size="sm" loading={saving} onClick={save}>সেভ করুন</Button>
          </div>
        }
      >
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="শিরোনাম" required error={errors.title} className="sm:col-span-2">
            <Input value={form.title} onChange={(e) => set("title", e.target.value)}
                   invalid={!!errors.title} placeholder="ঈদ কালেকশন ২০২৬" />
          </Field>

          <Field label="উপ-শিরোনাম" className="sm:col-span-2">
            <Input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)}
                   placeholder="পাঞ্জাবি ও শাড়িতে ৪০% পর্যন্ত ছাড়" />
          </Field>

          <Field label="ছবির URL" required error={errors.imageUrl} className="sm:col-span-2"
                 hint="চওড়া ছবি দিন (অন্তত ১২০০×৫০০)">
            <Input value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)}
                   invalid={!!errors.imageUrl}
                   placeholder="https://…/banner.jpg" />
          </Field>

          {form.imageUrl && (
            <div className="sm:col-span-2">
              <SmartImage src={form.imageUrl} alt="প্রিভিউ" ratio="wide"
                          className="rounded-xl border border-line" />
            </div>
          )}

          <Field label="বোতামের লেখা">
            <Input value={form.cta} onChange={(e) => set("cta", e.target.value)} />
          </Field>

          <Field label="বোতামের লিংক" hint="সাইটের ভেতরের পাথ">
            <Input value={form.href} onChange={(e) => set("href", e.target.value)}
                   placeholder="/products?category=fashion" />
          </Field>

          <Field label="রঙের ছোঁয়া">
            <Select value={form.tone} onChange={(e) => set("tone", e.target.value)}>
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>

          <Field label="ক্রম">
            <Input type="number" value={form.sortOrder}
                   onChange={(e) => set("sortOrder", e.target.value)} className="tnum" />
          </Field>

          <label className="flex items-center gap-2.5 sm:col-span-2">
            <input type="checkbox" checked={form.isActive}
                   onChange={(e) => set("isActive", e.target.checked)}
                   className="h-4 w-4 accent-brand-500" />
            <span className="text-[13.5px] text-ink-2">হোম পেজে দেখানো হবে</span>
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="ব্যানার মুছবেন?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>না</Button>
            <Button variant="danger" size="sm" onClick={confirmDelete}>হ্যাঁ, মুছুন</Button>
          </div>
        }
      >
        <p className="text-[14px] text-ink-2">
          <b className="text-ink">{deleting?.title}</b> হোম পেজ থেকে সরে যাবে।
        </p>
      </Modal>
    </div>
  );
}
