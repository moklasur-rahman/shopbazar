import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Clock, Check, IdCard, Wallet, Store, ShieldCheck, Phone, LogOut,
  ArrowRight, AlertTriangle, Send, Camera,
} from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../store/AuthContext";
import { useToast } from "../../store/ToastContext";
import {
  Badge, Button, Card, Field, ImageUpload, Input, Select, Skeleton,
} from "../../components/ui";
import { classNames as cx, formatDate, isValidBdPhone, toBnDigits } from "../../lib/format";
import { DIVISIONS } from "../../lib/bd";
import { SITE } from "../../config";

/**
 * নতুন বিক্রেতা রেজিস্ট্রেশনের পর যে পাতাটা দেখেন।
 *
 * আগে তাঁকে সরাসরি ভেন্ডর ড্যাশবোর্ডে পাঠানো হতো, কিন্তু দোকান তখনো
 * `pending` — তাই প্যানেলের প্রতিটা API ৪০৩ দিত আর তিনি একটা ভাঙা
 * পাতা দেখতেন, কোনো ব্যাখ্যা ছাড়াই। এখন এখানে পরিষ্কার লেখা থাকে
 * কী বাকি, কতক্ষণ লাগবে, আর কাগজপত্র জমা দেওয়ার ফর্মও এখানেই।
 */

const STEPS = [
  { key: "account", icon: Store, title: "অ্যাকাউন্ট তৈরি", text: "দোকানের নাম ও মোবাইল নম্বর জমা হয়েছে" },
  { key: "documents", icon: IdCard, title: "পরিচয় যাচাই", text: "NID নম্বর ও দুই পাশের ছবি" },
  { key: "payout", icon: Wallet, title: "টাকা নেওয়ার তথ্য", text: "বিকাশ নম্বর বা ব্যাংক অ্যাকাউন্ট" },
  { key: "approved", icon: ShieldCheck, title: "অনুমোদন", text: "অ্যাডমিন যাচাই করে চালু করে দেবেন" },
];

const ALL_DISTRICTS = Object.values(DIVISIONS).flat().sort();

function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-line bg-white">
      <div className="container-page flex h-16 items-center gap-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 font-display text-lg font-bold text-white">
            শ
          </span>
          <span className="hidden font-display text-[15px] font-bold text-ink sm:block">
            {SITE.name}
          </span>
        </Link>

        <span className="ml-auto hidden text-[13px] text-muted sm:block">
          {user?.name}
        </span>

        <Button as={Link} to="/" variant="outline" size="sm">
          সাইটে যান
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await logout();
            navigate("/");
          }}
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">লগআউট</span>
        </Button>
      </div>
    </header>
  );
}

export default function VendorPending() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => api.vendorPanel.getApplication(), []);

  const [form, setForm] = useState({
    nidNumber: "", bkashNumber: "", bankName: "",
    bankAccountName: "", bankAccountNumber: "", district: "",
    // File (নতুন বাছাই) | string URL (আগে আপলোড করা) | null
    nidFront: null, nidBack: null, tradeLicense: null,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // সার্ভার থেকে আগের জমা দেওয়া তথ্য এলে ফর্মে বসাও।
  // ব্যবহারকারী ইতিমধ্যে কিছু বেছে থাকলে সেটা নষ্ট করা হয় না।
  useEffect(() => {
    if (!data) return;
    setForm((current) => ({
      nidNumber: current.nidNumber || data.kyc?.nidNumber || "",
      bkashNumber: current.bkashNumber || data.kyc?.bkashNumber || "",
      bankName: current.bankName || data.kyc?.bankName || "",
      bankAccountName: current.bankAccountName || data.kyc?.bankAccountName || "",
      bankAccountNumber: current.bankAccountNumber || data.kyc?.bankAccountNumber || "",
      district: current.district || data.vendor?.district || "",
      nidFront: current.nidFront ?? data.kyc?.nidFront ?? null,
      nidBack: current.nidBack ?? data.kyc?.nidBack ?? null,
      tradeLicense: current.tradeLicense ?? data.kyc?.tradeLicense ?? null,
    }));
  }, [data]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const next = {};
    if (!/^\d{10,17}$/.test(form.nidNumber.trim())) {
      next.nidNumber = "NID নম্বর ১০-১৭ ডিজিটের হয়";
    }
    if (!form.bkashNumber && !form.bankAccountNumber) {
      next.bkashNumber = "বিকাশ নম্বর বা ব্যাংক অ্যাকাউন্ট — অন্তত একটা দিন";
    }
    if (form.bkashNumber && !isValidBdPhone(form.bkashNumber)) {
      next.bkashNumber = "সঠিক বিকাশ নম্বর দিন";
    }
    if (!form.district) next.district = "জেলা বেছে নিন";
    // ছবি ছাড়া অ্যাডমিন যাচাই করতে পারেন না
    if (!form.nidFront) next.nidFront = "NID-র সামনের ছবি দিন";
    if (!form.nidBack) next.nidBack = "NID-র পেছনের ছবি দিন";
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
      await api.vendorPanel.saveApplication(form);
      toast.success("তথ্য জমা হয়েছে — অ্যাডমিন যাচাই করে জানাবেন");
      reload();
    } catch (err) {
      setErrors(err.fields ?? {});
      if (!err.fields) toast.error(err.message || "জমা দেওয়া গেল না");
    } finally {
      setSaving(false);
    }
  }

  const status = data?.vendor?.status ?? user?.vendorStatus ?? "pending";
  const checklist = data?.checklist ?? {};
  const isSuspended = status === "suspended";

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar />

      <div className="container-page max-w-4xl py-8">
        {/* অবস্থা */}
        <Card
          className={cx(
            "overflow-hidden",
            isSuspended ? "border-red-200" : "border-accent-200",
          )}
        >
          <div className={cx("px-6 py-6", isSuspended ? "bg-red-50" : "bg-accent-50")}>
            <div className="flex flex-wrap items-start gap-4">
              <span
                className={cx(
                  "grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white",
                  isSuspended ? "bg-red-600" : "bg-accent-400",
                )}
              >
                {isSuspended ? <AlertTriangle size={24} /> : <Clock size={24} />}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">
                    {isSuspended ? "দোকানটি স্থগিত আছে" : "আপনার দোকান অনুমোদনের অপেক্ষায়"}
                  </h1>
                  <Badge tone={isSuspended ? "danger" : "warn"}>
                    {isSuspended ? "স্থগিত" : "অপেক্ষমাণ"}
                  </Badge>
                </div>

                <p className="mt-1.5 max-w-xl text-[14.5px] leading-relaxed text-ink-2">
                  {isSuspended ? (
                    <>
                      আপনার দোকানটি সাময়িকভাবে বন্ধ রাখা হয়েছে। কারণ জানতে
                      আমাদের সাপোর্টে কল করুন।
                    </>
                  ) : (
                    <>
                      <b>{data?.vendor?.shopName || user?.vendorName || "আপনার দোকান"}</b> —
                      আবেদনটি জমা হয়েছে। নিচের তথ্যগুলো দিলে আমরা যাচাই শুরু করব,
                      সাধারণত <b>২৪-৪৮ ঘণ্টার</b> মধ্যে অনুমোদন হয়ে যায়।
                    </>
                  )}
                </p>

                {data?.vendor?.createdAt && (
                  <p className="mt-1 text-[12.5px] text-muted">
                    আবেদনের তারিখ: {formatDate(data.vendor.createdAt)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* চেকলিস্ট */}
          <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => {
              const done = checklist[step.key];
              return (
                <div key={step.key} className="flex gap-3 bg-white px-4 py-4">
                  <span
                    className={cx(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                      done ? "bg-brand-500 text-white" : "bg-canvas text-muted",
                    )}
                  >
                    {done ? <Check size={17} /> : <step.icon size={17} />}
                  </span>
                  <div className="min-w-0">
                    <p className="tnum text-[11px] font-medium text-muted">
                      ধাপ {toBnDigits(i + 1)}
                    </p>
                    <p className={cx("text-[13.5px] font-semibold", done ? "text-ink" : "text-ink-2")}>
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{step.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* কাগজপত্রের ফর্ম */}
        {!isSuspended && (
          <Card className="mt-5 p-6">
            <h2 className="font-display text-lg font-semibold text-ink">
              যাচাইয়ের তথ্য দিন
            </h2>
            <p className="mt-0.5 text-[13.5px] text-muted">
              এই তথ্যগুলো ছাড়া অনুমোদন দেওয়া যায় না। একবার জমা দেওয়ার পরেও
              দরকার হলে বদলাতে পারবেন।
            </p>

            {loading ? (
              <div className="mt-5 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field
                  label="NID নম্বর"
                  required
                  error={errors.nidNumber}
                  hint="জাতীয় পরিচয়পত্রে যা লেখা আছে"
                >
                  <Input
                    icon={IdCard}
                    value={form.nidNumber}
                    onChange={(e) => set("nidNumber", e.target.value)}
                    invalid={!!errors.nidNumber}
                    inputMode="numeric"
                    placeholder="১৯৯০১২৩৪৫৬৭৮৯"
                    className="tnum"
                  />
                </Field>

                <Field label="দোকান কোন জেলায়" required error={errors.district}>
                  <Select
                    value={form.district}
                    onChange={(e) => set("district", e.target.value)}
                    invalid={!!errors.district}
                  >
                    <option value="">বেছে নিন…</option>
                    {ALL_DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Select>
                </Field>

                {/* NID-র ছবি */}
                <div className="sm:col-span-2">
                  <div className="mb-3 flex items-center gap-2 border-t border-line pt-4">
                    <Camera size={16} className="text-brand-500" />
                    <span className="text-[13.5px] font-semibold text-ink">
                      NID-র ছবি
                    </span>
                    <span className="text-[12px] text-muted">
                      মোবাইলে তোলা ছবিই যথেষ্ট
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <ImageUpload
                      label="সামনের দিক"
                      required
                      value={form.nidFront}
                      onChange={(file) => set("nidFront", file)}
                      error={errors.nidFront}
                      hint="ছবি ও নাম যেন স্পষ্ট পড়া যায়"
                    />
                    <ImageUpload
                      label="পেছনের দিক"
                      required
                      value={form.nidBack}
                      onChange={(file) => set("nidBack", file)}
                      error={errors.nidBack}
                      hint="ঠিকানার অংশটুকু যেন দেখা যায়"
                    />
                  </div>

                  <div className="mt-4">
                    <ImageUpload
                      label="ট্রেড লাইসেন্স (ঐচ্ছিক)"
                      value={form.tradeLicense}
                      onChange={(file) => set("tradeLicense", file)}
                      error={errors.tradeLicense}
                      hint="দিলে যাচাই দ্রুত হয় আর দোকানে “যাচাই করা” ব্যাজ বসে"
                      className="sm:max-w-sm"
                    />
                  </div>

                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-canvas px-3.5 py-2.5 text-[12.5px] leading-relaxed text-muted">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-500" />
                    আপনার NID-র ছবি শুধু যাচাইয়ের কাজে ব্যবহার হয়। এটি কোনো
                    ক্রেতা বা অন্য বিক্রেতা দেখতে পান না।
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <div className="mb-3 flex items-center gap-2 border-t border-line pt-4">
                    <Wallet size={16} className="text-brand-500" />
                    <span className="text-[13.5px] font-semibold text-ink">
                      বিক্রির টাকা কোথায় পাঠাব
                    </span>
                  </div>
                </div>

                <Field
                  label="বিকাশ নম্বর"
                  error={errors.bkashNumber}
                  hint="আপনার নিজের নামে নিবন্ধিত হতে হবে"
                >
                  <Input
                    icon={Phone}
                    value={form.bkashNumber}
                    onChange={(e) => set("bkashNumber", e.target.value)}
                    invalid={!!errors.bkashNumber}
                    inputMode="numeric"
                    placeholder="01712345678"
                    className="tnum"
                  />
                </Field>

                <Field label="ব্যাংকের নাম (ঐচ্ছিক)">
                  <Input
                    value={form.bankName}
                    onChange={(e) => set("bankName", e.target.value)}
                    placeholder="যেমন: ডাচ্-বাংলা ব্যাংক"
                  />
                </Field>

                <Field label="অ্যাকাউন্টের নাম (ঐচ্ছিক)">
                  <Input
                    value={form.bankAccountName}
                    onChange={(e) => set("bankAccountName", e.target.value)}
                    placeholder="ব্যাংকে যে নামে অ্যাকাউন্ট"
                  />
                </Field>

                <Field label="অ্যাকাউন্ট নম্বর (ঐচ্ছিক)" error={errors.bankAccountNumber}>
                  <Input
                    value={form.bankAccountNumber}
                    onChange={(e) => set("bankAccountNumber", e.target.value)}
                    invalid={!!errors.bankAccountNumber}
                    inputMode="numeric"
                    className="tnum"
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Button type="submit" size="lg" loading={saving}>
                    <Send size={17} /> তথ্য জমা দিন
                  </Button>
                  {data?.kyc?.reviewNote && (
                    <p className="mt-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
                      অ্যাডমিনের নোট: {data.kyc.reviewNote}
                    </p>
                  )}
                </div>
              </form>
            )}
          </Card>
        )}

        {/* এর মধ্যে কী করবেন */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Card className="p-5">
            <h3 className="font-display text-[15px] font-semibold text-ink">
              অপেক্ষার সময় যা করতে পারেন
            </h3>
            <ul className="mt-3 space-y-2 text-[13.5px] text-ink-2">
              {[
                "পণ্যের ভালো ছবি তুলে রাখুন — সাদা ব্যাকগ্রাউন্ডে, প্রতি পণ্যে ৩টি",
                "দাম আর স্টকের তালিকা তৈরি করে রাখুন",
                "প্রতিযোগীদের দোকান ঘুরে দেখুন কীভাবে বিবরণ লেখা হয়",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                  {line}
                </li>
              ))}
            </ul>
            <Button as={Link} to="/shops" variant="outline" size="sm" className="mt-4">
              অন্য দোকান দেখুন <ArrowRight size={15} />
            </Button>
          </Card>

          <Card className="p-5">
            <h3 className="font-display text-[15px] font-semibold text-ink">
              দেরি হচ্ছে মনে হলে
            </h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
              ৪৮ ঘণ্টার বেশি হয়ে গেলে বা কোনো প্রশ্ন থাকলে সরাসরি কল করুন —
              সকাল ৯টা থেকে রাত ৯টা।
            </p>
            <a
              href={`tel:${SITE.supportPhone}`}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3.5 py-2.5 text-[14px] font-semibold text-brand-700 transition hover:bg-brand-100"
            >
              <Phone size={16} /> <span className="tnum">{SITE.supportPhone}</span>
            </a>
            <p className="mt-3 text-[12.5px] text-muted">
              অথবা ইমেইল: <span className="text-ink-2">{SITE.email}</span>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
