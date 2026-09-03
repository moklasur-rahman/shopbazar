/**
 * মাল্টি-ভেন্ডর মার্কেটপ্লেসের পুরো টাকার হিসাব — সব বিশুদ্ধ ফাংশন,
 * কোনো React নেই। ঠিক এই একই নিয়ম Django-র `apps/orders/services.py`-তে
 * লিখলে ফ্রন্টএন্ড আর ব্যাকএন্ডের হিসাব কখনো আলাদা হবে না।
 *
 * গুরুত্বপূর্ণ: ফ্রন্টএন্ডের এই হিসাব শুধু *দেখানোর* জন্য।
 * অর্ডার তৈরির সময় ব্যাকএন্ড নিজে আবার হিসাব করবে — নাহলে ব্রাউজার থেকে
 * দাম বদলে দেওয়া যাবে।
 */

import { RULES } from "../config";

/* ------------------------------------------------------------------ */
/* কার্টকে ভেন্ডর অনুযায়ী ভাগ করা                                      */
/* ------------------------------------------------------------------ */

/**
 * কার্টের সমতল লিস্টকে ভেন্ডর-ভিত্তিক গ্রুপে ভাগ করে।
 * Django-তে এটাই `VendorOrder` তৈরির লজিক।
 *
 * @param {Array} items - [{ id, vendor: {id, shopName, slug}, ... }]
 * @returns {Array} [{ vendor, items, itemsTotal, itemCount }]
 */
export function groupByVendor(items = []) {
  const map = new Map();

  for (const item of items) {
    const key = item.vendor.id;
    if (!map.has(key)) {
      map.set(key, { vendor: item.vendor, items: [] });
    }
    map.get(key).items.push(item);
  }

  return [...map.values()].map((group) => ({
    ...group,
    itemsTotal: group.items.reduce((sum, it) => sum + it.price * it.quantity, 0),
    itemCount: group.items.reduce((sum, it) => sum + it.quantity, 0),
  }));
}

/* ------------------------------------------------------------------ */
/* ডেলিভারি চার্জ                                                      */
/* ------------------------------------------------------------------ */

/**
 * প্রতি ভেন্ডরের ডেলিভারি চার্জ।
 *
 * নিয়ম:
 *  ১. ঢাকার ভেতরে ৳৬০, বাইরে ৳১২০
 *  ২. প্রথম ভেন্ডর পুরো চার্জ, পরের প্রতিটা ভেন্ডর অর্ধেক
 *     (তিন দোকান থেকে কিনলে কাস্টমার যেন তিনগুণ চার্জ দেখে ভয় না পায়)
 *  ৩. কোনো ভেন্ডরের কেনাকাটা ৳২০০০ ছাড়ালে সেই পার্সেল ফ্রি
 *
 * @param {number} index - গ্রুপের ক্রম (০ = প্রথম)
 * @param {number} vendorSubtotal - ওই ভেন্ডরের পণ্যমূল্য
 * @param {boolean} insideDhaka
 */
export function shippingForVendor(index, vendorSubtotal, insideDhaka) {
  const { shipping } = RULES;

  if (vendorSubtotal >= shipping.freeShippingThreshold) return 0;

  const base = insideDhaka ? shipping.insideDhaka : shipping.outsideDhaka;
  if (index === 0) return base;

  return Math.round(base * shipping.extraVendorMultiplier);
}

/* ------------------------------------------------------------------ */
/* কুপন                                                                */
/* ------------------------------------------------------------------ */

/**
 * কুপন প্রযোজ্য কি না তা যাচাই করে ছাড়ের পরিমাণ ফেরত দেয়।
 *
 * কুপনের `vendorId` থাকলে সেটা শুধু ওই ভেন্ডরের পণ্যের উপরে বসবে —
 * এবং তার টাকাটা ওই ভেন্ডর বহন করবে। `vendorId` null মানে প্ল্যাটফর্মের
 * কুপন, খরচ প্ল্যাটফর্মের।
 *
 * @returns {{ ok: boolean, amount: number, reason?: string }}
 */
export function applyCoupon(coupon, groups) {
  if (!coupon) return { ok: false, amount: 0, reason: "কুপন নেই" };

  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { ok: false, amount: 0, reason: "কুপনের মেয়াদ শেষ" };
  }

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, amount: 0, reason: "কুপনের সীমা শেষ হয়ে গেছে" };
  }

  // কুপন কোন টাকার উপরে বসবে
  const scope = coupon.vendorId
    ? groups.filter((g) => g.vendor.id === coupon.vendorId)
    : groups;

  if (scope.length === 0) {
    return { ok: false, amount: 0, reason: "এই কুপন আপনার কার্টের পণ্যে চলবে না" };
  }

  const base = scope.reduce((sum, g) => sum + g.itemsTotal, 0);

  if (coupon.minOrder && base < coupon.minOrder) {
    return {
      ok: false,
      amount: 0,
      reason: `কমপক্ষে ৳${coupon.minOrder} টাকার কেনাকাটা লাগবে`,
    };
  }

  let amount =
    coupon.type === "percent" ? (base * coupon.value) / 100 : coupon.value;

  if (coupon.maxDiscount) amount = Math.min(amount, coupon.maxDiscount);
  amount = Math.min(amount, base); // ছাড় কখনো পণ্যমূল্যের বেশি হবে না

  return { ok: true, amount: Math.round(amount) };
}

/* ------------------------------------------------------------------ */
/* পুরো কার্টের সারাংশ                                                 */
/* ------------------------------------------------------------------ */

/**
 * চেকআউট পেজের একমাত্র সত্য। কার্ট + ঠিকানা + কুপন → পুরো হিসাব।
 *
 * @returns {{
 *   groups: Array, itemsTotal: number, shippingTotal: number,
 *   discount: number, grandTotal: number, itemCount: number,
 *   couponError: string|null
 * }}
 */
export function calculateCart({ items = [], insideDhaka = true, coupon = null }) {
  const groups = groupByVendor(items);

  // ধাপ ১ — প্রতি ভেন্ডরের ডেলিভারি চার্জ বসাও
  const withShipping = groups.map((group, index) => ({
    ...group,
    shipping: shippingForVendor(index, group.itemsTotal, insideDhaka),
  }));

  const itemsTotal = withShipping.reduce((s, g) => s + g.itemsTotal, 0);
  const shippingTotal = withShipping.reduce((s, g) => s + g.shipping, 0);
  const itemCount = withShipping.reduce((s, g) => s + g.itemCount, 0);

  // ধাপ ২ — কুপন
  const couponResult = coupon
    ? applyCoupon(coupon, withShipping)
    : { ok: true, amount: 0 };
  const discount = couponResult.ok ? couponResult.amount : 0;

  // ধাপ ৩ — ছাড়টা ভেন্ডরদের মধ্যে অনুপাতে ভাগ করে দাও, যাতে প্রতি
  // VendorOrder-এর নিজের সঠিক টোটাল থাকে (কমিশন হিসাবের জন্য দরকার)
  const discountBase = coupon?.vendorId
    ? withShipping
        .filter((g) => g.vendor.id === coupon.vendorId)
        .reduce((s, g) => s + g.itemsTotal, 0)
    : itemsTotal;

  const finalGroups = withShipping.map((group) => {
    const eligible = !coupon?.vendorId || coupon.vendorId === group.vendor.id;
    const share =
      eligible && discountBase > 0
        ? Math.round((group.itemsTotal / discountBase) * discount)
        : 0;

    return {
      ...group,
      discount: share,
      payableTotal: group.itemsTotal - share + group.shipping,
    };
  });

  return {
    groups: finalGroups,
    itemsTotal,
    shippingTotal,
    discount,
    grandTotal: Math.max(0, itemsTotal - discount + shippingTotal),
    itemCount,
    couponError: coupon && !couponResult.ok ? couponResult.reason : null,
  };
}

/* ------------------------------------------------------------------ */
/* ভেন্ডরের আয় ও কমিশন                                                */
/* ------------------------------------------------------------------ */

/**
 * একটা VendorOrder থেকে ভেন্ডর আসলে কত পাবে।
 *
 * কমিশন শুধু পণ্যমূল্যের উপরে বসে — ডেলিভারি চার্জের উপরে নয়,
 * কারণ ওই টাকাটা কুরিয়ারের।
 */
export function vendorSettlement({
  itemsTotal,
  discount = 0,
  shipping = 0,
  commissionRate = RULES.defaultCommissionRate,
  vendorFundedDiscount = true,
}) {
  const netSales = itemsTotal - (vendorFundedDiscount ? discount : 0);
  const commission = Math.round((netSales * commissionRate) / 100);

  return {
    grossSales: itemsTotal,
    discount,
    netSales,
    commissionRate,
    commission,
    shippingCollected: shipping,
    /** ভেন্ডরের ব্যাংকে/বিকাশে যাবে এই টাকা */
    payable: netSales - commission,
  };
}

/** স্টক অনুযায়ী কতটা যোগ করা যাবে */
export function clampQuantity(requested, stock) {
  const max = Math.min(stock ?? 0, RULES.maxQtyPerItem);
  return Math.max(0, Math.min(Math.floor(requested), max));
}
