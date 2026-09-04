import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Image as ImageIcon, Info } from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../store/ToastContext";
import {
  Button, Card, Field, Input, Select, Skeleton, SmartImage, Textarea, Badge,
} from "../../components/ui";
import { discountPercent, money, toBnDigits } from "../../lib/format";
import { RULES } from "../../config";

const EMPTY = {
  title: "",
  category: "electronics",
  description: "",
  price: "",
  compareAtPrice: "",
  stock: "",
  status: "live",
  images: [],
};

export default function VendorProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const categories = useAsync(() => api.catalog.listCategories(), []);
  const existing = useAsync(
    () => (isEdit ? api.vendorPanel.listProducts({ page_size: 100 }) : Promise.resolve(null)),
    [id],
    { skip: !isEdit },
  );

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (!isEdit || !existing.data) return;
    const found = existing.data.results.find((p) => String(p.id) === String(id));
    if (found) {
      setForm({
        title: found.title,
        category: found.category,
        description: found.description,
        price: String(found.price),
        compareAtPrice: found.compareAtPrice ? String(found.compareAtPrice) : "",
        stock: String(found.stock),
        status: found.status,
        images: found.images ?? [],
      });
    }
  }, [existing.data, id, isEdit]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const next = {};
    if (form.title.trim().length < 5) next.title = "পণ্যের নাম অন্তত ৫ অক্ষরের হতে হবে";
    if (!form.price || Number(form.price) <= 0) next.price = "দাম দিন";
    if (form.compareAtPrice && Number(form.compareAtPrice) <= Number(form.price)) {
      next.compareAtPrice = "আগের দাম বর্তমান দামের চেয়ে বেশি হতে হবে";
    }
    if (form.stock === "" || Number(form.stock) < 0) next.stock = "স্টক সংখ্যা দিন";
    if (form.description.trim().length < 20) next.description = "অন্তত ২০ অক্ষরের বিবরণ লিখুন";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    if (!validate()) {
      toast.error("লাল দাগানো ঘরগুলো ঠিক করুন");
      return;
    }
    setSaving(true);
    try {
      await api.vendorPanel.saveProduct({
        ...(isEdit ? { id: Number(id) } : {}),
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        price: Number(form.price),
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null,
        stock: Number(form.stock),
        status: form.status,
        images: form.images,
      });
      toast.success(isEdit ? "পণ্য আপডেট হয়েছে" : "নতুন পণ্য যোগ হয়েছে");
      navigate("/vendor/products");
    } catch (err) {
      toast.error(err.message || "সেভ করা গেল না");
    } finally {
      setSaving(false);
    }
  }

  function addImage() {
    const url = imageUrl.trim();
    if (!url) return;
    set("images", [...form.images, url]);
    setImageUrl("");
  }

  if (isEdit && existing.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const off = discountPercent(Number(form.price || 0), Number(form.compareAtPrice || 0));
  const commission = Math.round((Number(form.price || 0) * RULES.defaultCommissionRate) / 100);

  return (
    <div className="space-y-5">
      <Link
        to="/vendor/products"
        className="inline-flex items-center gap-1.5 text-[13.5px] text-muted transition hover:text-brand-600"
      >
        <ArrowLeft size={15} /> পণ্যের তালিকা
      </Link>

      <h1 className="font-display text-2xl font-semibold text-ink">
        {isEdit ? "পণ্য সম্পাদনা" : "নতুন পণ্য"}
      </h1>

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <h2 className="font-display text-lg font-semibold">মূল তথ্য</h2>

            <Field label="পণ্যের নাম" required error={errors.title}>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                invalid={!!errors.title}
                placeholder="যেমন: সুতি এমব্রয়ডারি পাঞ্জাবি — অফ হোয়াইট"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ক্যাটাগরি" required>
                <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
                  {(categories.data ?? []).map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="অবস্থা">
                <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                  <option value="live">সচল — সাইটে দেখা যাবে</option>
                  <option value="draft">খসড়া — শুধু আমি দেখব</option>
                </Select>
              </Field>
            </div>

            <Field
              label="বিবরণ"
              required
              error={errors.description}
              hint="ক্রেতা কী পাবে, উপাদান কী, মাপ কেমন — বিস্তারিত লিখলে বিক্রি বাড়ে"
            >
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                invalid={!!errors.description}
                className="min-h-32"
                placeholder="পণ্যটির বিস্তারিত বিবরণ…"
              />
            </Field>
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-display text-lg font-semibold">দাম ও স্টক</h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="বিক্রয় মূল্য (৳)" required error={errors.price}>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  invalid={!!errors.price}
                  placeholder="১৬৯০"
                  className="tnum"
                />
              </Field>

              <Field label="আগের দাম (৳)" error={errors.compareAtPrice} hint="কাটা দাগ দিয়ে দেখাবে">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.compareAtPrice}
                  onChange={(e) => set("compareAtPrice", e.target.value)}
                  invalid={!!errors.compareAtPrice}
                  placeholder="২২০০"
                  className="tnum"
                />
              </Field>

              <Field label="স্টক" required error={errors.stock}>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) => set("stock", e.target.value)}
                  invalid={!!errors.stock}
                  placeholder="৪০"
                  className="tnum"
                />
              </Field>
            </div>

            {form.price && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-canvas px-3.5 py-3 text-[13px]">
                <Info size={15} className="shrink-0 text-brand-500" />
                <span className="text-muted">
                  প্ল্যাটফর্ম কমিশন {toBnDigits(RULES.defaultCommissionRate)}% —{" "}
                  <b className="tnum text-ink">{money(commission)}</b>, আপনি পাবেন{" "}
                  <b className="tnum text-brand-700">{money(Number(form.price) - commission)}</b>
                </span>
                {off > 0 && <Badge tone="sale">-{toBnDigits(off)}%</Badge>}
              </div>
            )}
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-display text-lg font-semibold">ছবি</h2>

            <div className="flex gap-2">
              <Input
                icon={ImageIcon}
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImage())}
                placeholder="ছবির URL দিন…"
              />
              <Button type="button" variant="outline" onClick={addImage} className="shrink-0">
                যোগ করুন
              </Button>
            </div>

            <p className="text-[12.5px] text-muted">
              Django যুক্ত করার পর এখানে ফাইল আপলোড বসবে (<code>FormData</code> দিয়ে
              <code> multipart/form-data</code> পাঠাবে — <code>api/client.js</code> সেটা সামলাতে
              পারে)। এখন URL দিয়ে পরীক্ষা করুন।
            </p>

            {form.images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.images.map((src, i) => (
                  <div key={i} className="relative">
                    <SmartImage src={src} alt="" className="h-20 w-20 rounded-lg border border-line" />
                    <button
                      type="button"
                      onClick={() => set("images", form.images.filter((_, n) => n !== i))}
                      className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[11px] text-white"
                      aria-label="ছবি সরান"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* প্রিভিউ */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <h2 className="font-display text-[15px] font-semibold">ক্রেতা যা দেখবে</h2>

            <div className="mt-3 overflow-hidden rounded-xl border border-line">
              <SmartImage src={form.images[0]} alt="" />
              <div className="space-y-1.5 p-3">
                <p className="line-clamp-2-safe min-h-[2.6em] text-[13.5px] leading-snug font-medium text-ink">
                  {form.title || "পণ্যের নাম এখানে দেখাবে"}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="tnum text-[17px] font-semibold text-ink">
                    {money(Number(form.price || 0))}
                  </span>
                  {off > 0 && (
                    <s className="tnum text-[13px] text-muted">
                      {money(Number(form.compareAtPrice))}
                    </s>
                  )}
                </div>
                {Number(form.stock) > 0 && Number(form.stock) <= 5 && (
                  <p className="tnum text-[12px] text-accent-600">
                    মাত্র {toBnDigits(form.stock)}টি বাকি
                  </p>
                )}
              </div>
            </div>

            <Button type="submit" size="lg" className="mt-4 w-full" loading={saving}>
              <Save size={17} /> {isEdit ? "আপডেট করুন" : "পণ্য যোগ করুন"}
            </Button>

            <Button
              as={Link}
              to="/vendor/products"
              type="button"
              variant="ghost"
              className="mt-2 w-full"
            >
              বাতিল
            </Button>
          </Card>
        </div>
      </form>
    </div>
  );
}
