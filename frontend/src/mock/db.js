/**
 * ব্যাকএন্ড ছাড়া পুরো সাইট চালানোর জন্য নকল ডেটা।
 * Django চালু হলে এই ফোল্ডারটা আর ব্যবহার হবে না (VITE_USE_MOCK=false),
 * কিন্তু মুছবেন না — ডেমো দেখানো আর অফলাইনে কাজ করার জন্য কাজে লাগে।
 */

const img = (seed) => `https://picsum.photos/seed/${seed}/700/700`;

/* ------------------------------ ক্যাটাগরি ------------------------------ */

export const categories = [
  { id: 1, slug: "electronics", name: "ইলেকট্রনিক্স", icon: "📱", children: ["মোবাইল", "ল্যাপটপ", "হেডফোন", "ঘড়ি"] },
  { id: 2, slug: "fashion", name: "ফ্যাশন", icon: "👗", children: ["পাঞ্জাবি", "শাড়ি", "টি-শার্ট", "জুতা"] },
  { id: 3, slug: "home", name: "ঘর ও রান্নাঘর", icon: "🏠", children: ["কুকওয়্যার", "বিছানা", "ডেকোর", "লাইট"] },
  { id: 4, slug: "beauty", name: "সৌন্দর্য", icon: "💄", children: ["স্কিন কেয়ার", "মেকআপ", "চুলের যত্ন"] },
  { id: 5, slug: "books", name: "বই ও স্টেশনারি", icon: "📚", children: ["উপন্যাস", "একাডেমিক", "খাতা-কলম"] },
  { id: 6, slug: "grocery", name: "মুদি ও খাবার", icon: "🛒", children: ["চাল-ডাল", "মসলা", "স্ন্যাকস", "মধু"] },
  { id: 7, slug: "sports", name: "খেলাধুলা", icon: "⚽", children: ["ক্রিকেট", "ফুটবল", "জিম"] },
  { id: 8, slug: "kids", name: "শিশু", icon: "🧸", children: ["খেলনা", "শিশু পোশাক", "ডায়াপার"] },
];

/* -------------------------------- ভেন্ডর ------------------------------- */

export const vendors = [
  { id: 1, slug: "techzone-bd", shopName: "টেকজোন বিডি", district: "ঢাকা", rating: 4.7, ratingCount: 2140, isVerified: true, since: "2021-03-11", commissionRate: 8, shipsIn: 1, responseRate: 96 },
  { id: 2, slug: "dhaka-fashion", shopName: "ঢাকা ফ্যাশন হাউস", district: "ঢাকা", rating: 4.5, ratingCount: 1876, isVerified: true, since: "2020-08-02", commissionRate: 10, shipsIn: 2, responseRate: 92 },
  { id: 3, slug: "ghoroa", shopName: "ঘরোয়া", district: "চট্টগ্রাম", rating: 4.6, ratingCount: 940, isVerified: true, since: "2022-01-19", commissionRate: 9, shipsIn: 2, responseRate: 89 },
  { id: 4, slug: "rupkotha-boi", shopName: "রূপকথা বইঘর", district: "ঢাকা", rating: 4.9, ratingCount: 3320, isVerified: true, since: "2019-05-27", commissionRate: 6, shipsIn: 1, responseRate: 98 },
  { id: 5, slug: "shundori", shopName: "সুন্দরী কসমেটিকস", district: "সিলেট", rating: 4.3, ratingCount: 610, isVerified: false, since: "2023-02-14", commissionRate: 12, shipsIn: 3, responseRate: 84 },
  { id: 6, slug: "krishoker-bazar", shopName: "কৃষকের বাজার", district: "রাজশাহী", rating: 4.8, ratingCount: 1520, isVerified: true, since: "2021-11-08", commissionRate: 7, shipsIn: 2, responseRate: 94 },
  { id: 7, slug: "khelaghor", shopName: "খেলাঘর স্পোর্টস", district: "খুলনা", rating: 4.4, ratingCount: 430, isVerified: false, since: "2023-06-30", commissionRate: 10, shipsIn: 3, responseRate: 81 },
  { id: 8, slug: "chotoder-dokan", shopName: "ছোটদের দোকান", district: "ঢাকা", rating: 4.6, ratingCount: 780, isVerified: true, since: "2022-09-05", commissionRate: 9, shipsIn: 2, responseRate: 90 },
].map((v) => ({
  ...v,
  logo: img(`shop-${v.slug}`),
  banner: img(`banner-${v.slug}`),
  productCount: 0,
}));

/* ------------------------------- প্রোডাক্ট ------------------------------ */

/** [শিরোনাম, ক্যাটাগরি, ভেন্ডর আইডি, দাম, আগের দাম, স্টক, রেটিং, বিক্রি] */
const RAW_PRODUCTS = [
  ["Xiaomi Redmi Note 13 (৮/২৫৬ জিবি)", "electronics", 1, 24990, 27990, 18, 4.6, 312],
  ["Realme Buds Air 5 ওয়্যারলেস ইয়ারবাড", "electronics", 1, 3450, 4200, 46, 4.4, 890],
  ["Havit HV-KB395L মেকানিক্যাল কীবোর্ড", "electronics", 1, 4150, 5000, 12, 4.5, 205],
  ["Xiaomi Smart Band 8 ফিটনেস ব্যান্ড", "electronics", 1, 3990, 4800, 33, 4.3, 640],
  ["Anker PowerCore ২০০০০mAh পাওয়ার ব্যাংক", "electronics", 1, 3290, null, 27, 4.7, 411],
  ["Logitech M170 ওয়্যারলেস মাউস", "electronics", 1, 1150, 1400, 88, 4.2, 1230],
  ["A4Tech FH100i ওভার-ইয়ার হেডফোন", "electronics", 1, 1890, 2300, 5, 4.1, 156],

  ["সুতি এমব্রয়ডারি পাঞ্জাবি — অফ হোয়াইট", "fashion", 2, 1690, 2200, 40, 4.5, 520],
  ["জামদানি মোটিফ সুতি শাড়ি", "fashion", 2, 2450, 3100, 15, 4.8, 187],
  ["ওভারসাইজড কটন টি-শার্ট (ইউনিসেক্স)", "fashion", 2, 690, 900, 120, 4.3, 2100],
  ["ডেনিম জ্যাকেট — স্টোন ওয়াশ", "fashion", 2, 2290, 2900, 22, 4.4, 96],
  ["চামড়ার লোফার — কালো", "fashion", 2, 3150, 3900, 18, 4.2, 143],
  ["থ্রি-পিস আনস্টিচড লন সেট", "fashion", 2, 1850, 2400, 35, 4.6, 340],

  ["নন-স্টিক ফ্রাই প্যান ২৬ সেমি", "home", 3, 1250, 1600, 54, 4.4, 610],
  ["কিং সাইজ কমফোর্টার সেট", "home", 3, 3450, 4500, 16, 4.6, 210],
  ["স্টেইনলেস স্টিল প্রেসার কুকার ৫ লি.", "home", 3, 2790, 3400, 24, 4.5, 388],
  ["LED ওয়াল আর্ট — নিয়ন ‘আলো’", "home", 3, 990, 1400, 41, 4.1, 175],
  ["বাঁশের কাটিং বোর্ড সেট", "home", 3, 750, null, 68, 4.3, 224],
  ["মাটির কফি মগ (জোড়া)", "home", 3, 620, 800, 90, 4.7, 512],

  ["হিমু সমগ্র — হুমায়ূন আহমেদ", "books", 4, 890, 1200, 60, 4.9, 1840],
  ["সেই সময় — সুনীল গঙ্গোপাধ্যায়", "books", 4, 640, 800, 38, 4.8, 720],
  ["HSC পদার্থবিজ্ঞান ১ম পত্র গাইড", "books", 4, 420, 520, 150, 4.2, 2600],
  ["A5 হার্ডকভার নোটবুক (২০০ পাতা)", "books", 4, 280, 350, 200, 4.4, 1450],
  ["জেল পেন সেট — ১০ রঙ", "books", 4, 190, 260, 320, 4.3, 3100],

  ["ভিটামিন সি ফেস সিরাম ৩০ মিলি", "beauty", 5, 850, 1200, 44, 4.3, 680],
  ["আর্গান অয়েল হেয়ার মাস্ক", "beauty", 5, 690, 900, 52, 4.2, 410],
  ["ম্যাট লিকুইড লিপস্টিক — ৬ শেড", "beauty", 5, 1150, 1500, 28, 4.4, 295],
  ["সানস্ক্রিন SPF ৫০+ পিএ+++", "beauty", 5, 780, 950, 66, 4.6, 890],

  ["চিনিগুঁড়া চাল ৫ কেজি", "grocery", 6, 720, 850, 110, 4.7, 1520],
  ["সুন্দরবনের খাঁটি মধু ৫০০ গ্রাম", "grocery", 6, 950, 1250, 47, 4.8, 940],
  ["সরিষার তেল (ঘানি ভাঙা) ১ লিটার", "grocery", 6, 420, 500, 130, 4.6, 1780],
  ["মিক্সড ড্রাই ফ্রুটস ৫০০ গ্রাম", "grocery", 6, 890, 1100, 39, 4.5, 520],
  ["খেজুরের গুড় ১ কেজি", "grocery", 6, 560, 700, 72, 4.7, 630],

  ["ইংলিশ উইলো ক্রিকেট ব্যাট", "sports", 7, 4800, 6200, 9, 4.5, 78],
  ["ফুটবল সাইজ ৫ — ম্যাচ কোয়ালিটি", "sports", 7, 1350, 1700, 33, 4.3, 240],
  ["যোগা ম্যাট ৬ মিমি অ্যান্টি-স্লিপ", "sports", 7, 1100, 1450, 48, 4.4, 356],
  ["অ্যাডজাস্টেবল ডাম্বেল ১০ কেজি জোড়া", "sports", 7, 3900, 4800, 11, 4.6, 92],

  ["কাঠের বিল্ডিং ব্লক ১০০ পিস", "kids", 8, 1250, 1600, 37, 4.7, 410],
  ["রিমোট কন্ট্রোল রেসিং কার", "kids", 8, 1890, 2400, 21, 4.2, 168],
  ["শিশুদের সুতি ফ্রক (২-৪ বছর)", "kids", 8, 750, 950, 64, 4.5, 320],
  ["সফট টেডি বিয়ার — ৪০ সেমি", "kids", 8, 890, 1150, 43, 4.6, 275],
];

const SIZE_CATS = new Set(["fashion", "kids"]);

function buildVariants(slug, category, price, compareAt, stock) {
  if (SIZE_CATS.has(category)) {
    const sizes = category === "kids" ? ["২-৩ বছর", "৪-৫ বছর", "৬-৭ বছর"] : ["S", "M", "L", "XL"];
    const colors = ["কালো", "সাদা", "নেভি"];
    const out = [];
    sizes.forEach((size, si) => {
      colors.forEach((color, ci) => {
        out.push({
          id: `${slug}-${si}-${ci}`,
          sku: `${slug.toUpperCase().slice(0, 8)}-${si}${ci}`,
          options: { সাইজ: size, রঙ: color },
          price: price + si * 50,
          compareAtPrice: compareAt ? compareAt + si * 50 : null,
          stock: Math.max(0, Math.round(stock / (sizes.length * colors.length)) + (ci === 1 ? 3 : 0)),
          weightKg: 0.4,
        });
      });
    });
    return out;
  }

  return [
    {
      id: `${slug}-default`,
      sku: `${slug.toUpperCase().slice(0, 10)}-STD`,
      options: {},
      price,
      compareAtPrice: compareAt,
      stock,
      weightKg: 0.6,
    },
  ];
}

function slugify(title, index) {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return ascii ? `${ascii}-${index}` : `product-${index}`;
}

export const products = RAW_PRODUCTS.map(
  ([title, category, vendorId, price, compareAt, stock, rating, sold], i) => {
    const slug = slugify(title, i + 1);
    const vendor = vendors.find((v) => v.id === vendorId);
    const cat = categories.find((c) => c.slug === category);

    return {
      id: i + 1,
      slug,
      title,
      description:
        `${title} — ${vendor.shopName} থেকে সরাসরি। প্রতিটি পণ্য পাঠানোর আগে যাচাই করা হয়। ` +
        `৭ দিনের রিটার্ন সুবিধা, এবং সারা বাংলাদেশে হোম ডেলিভারি।`,
      images: [img(`${slug}-1`), img(`${slug}-2`), img(`${slug}-3`), img(`${slug}-4`)],
      category,
      categoryName: cat?.name ?? "",
      brand: "",
      vendor,
      variants: buildVariants(slug, category, price, compareAt, stock),
      price,
      compareAtPrice: compareAt,
      stock,
      rating,
      ratingCount: Math.round(sold * 0.28),
      soldCount: sold,
      isFreeShipping: price >= 2000,
      status: "live",
      createdAt: new Date(Date.now() - (i + 1) * 86400000 * 3).toISOString(),
      specs: {
        ব্র্যান্ড: vendor.shopName,
        ওয়ারেন্টি: category === "electronics" ? "৬ মাস সার্ভিস ওয়ারেন্টি" : "প্রযোজ্য নয়",
        "পণ্য কোড": `SB-${1000 + i}`,
        "কোথা থেকে": vendor.district,
      },
    };
  },
);

// প্রতি ভেন্ডরের প্রোডাক্ট সংখ্যা বসিয়ে দাও
vendors.forEach((v) => {
  v.productCount = products.filter((p) => p.vendor.id === v.id).length;
});

/* -------------------------------- রিভিউ -------------------------------- */

const REVIEW_TEXTS = [
  ["একদম ছবির মতোই পেয়েছি। প্যাকেজিং খুব ভালো ছিল।", 5],
  ["দাম অনুযায়ী মান ঠিক আছে। ডেলিভারি একদিন দেরি হয়েছে।", 4],
  ["অসাধারণ! আবার অর্ডার করব ইনশাআল্লাহ।", 5],
  ["মোটামুটি। আশা করেছিলাম আরেকটু ভালো হবে।", 3],
  ["বিক্রেতা খুব দ্রুত রেসপন্স করেছেন, ধন্যবাদ।", 5],
  ["কোয়ালিটি ভালো, তবে সাইজ একটু ছোট মনে হলো।", 4],
  ["ঠিকঠাক পেয়েছি, সবাইকে সাজেস্ট করব।", 5],
];

const REVIEWERS = [
  "রফিকুল ইসলাম", "নাসরিন আক্তার", "সাব্বির হোসেন", "তানিয়া রহমান",
  "মেহেদী হাসান", "ফারজানা ইয়াসমিন", "আরিফুল হক", "শারমিন সুলতানা",
];

export const reviews = products.flatMap((p) => {
  const count = 3 + (p.id % 4);
  return Array.from({ length: count }, (_, i) => {
    const [comment, rating] = REVIEW_TEXTS[(p.id + i) % REVIEW_TEXTS.length];
    return {
      id: `${p.id}-${i}`,
      productId: p.id,
      rating,
      comment,
      author: REVIEWERS[(p.id + i) % REVIEWERS.length],
      createdAt: new Date(Date.now() - (i + 1) * 86400000 * 6).toISOString(),
      isVerified: i % 3 !== 0,
      photos: i === 0 ? [img(`${p.slug}-rev`)] : [],
    };
  });
});

/* -------------------------------- কুপন --------------------------------- */

export const coupons = [
  { code: "SHOPBAZAR100", type: "flat", value: 100, minOrder: 1000, maxDiscount: null, vendorId: null, expiresAt: "2027-12-31", usageLimit: 1000, usedCount: 214, label: "৳১০০ ছাড় — সব দোকানে" },
  { code: "EID15", type: "percent", value: 15, minOrder: 1500, maxDiscount: 500, vendorId: null, expiresAt: "2027-12-31", usageLimit: 500, usedCount: 380, label: "ঈদ অফার — ১৫% (সর্বোচ্চ ৳৫০০)" },
  { code: "TECH500", type: "flat", value: 500, minOrder: 5000, maxDiscount: null, vendorId: 1, expiresAt: "2027-12-31", usageLimit: 200, usedCount: 65, label: "টেকজোন বিডি — ৳৫০০ ছাড়" },
  { code: "BOI10", type: "percent", value: 10, minOrder: 500, maxDiscount: 200, vendorId: 4, expiresAt: "2027-12-31", usageLimit: null, usedCount: 90, label: "রূপকথা বইঘর — ১০% ছাড়" },
];

/* ------------------------------- ব্যানার ------------------------------- */

export const banners = [
  { id: 1, title: "ঈদ কালেকশন ২০২৬", subtitle: "পাঞ্জাবি, শাড়ি ও থ্রি-পিসে ৪০% পর্যন্ত ছাড়", cta: "কিনতে যান", href: "/products?category=fashion", image: img("hero-eid"), tone: "brand" },
  { id: 2, title: "গ্যাজেট উইক", subtitle: "ইয়ারবাড, স্মার্টওয়াচ ও পাওয়ার ব্যাংকে বিশেষ দাম", cta: "অফার দেখুন", href: "/products?category=electronics", image: img("hero-tech"), tone: "dark" },
  { id: 3, title: "কৃষকের বাজার", subtitle: "খাঁটি মধু, ঘানি ভাঙা তেল আর দেশি চাল", cta: "অর্ডার করুন", href: "/products?category=grocery", image: img("hero-grocery"), tone: "accent" },
];

/* -------------------------- ভেন্ডরের নকল লেজার ------------------------- */

export const ledger = [
  { id: 1, kind: "sale", amount: 24990, orderNumber: "SB-100241", createdAt: "2026-08-28T10:12:00", released: true },
  { id: 2, kind: "commission", amount: -1999, orderNumber: "SB-100241", createdAt: "2026-08-28T10:12:00", released: true },
  { id: 3, kind: "sale", amount: 6900, orderNumber: "SB-100255", createdAt: "2026-08-30T16:40:00", released: true },
  { id: 4, kind: "commission", amount: -552, orderNumber: "SB-100255", createdAt: "2026-08-30T16:40:00", released: true },
  { id: 5, kind: "sale", amount: 3450, orderNumber: "SB-100268", createdAt: "2026-09-01T09:05:00", released: false },
  { id: 6, kind: "commission", amount: -276, orderNumber: "SB-100268", createdAt: "2026-09-01T09:05:00", released: false },
  { id: 7, kind: "refund", amount: -1150, orderNumber: "SB-100230", createdAt: "2026-08-26T14:20:00", released: true },
];

export const payouts = [
  { id: 1, amount: 42500, status: "paid", method: "বিকাশ ০১৭১২******", createdAt: "2026-08-15T10:00:00", paidAt: "2026-08-16T12:30:00" },
  { id: 2, amount: 31800, status: "paid", method: "ব্যাংক — ডাচ্-বাংলা", createdAt: "2026-08-01T10:00:00", paidAt: "2026-08-02T11:15:00" },
  { id: 3, amount: 18650, status: "processing", method: "বিকাশ ০১৭১২******", createdAt: "2026-09-01T10:00:00", paidAt: null },
];

/** ভেন্ডর ড্যাশবোর্ডের ৭ দিনের সেলস */
export const salesTrend = [
  { day: "শনি", amount: 8200 },
  { day: "রবি", amount: 12400 },
  { day: "সোম", amount: 9600 },
  { day: "মঙ্গল", amount: 15300 },
  { day: "বুধ", amount: 11800 },
  { day: "বৃহঃ", amount: 18900 },
  { day: "শুক্র", amount: 22400 },
];
