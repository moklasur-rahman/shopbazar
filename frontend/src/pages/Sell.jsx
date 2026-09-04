import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Store, ArrowRight, IdCard, FileText, Camera, Wallet, CheckCircle2,
  TrendingUp, Users, Truck, ShieldCheck, Headphones, Calculator, Info,
  Smartphone, PackageCheck,
} from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { Accordion, Badge, Button, Card, SectionHeader, Steps } from "../components/ui";
import { money, toBnDigits } from "../lib/format";
import { RULES, SITE } from "../config";

/* ------------------------------- ধাপ ------------------------------- */

const STEPS = [
  {
    title: "অ্যাকাউন্ট খুলুন",
    text: "মোবাইল নম্বর, নাম আর দোকানের নাম দিয়ে রেজিস্ট্রেশন। নম্বরে একটা OTP যাবে, সেটা দিলেই অ্যাকাউন্ট তৈরি।",
    hint: "সময় লাগে ২ মিনিট",
  },
  {
    title: "পরিচয় যাচাই করান",
    text: "NID-র সামনে ও পেছনের ছবি, আর টাকা নেওয়ার জন্য বিকাশ নম্বর বা ব্যাংক অ্যাকাউন্ট দিন। ট্রেড লাইসেন্স থাকলে দিন — না থাকলেও চলবে।",
    hint: "অনুমোদন ২৪-৪৮ ঘণ্টায়",
  },
  {
    title: "পণ্য আপলোড করুন",
    text: "ছবি, দাম, স্টক আর বিবরণ দিয়ে পণ্য যোগ করুন। ভালো ছবি আর পরিষ্কার বিবরণ দিলে বিক্রি অনেক বেশি হয়।",
    hint: "প্রথম দিনেই সম্ভব",
  },
  {
    title: "অর্ডার নিন, টাকা পান",
    text: "অর্ডার এলে প্যাক করে কুরিয়ারে দিন। ডেলিভারির পর কমিশন কেটে বাকি টাকা আপনার বিকাশ বা ব্যাংকে চলে যাবে।",
    hint: `হোল্ড ${toBnDigits(RULES.payoutHoldDays)} দিন`,
  },
];

/* ----------------------------- কাগজপত্র ---------------------------- */

const DOCUMENTS = [
  {
    icon: IdCard,
    title: "জাতীয় পরিচয়পত্র (NID)",
    text: "সামনে ও পেছনের স্পষ্ট ছবি। নামের বানান যেন অ্যাকাউন্টের নামের সাথে মেলে।",
    required: true,
  },
  {
    icon: Smartphone,
    title: "সচল মোবাইল নম্বর",
    text: "OTP আর অর্ডারের খবর এই নম্বরেই যাবে। যে নম্বরে বিকাশ আছে সেটা দিলে সুবিধা।",
    required: true,
  },
  {
    icon: Wallet,
    title: "বিকাশ নম্বর বা ব্যাংক অ্যাকাউন্ট",
    text: "বিক্রির টাকা এখানেই পাঠানো হবে। অ্যাকাউন্ট অবশ্যই আপনার নিজের নামে হতে হবে।",
    required: true,
  },
  {
    icon: FileText,
    title: "ট্রেড লাইসেন্স",
    text: "থাকলে দিন — যাচাই দ্রুত হয় আর দোকানে “যাচাই করা” ব্যাজ বসে। না থাকলেও শুরু করা যাবে।",
    required: false,
  },
  {
    icon: Camera,
    title: "পণ্যের ছবি",
    text: "সাদা বা পরিষ্কার ব্যাকগ্রাউন্ডে তোলা ছবি, প্রতি পণ্যে অন্তত ৩টি। মোবাইলে তোলা ছবিই যথেষ্ট।",
    required: true,
  },
  {
    icon: Store,
    title: "দোকানের নাম ও লোগো",
    text: "ক্রেতারা এই নামেই আপনাকে চিনবে। লোগো না থাকলে পরে যোগ করতে পারবেন।",
    required: false,
  },
];

/* ------------------------------ সুবিধা ----------------------------- */

const BENEFITS = [
  { icon: Wallet, title: "কোনো মাসিক ফি নেই", text: "দোকান খুলতে বা রাখতে এক টাকাও লাগে না। বিক্রি হলে তবেই কমিশন।" },
  { icon: Users, title: "তৈরি ক্রেতা", text: "সারা দেশের ক্রেতা ইতিমধ্যেই এখানে আসেন — আপনাকে আলাদা করে বিজ্ঞাপন দিতে হবে না।" },
  { icon: Truck, title: "কুরিয়ার যুক্ত করা", text: "পাঠাও, স্টেডফাস্ট, RedX — এক ক্লিকে কনসাইনমেন্ট, আলাদা চুক্তি লাগে না।" },
  { icon: ShieldCheck, title: "টাকার নিশ্চয়তা", text: "প্ল্যাটফর্ম টাকা আদায় করে, তাই ক্রেতা টাকা না দেওয়ার ঝুঁকি নেই।" },
  { icon: TrendingUp, title: "বিক্রির হিসাব", text: "কোন পণ্য কত বিক্রি হলো, কত আয় হলো — ড্যাশবোর্ডেই সব দেখতে পাবেন।" },
  { icon: Headphones, title: "বাংলায় সাপোর্ট", text: "সমস্যা হলে ফোনে বাংলায় কথা বলে সমাধান, সকাল ৯টা থেকে রাত ৯টা।" },
];

/*
 * ⚠️ Slider ইচ্ছে করে EarningsCalculator-এর **বাইরে**।
 *
 * ভেতরে থাকলে স্লাইডার নাড়ানোর সময় প্রতিটি পরিবর্তনে প্যারেন্ট রেন্ডার
 * হতো, আর React নতুন ফাংশনকে আলাদা কম্পোনেন্ট ধরে <input> টা খুলে
 * আবার বসাত। ফল: টেনে ধরে রাখা যেত না — মাঝপথেই আঙুল/মাউস ছুটে যেত।
 */

function Slider({ label, value, onChange, min, max, step, format }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-[13.5px] font-medium text-ink-2">{label}</label>
        <span className="tnum font-display text-[15px] font-bold text-brand-700">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-brand-500"
      />
    </div>
  );
}

/* ------------------------- আয়ের ক্যালকুলেটর ------------------------- */

function EarningsCalculator({ categories }) {
  const [price, setPrice] = useState(1500);
  const [monthlyUnits, setMonthlyUnits] = useState(50);
  const [category, setCategory] = useState("fashion");

  const rate = RULES.commissionByCategory[category] ?? RULES.defaultCommissionRate;

  const result = useMemo(() => {
    const gross = price * monthlyUnits;
    const commission = Math.round((gross * rate) / 100);
    return { gross, commission, net: gross - commission };
  }, [price, monthlyUnits, rate]);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-line bg-canvas px-5 py-3.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-white">
          <Calculator size={18} />
        </span>
        <div>
          <h3 className="font-display text-[16px] font-semibold text-ink">আয়ের হিসাব</h3>
          <p className="text-[12.5px] text-muted">স্লাইডার নাড়িয়ে দেখুন মাসে কত আসতে পারে</p>
        </div>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-2">
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-[13.5px] font-medium text-ink-2">
              আপনি কী বিক্রি করবেন?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(categories ?? []).map((c) => (
                <button
                  key={c.slug}
                  onClick={() => setCategory(c.slug)}
                  className={
                    category === c.slug
                      ? "rounded-lg border border-brand-500 bg-brand-50 px-2.5 py-1.5 text-[12.5px] font-medium text-brand-700"
                      : "rounded-lg border border-line-2 bg-white px-2.5 py-1.5 text-[12.5px] text-ink-2 transition hover:border-brand-300"
                  }
                >
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </div>

          <Slider
            label="পণ্যের গড় দাম"
            value={price}
            onChange={setPrice}
            min={100}
            max={20000}
            step={100}
            format={(v) => money(v)}
          />

          <Slider
            label="মাসে কতটি বিক্রি হবে"
            value={monthlyUnits}
            onChange={setMonthlyUnits}
            min={5}
            max={500}
            step={5}
            format={(v) => `${toBnDigits(v)}টি`}
          />
        </div>

        <div className="rounded-card bg-brand-gradient p-5 text-white">
          <p className="text-[12.5px] text-white/70">মাসে মোট বিক্রি</p>
          <p className="tnum font-display text-2xl font-bold">{money(result.gross)}</p>

          <div className="my-4 space-y-2 border-y border-white/15 py-3.5 text-[13.5px]">
            <div className="flex justify-between">
              <span className="text-white/75">
                কমিশন ({toBnDigits(rate)}%)
              </span>
              <span className="tnum">−{money(result.commission)}</span>
            </div>
            <div className="flex justify-between text-white/75">
              <span>মাসিক ফি</span>
              <span className="tnum">৳ ০</span>
            </div>
          </div>

          <p className="text-[12.5px] text-white/70">আপনার হাতে আসবে</p>
          <p className="tnum font-display text-3xl font-bold text-accent-300">
            {money(result.net)}
          </p>

          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-white/60">
            <Info size={13} className="mt-0.5 shrink-0" />
            আনুমানিক হিসাব। ডেলিভারি চার্জ ক্রেতা দেন, তাই এই অঙ্কে সেটা ধরা হয়নি।
          </p>
        </div>
      </div>
    </Card>
  );
}

/* -------------------------------- FAQ ------------------------------- */

const FAQ = [
  {
    q: "দোকান খুলতে কি টাকা লাগে?",
    a: "না। রেজিস্ট্রেশন, দোকান খোলা, পণ্য আপলোড — সবই বিনামূল্যে। আমরা টাকা নিই শুধু বিক্রি হলে, কমিশন হিসেবে। কোনো মাসিক বা বাৎসরিক ফি নেই।",
  },
  {
    q: "ট্রেড লাইসেন্স ছাড়া বিক্রি করা যাবে?",
    a: "হ্যাঁ, যাবে। শুধু NID দিয়েই শুরু করতে পারবেন। তবে ট্রেড লাইসেন্স দিলে যাচাই দ্রুত হয় এবং দোকানের নামের পাশে “যাচাই করা” ব্যাজ বসে — ক্রেতারা তখন বেশি ভরসা করেন।",
  },
  {
    q: "টাকা কবে হাতে পাব?",
    a: `পণ্য ডেলিভারি হওয়ার পর টাকা ${toBnDigits(RULES.payoutHoldDays)} দিন হোল্ডে থাকে — এই সময়টা ক্রেতার রিটার্ন করার জন্য রাখা। এরপর টাকা “তোলা যাবে” অবস্থায় চলে আসে, আর আপনি ড্যাশবোর্ড থেকে অনুরোধ করলে ১-২ কর্মদিবসে বিকাশ বা ব্যাংকে পৌঁছে যায়।`,
  },
  {
    q: "কমিশন কত কাটা হয়?",
    a: "ক্যাটাগরি অনুযায়ী ৫% থেকে ১২%। ইলেকট্রনিক্সে সবচেয়ে কম (৫%), কসমেটিকসে সবচেয়ে বেশি (১২%)। কমিশন শুধু পণ্যের দামের উপরে বসে — ডেলিভারি চার্জের উপরে নয়, কারণ ওই টাকাটা কুরিয়ারের।",
  },
  {
    q: "ডেলিভারি কে করবে?",
    a: "আপনি চাইলে নিজের কুরিয়ার ব্যবহার করতে পারেন, অথবা প্যানেল থেকে এক ক্লিকে পাঠাও/স্টেডফাস্ট/RedX-এ কনসাইনমেন্ট তৈরি করতে পারেন। কুরিয়ারের সাথে আলাদা চুক্তি করতে হবে না।",
  },
  {
    q: "ক্রেতা পণ্য ফেরত দিলে কী হয়?",
    a: "ক্রেতা ৭ দিনের মধ্যে ফেরত দিতে পারেন। পণ্যে সমস্যা থাকলে টাকা ফেরত যায় এবং আপনার লেজারে একটা রিফান্ড এন্ট্রি বসে। এজন্যই টাকা কিছুদিন হোল্ডে রাখা হয় — যাতে পে-আউটের পর ঝামেলা না হয়।",
  },
  {
    q: "একই পণ্যের সাইজ বা রঙ আলাদা করে দিতে পারব?",
    a: "হ্যাঁ। প্রতিটি পণ্যে একাধিক ভ্যারিয়েন্ট (সাইজ, রঙ, ওজন) যোগ করা যায়, প্রত্যেকটির আলাদা দাম আর স্টক থাকে। ক্রেতা পণ্যের পাতায় বেছে নিতে পারবেন।",
  },
  {
    q: "একজন ক্রেতা কয়েক দোকান থেকে একসাথে কিনলে কী হয়?",
    a: "ক্রেতার কাছে সেটা একটাই অর্ডার, কিন্তু প্রতিটি দোকানের জন্য আলাদা পার্সেল তৈরি হয়। আপনি শুধু আপনার নিজের পার্সেলটাই দেখবেন এবং প্যাক করে পাঠাবেন — অন্য বিক্রেতার পণ্য নিয়ে ভাবতে হবে না।",
  },
];

/* -------------------------------- পেজ ------------------------------- */

export default function Sell() {
  const categories = useAsync(() => api.catalog.listCategories(), []);
  const vendors = useAsync(() => api.vendors.list({ page_size: 8 }), []);

  const commissionRows = Object.entries(RULES.commissionByCategory)
    .map(([slug, rate]) => ({
      slug,
      rate,
      name: categories.data?.find((c) => c.slug === slug)?.name ?? slug,
      icon: categories.data?.find((c) => c.slug === slug)?.icon ?? "•",
    }))
    .sort((a, b) => a.rate - b.rate);

  return (
    <div>
      {/* ---------------------------- হিরো ---------------------------- */}
      <section className="bg-dark-gradient">
        <div className="bg-dots">
          <div className="container-page grid gap-10 py-12 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:py-16">
            <div>
              <Badge tone="gold">
                <Store size={12} /> বিক্রেতাদের জন্য
              </Badge>

              <h1 className="mt-4 font-display text-3xl leading-[1.15] font-bold text-white sm:text-4xl lg:text-[2.75rem]">
                আপনার দোকান খুলুন,
                <br />
                সারা দেশে বিক্রি করুন
              </h1>

              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/70">
                {SITE.name}-এ দোকান খুলতে কোনো টাকা লাগে না, কোনো মাসিক ফি নেই।
                শুধু NID আর একটা মোবাইল নম্বর দিয়েই আজ শুরু করতে পারেন —
                বিক্রি হলে তবেই কমিশন।
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Button as={Link} to="/register?role=vendor" variant="accent" size="lg">
                  বিনামূল্যে দোকান খুলুন <ArrowRight size={18} />
                </Button>
                <Button as="a" href="#kivabe" variant="onDark" size="lg">
                  কীভাবে কাজ করে দেখুন
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
                {[
                  ["৫–১২%", "কমিশন, ক্যাটাগরি অনুযায়ী"],
                  ["৳ ০", "সেটআপ ও মাসিক ফি"],
                  ["২৪-৪৮ ঘণ্টা", "অনুমোদনের সময়"],
                ].map(([big, small]) => (
                  <div key={small}>
                    <p className="tnum font-display text-xl font-bold text-accent-300">{big}</p>
                    <p className="text-[12.5px] text-white/55">{small}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* যারা ইতিমধ্যে বিক্রি করছেন */}
            <div className="rounded-card border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-[13px] font-medium text-white/70">
                যাঁরা ইতিমধ্যে এখানে বিক্রি করছেন
              </p>
              <div className="mt-4 space-y-3">
                {(vendors.data?.results ?? []).slice(0, 4).map((v) => (
                  <div key={v.id} className="flex items-center gap-3">
                    <img
                      src={v.logo}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-white">
                        {v.shopName}
                      </p>
                      <p className="tnum text-[11.5px] text-white/50">
                        {v.district} · {toBnDigits(v.productCount)}টি পণ্য
                      </p>
                    </div>
                    <span className="tnum shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-[11.5px] font-medium text-accent-200">
                      ★ {toBnDigits(v.rating.toFixed(1))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page space-y-14 py-12 sm:space-y-16">
        {/* --------------------------- ধাপ --------------------------- */}
        <section id="kivabe" className="scroll-mt-24">
          <SectionHeader
            title="৪ ধাপে দোকান খোলা"
            subtitle="প্রথম দিনেই পণ্য আপলোড করা সম্ভব"
          />
          <Steps steps={STEPS} />

          <div className="mt-7 flex flex-wrap items-center gap-4 rounded-card border border-brand-200 bg-brand-50 px-5 py-4">
            <PackageCheck size={22} className="shrink-0 text-brand-600" />
            <p className="flex-1 text-[14px] leading-relaxed text-brand-800">
              <b>এখনই দেখে নিতে চান প্যানেলটা কেমন?</b> ডেমো বিক্রেতা অ্যাকাউন্ট দিয়ে
              লগইন করুন — মোবাইল <span className="tnum">০১৭২২২২২২২২</span>, পাসওয়ার্ড{" "}
              <span className="tnum">1234</span>। পুরো ড্যাশবোর্ড ঘুরে দেখতে পারবেন।
            </p>
            <Button as={Link} to="/login" variant="outline" size="sm" className="shrink-0">
              ডেমো দেখুন
            </Button>
          </div>
        </section>

        {/* ------------------------ কাগজপত্র ------------------------ */}
        <section>
          <SectionHeader
            title="কী কী লাগবে"
            subtitle="হাতের কাছে রাখলে পুরো কাজ ১০ মিনিটে শেষ"
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DOCUMENTS.map((doc) => (
              <Card key={doc.title} className="flex gap-3.5 p-4">
                <span
                  className={
                    doc.required
                      ? "grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"
                      : "grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-canvas text-muted"
                  }
                >
                  <doc.icon size={19} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-[14.5px] font-semibold text-ink">
                      {doc.title}
                    </h3>
                    <Badge tone={doc.required ? "danger" : "neutral"}>
                      {doc.required ? "লাগবেই" : "ঐচ্ছিক"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{doc.text}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* ---------------------- ক্যালকুলেটর ---------------------- */}
        <section>
          <SectionHeader
            title="মাসে কত আয় হতে পারে"
            subtitle="আপনার পণ্যের দাম আর বিক্রির সংখ্যা দিয়ে হিসাব করে দেখুন"
          />
          <EarningsCalculator categories={categories.data} />
        </section>

        {/* ------------------------- কমিশন ------------------------- */}
        <section>
          <SectionHeader
            title="কমিশনের হার"
            subtitle="শুধু পণ্যের দামের উপরে — ডেলিভারি চার্জের উপরে নয়"
          />

          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="border-b border-line bg-canvas text-left text-[12px] text-muted">
                      <th className="px-4 py-3 font-medium">ক্যাটাগরি</th>
                      <th className="px-4 py-3 font-medium">কমিশন</th>
                      <th className="px-4 py-3 font-medium">৳১,০০০ বিক্রিতে আপনি পাবেন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {commissionRows.map((row) => (
                      <tr key={row.slug} className="transition hover:bg-canvas/60">
                        <td className="px-4 py-3">
                          <span className="mr-1.5">{row.icon}</span>
                          {row.name}
                        </td>
                        <td className="tnum px-4 py-3">
                          <span className="rounded-md bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">
                            {toBnDigits(row.rate)}%
                          </span>
                        </td>
                        <td className="tnum px-4 py-3 font-semibold text-ink">
                          {money(1000 - row.rate * 10)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* টাকা কবে পাবেন */}
            <Card className="p-5">
              <h3 className="font-display text-[16px] font-semibold text-ink">
                টাকা কবে হাতে পাবেন
              </h3>

              <ol className="mt-4 space-y-4">
                {[
                  { day: "দিন ০", title: "অর্ডার এলো", text: "ক্রেতা টাকা দিলেন বা COD নিলেন" },
                  { day: "দিন ১-৩", title: "ডেলিভারি হলো", text: "কুরিয়ার পণ্য পৌঁছে দিল" },
                  {
                    day: `দিন ${toBnDigits(RULES.payoutHoldDays)}`,
                    title: "হোল্ড শেষ",
                    text: "রিটার্নের সময় পার, টাকা তোলার জন্য খুলে গেল",
                  },
                  { day: "+১-২ দিন", title: "টাকা পৌঁছাল", text: "আপনার বিকাশ বা ব্যাংক অ্যাকাউন্টে" },
                ].map((item, i, arr) => (
                  <li key={item.title} className="relative flex gap-3.5">
                    {i < arr.length - 1 && (
                      <span className="absolute top-7 bottom-[-1rem] left-[0.6875rem] w-px bg-line" />
                    )}
                    <span className="relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-brand-500 bg-white">
                      <span className="h-2 w-2 rounded-full bg-brand-500" />
                    </span>
                    <div className="min-w-0">
                      <p className="tnum text-[11.5px] font-semibold text-accent-600">
                        {item.day}
                      </p>
                      <p className="text-[14px] font-medium text-ink">{item.title}</p>
                      <p className="text-[12.5px] text-muted">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </section>

        {/* -------------------------- সুবিধা -------------------------- */}
        <section>
          <SectionHeader
            title="কেন এখানে বিক্রি করবেন"
            subtitle="নিজের ওয়েবসাইট বানানোর ঝামেলা ছাড়াই"
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <Card key={b.title} hover className="p-5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <b.icon size={20} />
                </span>
                <h3 className="mt-3.5 font-display text-[15.5px] font-semibold text-ink">
                  {b.title}
                </h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{b.text}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* --------------------------- FAQ --------------------------- */}
        <section>
          <SectionHeader
            title="সচরাচর জিজ্ঞাসা"
            subtitle="যে প্রশ্নগুলো নতুন বিক্রেতারা সবচেয়ে বেশি করেন"
          />
          <Accordion items={FAQ} />
        </section>

        {/* ------------------------ শেষ CTA ------------------------ */}
        <section className="overflow-hidden rounded-card bg-brand-gradient">
          <div className="flex flex-col items-center gap-5 px-6 py-10 text-center sm:px-10">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-white backdrop-blur">
              <CheckCircle2 size={28} />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
                আজই শুরু করুন
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[14.5px] leading-relaxed text-white/75">
                রেজিস্ট্রেশনে ২ মিনিট, অনুমোদনে ২৪-৪৮ ঘণ্টা। এই সপ্তাহেই আপনার
                প্রথম অর্ডার আসতে পারে।
              </p>
            </div>
            <Button as={Link} to="/register?role=vendor" variant="accent" size="lg">
              দোকান খুলুন — বিনামূল্যে <ArrowRight size={18} />
            </Button>
            <p className="text-[12.5px] text-white/55">
              প্রশ্ন আছে? কল করুন <span className="tnum">{SITE.supportPhone}</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
