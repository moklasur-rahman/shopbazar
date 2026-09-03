import { Link } from "react-router-dom";
import {
  Search, ShoppingCart, PackageCheck, Store, Truck,
  RotateCcw, CreditCard, Phone, Mail, MessageCircle, Boxes, ShieldCheck,
} from "lucide-react";
import { Accordion, Button, Card, SectionHeader, Steps } from "../components/ui";
import { money, toBnDigits } from "../lib/format";
import { RULES, SITE } from "../config";

const ORDER_STEPS = [
  { title: "পণ্য খুঁজুন", text: "উপরের সার্চ বক্সে নাম লিখুন, অথবা ক্যাটাগরি থেকে ঘুরে দেখুন। দাম, রেটিং বা দোকান দিয়ে ফিল্টার করতে পারেন।" },
  { title: "কার্টে যোগ করুন", text: "সাইজ বা রঙ থাকলে বেছে নিন, তারপর “কার্টে যোগ করুন”। একাধিক দোকান থেকে একসাথে নিতে পারবেন।" },
  { title: "ঠিকানা ও পেমেন্ট দিন", text: "নাম, মোবাইল আর পুরো ঠিকানা লিখুন। ক্যাশ অন ডেলিভারি, বিকাশ, নগদ বা কার্ড — যেটা সুবিধা।" },
  { title: "পণ্য বুঝে নিন", text: "অর্ডারের পাতা থেকে প্রতিটি পার্সেল আলাদা করে ট্র্যাক করুন। পছন্দ না হলে ৭ দিনের মধ্যে ফেরত।" },
];

const FAQ = [
  {
    q: "এক অর্ডারে একাধিক দোকানের পণ্য নিলে কী হয়?",
    a: "আপনার কাছে সেটা একটাই অর্ডার — একবার টাকা দেবেন, একটাই অর্ডার নম্বর পাবেন। কিন্তু প্রতিটি দোকান নিজে নিজে পণ্য প্যাক করে পাঠায়, তাই পার্সেল আলাদা আলাদা আসবে এবং একই দিনে নাও আসতে পারে। অর্ডারের পাতায় প্রতিটি পার্সেলের অবস্থা আলাদা করে দেখতে পাবেন।",
  },
  {
    q: "একাধিক দোকান থেকে কিনলে ডেলিভারি চার্জ কি কয়েকগুণ হবে?",
    a: `না। প্রথম পার্সেলের পূর্ণ চার্জ (ঢাকায় ${money(RULES.shipping.insideDhaka)}, ঢাকার বাইরে ${money(RULES.shipping.outsideDhaka)}), আর বাকি প্রতিটি পার্সেলে অর্ধেক চার্জ। এছাড়া কোনো এক দোকান থেকে ${money(RULES.shipping.freeShippingThreshold)} টাকার বেশি কিনলে সেই পার্সেলের ডেলিভারি একদম ফ্রি।`,
  },
  {
    q: "পণ্য হাতে পেতে কত দিন লাগে?",
    a: "ঢাকা সিটির ভেতরে সাধারণত ২৪-৪৮ ঘণ্টা, ঢাকার বাইরে ৩-৫ দিন। প্রতিটি দোকানের পাতায় লেখা থাকে তারা কত দিনে পণ্য কুরিয়ারে দেয়।",
  },
  {
    q: "ক্যাশ অন ডেলিভারি আছে?",
    a: "হ্যাঁ, সারা বাংলাদেশে। পণ্য হাতে পেয়ে কুরিয়ারকে টাকা দেবেন। চাইলে বিকাশ, নগদ বা কার্ডেও আগে পরিশোধ করতে পারেন।",
  },
  {
    q: "পণ্য পছন্দ না হলে ফেরত দেওয়া যাবে?",
    a: "হ্যাঁ, পণ্য হাতে পাওয়ার ৭ দিনের মধ্যে। পণ্য অব্যবহৃত ও আসল প্যাকেটে থাকতে হবে। অর্ডারের পাতা থেকে রিটার্নের অনুরোধ করলে আমরা কুরিয়ার পাঠিয়ে পণ্য ফেরত নেব, টাকা ৫-৭ কর্মদিবসে ফেরত যাবে।",
  },
  {
    q: "অর্ডার বাতিল করব কীভাবে?",
    a: "দোকান পণ্য প্যাক করে ফেলার আগ পর্যন্ত বাতিল করা যায়। অর্ডারের পাতায় গিয়ে যে পার্সেলটি বাতিল করতে চান তার পাশে “বাতিল করুন” বোতামে চাপুন। একাধিক দোকানের অর্ডার হলে শুধু একটি পার্সেলও বাতিল করা যায়।",
  },
  {
    q: "কুপন কোড কীভাবে ব্যবহার করব?",
    a: "কার্টের পাতায় ডান পাশে কুপনের ঘর আছে। কোড লিখে “প্রয়োগ” চাপুন। কিছু কুপন সব দোকানে চলে, কিছু নির্দিষ্ট দোকানের পণ্যেই চলে — কোন কুপন কোথায় চলবে সেটা প্রয়োগ করলেই দেখতে পাবেন।",
  },
  {
    q: "বিক্রেতা ভরসাযোগ্য কি না বুঝব কীভাবে?",
    a: "দোকানের নামের পাশে নীল টিক থাকলে বুঝবেন NID ও কাগজপত্র যাচাই করা হয়েছে। এছাড়া প্রতিটি দোকানের রেটিং, কতজন রেটিং দিয়েছেন, রেসপন্স রেট আর কত দিনে পণ্য পাঠায় — সবই দোকানের পাতায় লেখা থাকে।",
  },
  {
    q: "অ্যাকাউন্ট ছাড়া কেনা যাবে?",
    a: "কার্টে পণ্য রাখা যাবে অ্যাকাউন্ট ছাড়াই। তবে অর্ডার করার সময় মোবাইল নম্বর লাগবে, কারণ ওই নম্বরেই কুরিয়ার যোগাযোগ করবে আর আপনি অর্ডার ট্র্যাক করতে পারবেন।",
  },
];

const QUICK = [
  { icon: Truck, title: "ডেলিভারি", text: `ঢাকায় ${money(RULES.shipping.insideDhaka)} · বাইরে ${money(RULES.shipping.outsideDhaka)}`, sub: `${money(RULES.shipping.freeShippingThreshold)}+ কিনলে ফ্রি` },
  { icon: RotateCcw, title: "রিটার্ন", text: "৭ দিনের মধ্যে", sub: "অব্যবহৃত ও আসল প্যাকেটে" },
  { icon: CreditCard, title: "পেমেন্ট", text: "COD, বিকাশ, নগদ, কার্ড", sub: "সব পদ্ধতিতেই নিরাপদ" },
  { icon: ShieldCheck, title: "নিরাপত্তা", text: "যাচাই করা বিক্রেতা", sub: "NID ও কাগজপত্র দেখা হয়" },
];

export default function Help() {
  return (
    <div className="container-page space-y-12 py-8 sm:space-y-14">
      {/* হেডার */}
      <section className="rounded-card bg-brand-gradient px-6 py-10 text-center sm:px-10 sm:py-12">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-white backdrop-blur">
          <MessageCircle size={26} />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-white sm:text-3xl">
          সাহায্য ও তথ্য
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-[14.5px] leading-relaxed text-white/75">
          কেনাকাটা, ডেলিভারি, পেমেন্ট আর রিটার্ন নিয়ে যা যা জানা দরকার —
          সবই সহজ বাংলায় এখানে।
        </p>
      </section>

      {/* দ্রুত তথ্য */}
      <section>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK.map((q) => (
            <Card key={q.title} className="p-4">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <q.icon size={19} />
              </span>
              <h2 className="mt-3 font-display text-[15px] font-semibold text-ink">{q.title}</h2>
              <p className="tnum mt-0.5 text-[13.5px] font-medium text-ink-2">{q.text}</p>
              <p className="mt-0.5 text-[12px] text-muted">{q.sub}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* কীভাবে অর্ডার করবেন */}
      <section>
        <SectionHeader
          title="কীভাবে অর্ডার করবেন"
          subtitle="প্রথমবার কিনছেন? চারটি ধাপ, ব্যস"
        />
        <Steps steps={ORDER_STEPS} />
      </section>

      {/* মাল্টি-ভেন্ডর ব্যাখ্যা */}
      <section>
        <Card className="overflow-hidden">
          <div className="grid lg:grid-cols-[1fr_1.1fr]">
            <div className="border-b border-line p-6 lg:border-r lg:border-b-0">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-50 text-accent-500">
                <Boxes size={21} />
              </span>
              <h2 className="mt-3.5 font-display text-xl font-semibold text-ink">
                “আমার অর্ডার কেন কয়েক ভাগে আসছে?”
              </h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
                {SITE.name} একটা <b>মার্কেটপ্লেস</b> — এখানে একটা দোকান নয়, হাজারো
                আলাদা দোকান তাদের পণ্য বিক্রি করে। আপনি যখন তিনটি দোকান থেকে পণ্য
                নেন, তিনজন আলাদা বিক্রেতা তাদের নিজের দোকান থেকে পণ্য প্যাক করেন।
              </p>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-2">
                তাই <b>টাকা দেবেন একবার</b>, কিন্তু <b>পার্সেল আসবে আলাদা</b> — এবং
                একেকটা একেক দিনে আসতে পারে। এতে ভয়ের কিছু নেই, প্রতিটি পার্সেল
                আলাদাভাবে ট্র্যাক করা যায়।
              </p>
            </div>

            {/* দৃশ্যমান উদাহরণ */}
            <div className="bg-canvas p-6">
              <p className="text-[12.5px] font-medium text-muted">উদাহরণ — একটি অর্ডার</p>

              <div className="mt-3 rounded-xl border border-line bg-white p-3.5">
                <div className="flex items-center gap-2 border-b border-line pb-2.5">
                  <ShoppingCart size={15} className="text-brand-600" />
                  <span className="tnum text-[13.5px] font-semibold text-ink">SB-১০০২৪১</span>
                  <span className="tnum ml-auto text-[13px] font-semibold text-brand-700">
                    {money(26800)}
                  </span>
                </div>

                <div className="mt-3 space-y-2.5">
                  {[
                    { shop: "টেকজোন বিডি", item: "১টি মোবাইল", eta: "১-২ দিনে", fee: "ফ্রি" },
                    { shop: "রূপকথা বইঘর", item: "২টি বই", eta: "২-৩ দিনে", fee: money(30) },
                  ].map((p, i) => (
                    <div
                      key={p.shop}
                      className="flex items-center gap-2.5 rounded-lg border border-line bg-canvas/60 px-3 py-2.5"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand-100 text-[11px] font-bold text-brand-700">
                        {toBnDigits(i + 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 truncate text-[13px] font-medium text-ink">
                          <Store size={11} className="shrink-0 text-muted" />
                          {p.shop}
                        </p>
                        <p className="text-[11.5px] text-muted">
                          {p.item} · {p.eta}
                        </p>
                      </div>
                      <span className="tnum shrink-0 text-[12px] font-medium text-brand-700">
                        {p.fee}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted">
                  <PackageCheck size={13} className="mt-0.5 shrink-0 text-brand-500" />
                  দুইটি আলাদা পার্সেল, কিন্তু একটাই অর্ডার নম্বর আর একবারই পেমেন্ট।
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* FAQ */}
      <section>
        <SectionHeader title="সচরাচর জিজ্ঞাসা" subtitle="প্রশ্নে চাপ দিলে উত্তর খুলবে" />
        <Accordion items={FAQ} />
      </section>

      {/* যোগাযোগ */}
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Phone, title: "ফোনে কথা বলুন", value: SITE.supportPhone, sub: "সকাল ৯টা – রাত ৯টা", href: `tel:${SITE.supportPhone}` },
          { icon: Mail, title: "ইমেইল করুন", value: SITE.email, sub: "২৪ ঘণ্টায় উত্তর", href: `mailto:${SITE.email}` },
          { icon: Store, title: "বিক্রি করতে চান?", value: "দোকান খুলুন", sub: "বিনামূল্যে, ২ মিনিটে", to: "/sell" },
        ].map((c) => {
          const inner = (
            <Card hover className="h-full p-5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <c.icon size={19} />
              </span>
              <p className="mt-3 text-[12.5px] text-muted">{c.title}</p>
              <p className="tnum font-display text-[16px] font-semibold text-ink">{c.value}</p>
              <p className="mt-0.5 text-[12px] text-muted">{c.sub}</p>
            </Card>
          );
          return c.to ? (
            <Link key={c.title} to={c.to} className="block">{inner}</Link>
          ) : (
            <a key={c.title} href={c.href} className="block">{inner}</a>
          );
        })}
      </section>

      <div className="text-center">
        <Button as={Link} to="/products" size="lg">
          <Search size={17} /> কেনাকাটা শুরু করুন
        </Button>
      </div>
    </div>
  );
}
