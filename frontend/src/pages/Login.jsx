import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Phone, Lock, ArrowRight, Store, User, ShieldCheck } from "lucide-react";
import { useAuth } from "../store/AuthContext";
import { useToast } from "../store/ToastContext";
import { Button, Card, Field, Input } from "../components/ui";
import { isMockMode } from "../api";
import { SITE } from "../config";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [form, setForm] = useState({ phone: "", password: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const redirectTo = location.state?.from ?? "/";

  async function submit(e) {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      const user = await login(form);
      toast.success(`স্বাগতম, ${user.name}`);

      // যে যেখানে কাজ করেন, সেখানেই পাঠানো হয়
      const destination = user.isStaff
        ? "/admin"
        : user.role === "vendor"
          ? "/vendor"
          : redirectTo;
      navigate(destination, { replace: true });
    } catch (err) {
      setErrors(err.fields ?? {});
      if (!err.fields) toast.error(err.message || "লগইন করা গেল না");
    } finally {
      setBusy(false);
    }
  }

  const DEMO_ACCOUNTS = {
    customer: { phone: "01711111111", password: "1234" },
    vendor: { phone: "01722222222", password: "1234" },
    // ব্যাকএন্ডের `seed` ডেমো অ্যাডমিন বানায় না — createsuperuser দিয়ে
    // বানাতে হয়, তাই mock মোডে পাসওয়ার্ড 1234, আসল API-তে যা সেট করেছেন
    admin: { phone: "01700000000", password: isMockMode ? "1234" : "admin1234" },
  };

  function fillDemo(role) {
    setForm(DEMO_ACCOUNTS[role] ?? DEMO_ACCOUNTS.customer);
    setErrors({});
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-500 font-display text-xl font-bold text-white">
          শ
        </span>
        <h1 className="mt-3 font-display text-2xl font-semibold text-ink">আবার স্বাগতম</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          {SITE.name}-এ লগইন করে কেনাকাটা চালিয়ে যান
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <Field label="মোবাইল নম্বর" required error={errors.phone}>
            <Input
              icon={Phone}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              invalid={!!errors.phone}
              inputMode="numeric"
              placeholder="01712345678"
              className="tnum"
              autoComplete="tel"
            />
          </Field>

          <Field label="পাসওয়ার্ড" required error={errors.password}>
            <Input
              icon={Lock}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              invalid={!!errors.password}
              placeholder="••••••"
              autoComplete="current-password"
            />
          </Field>

          <Button type="submit" size="lg" className="w-full" loading={busy}>
            লগইন করুন <ArrowRight size={17} />
          </Button>
        </form>

        {/* ডেমো অ্যাকাউন্ট দুই মোডেই কাজ করে — ব্যাকএন্ডের `seed` কমান্ড
            হুবহু এই দুটো অ্যাকাউন্টই তৈরি করে। */}
        <div className="mt-5 rounded-lg border border-dashed border-line-2 bg-canvas p-3.5">
          <p className="text-[12.5px] font-medium text-ink-2">
            ডেমো অ্যাকাউন্ট
            <span className="ml-1.5 font-normal text-muted">
              ({isMockMode ? "ব্রাউজারের ডেটা" : "Django ব্যাকএন্ড"})
            </span>
          </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { role: "customer", icon: User, label: "ক্রেতা", tone: "text-brand-500" },
              { role: "vendor", icon: Store, label: "বিক্রেতা", tone: "text-accent-500" },
              { role: "admin", icon: ShieldCheck, label: "অ্যাডমিন", tone: "text-ink" },
            ].map((demo) => (
              <button
                key={demo.role}
                onClick={() => fillDemo(demo.role)}
                className="flex flex-col items-start gap-1 rounded-lg border border-line bg-white px-2.5 py-2 text-left transition hover:border-brand-300"
              >
                <demo.icon size={15} className={demo.tone} />
                <span className="text-[12.5px] font-medium text-ink">{demo.label}</span>
                <span className="tnum text-[10.5px] text-muted">
                  {DEMO_ACCOUNTS[demo.role].phone}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
            ক্রেতা ও বিক্রেতার পাসওয়ার্ড <b className="tnum">1234</b>
            {!isMockMode && (
              <> · অ্যাডমিনেরটা আপনি <code className="text-[11px]">createsuperuser</code> দিয়ে যা দিয়েছেন</>
            )}
          </p>
        </div>
      </Card>

      <p className="mt-5 text-center text-[13.5px] text-muted">
        অ্যাকাউন্ট নেই?{" "}
        <Link to="/register" className="font-medium text-brand-600 hover:underline">
          রেজিস্ট্রেশন করুন
        </Link>
      </p>
    </div>
  );
}
