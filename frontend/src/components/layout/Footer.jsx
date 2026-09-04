import { Link } from "react-router-dom";
import { Facebook, Instagram, Youtube, Mail, Phone, MapPin, ShieldCheck, Truck, RotateCcw, Headphones } from "lucide-react";
import { SITE } from "../../config";

const TRUST = [
  { icon: Truck, title: "দ্রুত ডেলিভারি", text: "ঢাকায় ২৪-৪৮ ঘণ্টা, সারাদেশে ৩-৫ দিন" },
  { icon: RotateCcw, title: "৭ দিনের রিটার্ন", text: "পণ্য পছন্দ না হলে ফেরত দিন" },
  { icon: ShieldCheck, title: "যাচাই করা বিক্রেতা", text: "প্রতিটি দোকান NID দিয়ে ভেরিফাইড" },
  { icon: Headphones, title: "সাপোর্ট", text: "সকাল ৯টা - রাত ৯টা, প্রতিদিন" },
];

const LINKS = [
  {
    title: "কেনাকাটা",
    items: [
      { label: "সব পণ্য", to: "/products" },
      { label: "সব দোকান", to: "/shops" },
      { label: "ফ্ল্যাশ সেল", to: "/products?ordering=-sold_count" },
      { label: "নতুন এসেছে", to: "/products?ordering=-created_at" },
    ],
  },
  {
    title: "অ্যাকাউন্ট",
    items: [
      { label: "আমার অর্ডার", to: "/orders" },
      { label: "উইশলিস্ট", to: "/wishlist" },
      { label: "লগইন", to: "/login" },
      { label: "বিক্রেতা হোন", to: "/sell" },
    ],
  },
  {
    title: "সহায়তা",
    items: [
      { label: "কীভাবে অর্ডার করবেন", to: "/help" },
      { label: "ডেলিভারি ও চার্জ", to: "/help" },
      { label: "রিটার্ন নীতি", to: "/help" },
      { label: "সচরাচর জিজ্ঞাসা", to: "/help" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-white">
      {/* ভরসার সারি */}
      <div className="border-b border-line">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-line lg:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.title} className="flex items-start gap-3 bg-white px-4 py-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-500">
                <t.icon size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-ink">{t.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="container-page py-10">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 font-display text-lg font-bold text-white">
                শ
              </span>
              <span className="font-display text-lg font-bold text-ink">{SITE.name}</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              {SITE.tagline}। দেশের ছোট-বড় বিক্রেতাদের এক প্ল্যাটফর্মে এনে ক্রেতার কাছে
              পৌঁছে দেওয়াই আমাদের কাজ।
            </p>

            <div className="mt-4 space-y-1.5 text-sm text-ink-2">
              <p className="flex items-center gap-2">
                <Phone size={15} className="text-brand-500" /> {SITE.supportPhone}
              </p>
              <p className="flex items-center gap-2">
                <Mail size={15} className="text-brand-500" /> {SITE.email}
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={15} className="text-brand-500" /> ধানমন্ডি, ঢাকা ১২০৯
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              {[Facebook, Instagram, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-2 transition hover:border-brand-400 hover:text-brand-600"
                  aria-label="সোশ্যাল লিংক"
                >
                  <Icon size={17} />
                </a>
              ))}
            </div>
          </div>

          {LINKS.map((group) => (
            <div key={group.title}>
              <h4 className="font-display text-sm font-semibold text-ink">{group.title}</h4>
              <ul className="mt-3 space-y-2">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="text-sm text-muted transition hover:text-brand-600"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            © ২০২৬ {SITE.name}। সর্বস্বত্ব সংরক্ষিত।
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {["বিকাশ", "নগদ", "রকেট", "VISA", "Mastercard", "COD"].map((m) => (
              <span
                key={m}
                className="rounded border border-line bg-canvas px-2 py-1 text-[11px] font-medium text-ink-2"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
