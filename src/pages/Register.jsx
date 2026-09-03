import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Phone, Lock, User, Mail, Store, ArrowRight, ShoppingBag } from "lucide-react";
import { useAuth } from "../store/AuthContext";
import { useToast } from "../store/ToastContext";
import { Button, Card, Field, Input } from "../components/ui";
import { classNames as cx, isValidBdPhone } from "../lib/format";

export default function Register() {
  const [params] = useSearchParams();
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [role, setRole] = useState(params.get("role") === "vendor" ? "vendor" : "customer");
  const [form, setForm] = useState({
    name: "", phone: "", email: "", password: "", confirm: "", shopName: "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const next = {};
    if (form.name.trim().length < 3) next.name = "পুরো নাম লিখুন";
    if (!isValidBdPhone(form.phone)) next.phone = "সঠিক মোবাইল নম্বর দিন";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) next.email = "ইমেইল ঠিক নয়";
    if (form.password.length < 4) next.password = "কমপক্ষে ৪ অক্ষরের পাসওয়ার্ড দিন";
    if (form.password !== form.confirm) next.confirm = "পাসওয়ার্ড দুটো মিলছে না";
    if (role === "vendor" && form.shopName.trim().length < 3) {
      next.shopName = "দোকানের নাম লিখুন";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const user = await register({ ...form, role });
      toast.success(
        role === "vendor"
          ? "দোকানের আবেদন জমা হয়েছে — অ্যাডমিন যাচাই করে অনুমোদন দেবেন"
          : `স্বাগতম, ${user.name}`,
      );
      navigate(role === "vendor" ? "/vendor" : "/", { replace: true });
    } catch (err) {
      setErrors(err.fields ?? {});
      if (!err.fields) toast.error(err.message || "রেজিস্ট্রেশন করা গেল না");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">অ্যাকাউন্ট খুলুন</h1>
        <p className="mt-1 text-[13.5px] text-muted">এক মিনিটেই শুরু করতে পারবেন</p>
      </div>

      {/* ভূমিকা বাছাই */}
      <div className="mb-4 grid grid-cols-2 gap-2.5">
        {[
          { id: "customer", icon: ShoppingBag, title: "আমি ক্রেতা", text: "কেনাকাটা করব" },
          { id: "vendor", icon: Store, title: "আমি বিক্রেতা", text: "পণ্য বিক্রি করব" },
        ].map((option) => (
          <button
            key={option.id}
            onClick={() => setRole(option.id)}
            className={cx(
              "flex flex-col items-start gap-1.5 rounded-xl border-2 p-4 text-left transition",
              role === option.id
                ? "border-brand-500 bg-brand-50"
                : "border-line bg-white hover:border-brand-300",
            )}
          >
            <option.icon
              size={20}
              className={role === option.id ? "text-brand-600" : "text-muted"}
            />
            <span className="text-[14px] font-semibold text-ink">{option.title}</span>
            <span className="text-[12px] text-muted">{option.text}</span>
          </button>
        ))}
      </div>

      <Card className="p-6">
        <form onSubmit={submit} className="space-y-4">
          {role === "vendor" && (
            <Field label="দোকানের নাম" required error={errors.shopName}>
              <Input
                icon={Store}
                value={form.shopName}
                onChange={(e) => set("shopName", e.target.value)}
                invalid={!!errors.shopName}
                placeholder="যেমন: টেকজোন বিডি"
              />
            </Field>
          )}

          <Field label="পুরো নাম" required error={errors.name}>
            <Input
              icon={User}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              invalid={!!errors.name}
              placeholder="যেমন: রফিকুল ইসলাম"
              autoComplete="name"
            />
          </Field>

          <Field label="মোবাইল নম্বর" required error={errors.phone} hint="এই নম্বরেই OTP যাবে">
            <Input
              icon={Phone}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              invalid={!!errors.phone}
              inputMode="numeric"
              placeholder="01712345678"
              className="tnum"
              autoComplete="tel"
            />
          </Field>

          <Field label="ইমেইল (ঐচ্ছিক)" error={errors.email}>
            <Input
              icon={Mail}
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              invalid={!!errors.email}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="পাসওয়ার্ড" required error={errors.password}>
              <Input
                icon={Lock}
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                invalid={!!errors.password}
                autoComplete="new-password"
              />
            </Field>

            <Field label="আবার লিখুন" required error={errors.confirm}>
              <Input
                icon={Lock}
                type="password"
                value={form.confirm}
                onChange={(e) => set("confirm", e.target.value)}
                invalid={!!errors.confirm}
                autoComplete="new-password"
              />
            </Field>
          </div>

          {role === "vendor" && (
            <p className="rounded-lg bg-accent-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-accent-600">
              দোকান খোলার পর NID ও ট্রেড লাইসেন্স আপলোড করতে হবে। অ্যাডমিন যাচাই করে
              অনুমোদন দিলে আপনার পণ্য সাইটে দেখা যাবে।
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" loading={busy}>
            {role === "vendor" ? "দোকান খুলুন" : "অ্যাকাউন্ট খুলুন"} <ArrowRight size={17} />
          </Button>
        </form>
      </Card>

      <p className="mt-5 text-center text-[13.5px] text-muted">
        আগে থেকেই অ্যাকাউন্ট আছে?{" "}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          লগইন করুন
        </Link>
      </p>
    </div>
  );
}
