/**
 * এক জায়গায় সব রানটাইম সেটিং। .env বদলালেই পুরো অ্যাপের আচরণ বদলাবে,
 * কোনো কম্পোনেন্টে হাত দিতে হবে না।
 */

const env = import.meta.env;

export const USE_MOCK = String(env.VITE_USE_MOCK ?? "true") === "true";
export const API_URL = env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v1";
export const MEDIA_URL = env.VITE_MEDIA_URL ?? "";

export const SITE = {
  name: "শপবাজার",
  tagline: "হাজারো বিক্রেতা, এক ঠিকানায়",
  supportPhone: "০৯৬১২-৩৪৫৬৭৮",
  email: "help@shopbazar.com.bd",
};

/** ব্যবসার নিয়মগুলো — Django-তেও ঠিক এই মানগুলোই সেটিংসে রাখবেন */
export const RULES = {
  /** প্ল্যাটফর্মের ডিফল্ট কমিশন (%) — ভেন্ডর-ভিত্তিক ওভাররাইড হতে পারে */
  defaultCommissionRate: 8,

  /**
   * ক্যাটাগরি অনুযায়ী কমিশন (%)। বিক্রেতার পাতায় এই তালিকাটাই দেখানো হয়,
   * তাই এক জায়গায় বদলালে সব জায়গায় বদলাবে।
   */
  commissionByCategory: {
    electronics: 5,
    books: 6,
    grocery: 7,
    home: 9,
    kids: 9,
    fashion: 10,
    sports: 10,
    beauty: 12,
  },

  /** ডেলিভারি চার্জ (৳) */
  shipping: {
    insideDhaka: 60,
    outsideDhaka: 120,
    /** একাধিক ভেন্ডর হলে ২য় পার্সেল থেকে এই হারে চার্জ */
    extraVendorMultiplier: 0.5,
    /** এই টাকার উপরে অর্ডার হলে ওই ভেন্ডরের ডেলিভারি ফ্রি */
    freeShippingThreshold: 2000,
  },

  /** ডেলিভারির পর কত দিন টাকা আটকে থাকবে (রিটার্ন উইন্ডো) */
  payoutHoldDays: 7,

  /** কার্টে একই আইটেমের সর্বোচ্চ সংখ্যা */
  maxQtyPerItem: 10,

  /** প্রতি পেজে কয়টা প্রোডাক্ট */
  pageSize: 12,
};

/** localStorage কী — mock মোডে ডেটা টিকিয়ে রাখতে */
export const STORAGE_KEYS = {
  cart: "sb.cart.v1",
  auth: "sb.auth.v1",
  wishlist: "sb.wishlist.v1",
  recent: "sb.recent.v1",
  orders: "sb.orders.v1",
};
