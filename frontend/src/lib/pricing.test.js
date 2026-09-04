/**
 * টাকার হিসাবের টেস্ট।
 *
 * ⚠️ এই নিয়মগুলো ব্যাকএন্ডের `apps/orders/services.py` এর সাথে হুবহু
 * মিলতে হবে। না মিললে ক্রেতা কার্টে এক টাকা দেখবেন আর চেকআউটে আরেক।
 * ব্যাকএন্ডে ঠিক এই কেসগুলোরই টেস্ট আছে `backend/tests/test_pricing.py`-তে —
 * একটা বদলালে অন্যটাও বদলাতে হবে।
 */

import { describe, expect, it } from "vitest";

import { applyCoupon, calculateCart, clampQuantity, groupByVendor, shippingForVendor, vendorSettlement } from "./pricing";

const vendorA = { id: 1, slug: "techzone-bd", shopName: "টেকজোন বিডি", commissionRate: 8 };
const vendorB = { id: 2, slug: "rupkotha-boi", shopName: "রূপকথা বইঘর", commissionRate: 6 };

function line(vendor, price, quantity = 1, id = `${vendor.id}-${price}`) {
  return { id, vendor, price, quantity, stock: 50, title: "পণ্য", options: {} };
}

/* ------------------------------ ডেলিভারি ------------------------------ */

describe("shippingForVendor", () => {
  it("ঢাকায় প্রথম পার্সেলে পূর্ণ চার্জ", () => {
    expect(shippingForVendor(0, 500, true)).toBe(60);
  });

  it("ঢাকার বাইরে বেশি চার্জ", () => {
    expect(shippingForVendor(0, 500, false)).toBe(120);
  });

  it("দ্বিতীয় পার্সেল থেকে অর্ধেক", () => {
    expect(shippingForVendor(1, 500, true)).toBe(30);
    expect(shippingForVendor(2, 500, true)).toBe(30);
    expect(shippingForVendor(1, 500, false)).toBe(60);
  });

  it("৳২০০০-এর উপরে হলে ফ্রি — ক্রম যাই হোক", () => {
    expect(shippingForVendor(0, 2000, true)).toBe(0);
    expect(shippingForVendor(3, 5000, false)).toBe(0);
  });

  it("সীমানার ঠিক দুই পাশে", () => {
    expect(shippingForVendor(0, 1999, true)).toBe(60);
    expect(shippingForVendor(0, 2000, true)).toBe(0);
  });
});

/* ------------------------------- গ্রুপিং ------------------------------- */

describe("groupByVendor", () => {
  it("দোকান অনুযায়ী ভাগ করে", () => {
    const groups = groupByVendor([
      line(vendorA, 100),
      line(vendorB, 200),
      line(vendorA, 300),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].vendor.id).toBe(1);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].itemsTotal).toBe(400);
  });

  it("সংখ্যা গুণ করে যোগ করে", () => {
    const [group] = groupByVendor([line(vendorA, 250, 3)]);
    expect(group.itemsTotal).toBe(750);
    expect(group.itemCount).toBe(3);
  });

  it("খালি কার্টে খালি তালিকা", () => {
    expect(groupByVendor([])).toEqual([]);
  });
});

/* -------------------------------- কুপন -------------------------------- */

describe("applyCoupon", () => {
  const groups = (...pairs) =>
    pairs.map(([vendor, total]) => ({ vendor, itemsTotal: total }));

  it("নির্দিষ্ট টাকার ছাড়", () => {
    const result = applyCoupon({ type: "flat", value: 100 }, groups([vendorA, 1000]));
    expect(result).toEqual({ ok: true, amount: 100 });
  });

  it("শতাংশের ছাড়", () => {
    const result = applyCoupon({ type: "percent", value: 15 }, groups([vendorA, 2000]));
    expect(result.amount).toBe(300);
  });

  it("সর্বোচ্চ ছাড়ের সীমা মানে", () => {
    const coupon = { type: "percent", value: 15, maxDiscount: 500 };
    expect(applyCoupon(coupon, groups([vendorA, 10000])).amount).toBe(500);
  });

  it("ছাড় কখনো পণ্যমূল্যের বেশি নয়", () => {
    const result = applyCoupon({ type: "flat", value: 5000 }, groups([vendorA, 300]));
    expect(result.amount).toBe(300);
  });

  it("ন্যূনতম অর্ডার না হলে চলে না", () => {
    const coupon = { type: "flat", value: 100, minOrder: 1000 };
    const result = applyCoupon(coupon, groups([vendorA, 500]));
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("কেনাকাটা");
  });

  it("দোকান-নির্দিষ্ট কুপন শুধু ওই দোকানের টাকায়", () => {
    const coupon = { type: "percent", value: 10, vendorId: 1 };
    const result = applyCoupon(coupon, groups([vendorA, 1000], [vendorB, 5000]));
    expect(result.amount).toBe(100); // ৬০০০ নয়
  });

  it("অন্য দোকানের কুপন চলে না", () => {
    const coupon = { type: "flat", value: 100, vendorId: 99 };
    const result = applyCoupon(coupon, groups([vendorA, 1000]));
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("চলবে না");
  });

  it("মেয়াদ শেষ হলে চলে না", () => {
    const coupon = { type: "flat", value: 100, expiresAt: "2020-01-01" };
    const result = applyCoupon(coupon, groups([vendorA, 1000]));
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("মেয়াদ");
  });

  it("ব্যবহারের সীমা শেষ হলে চলে না", () => {
    const coupon = { type: "flat", value: 100, usageLimit: 10, usedCount: 10 };
    expect(applyCoupon(coupon, groups([vendorA, 1000])).ok).toBe(false);
  });
});

/* ------------------------------ পুরো কার্ট ----------------------------- */

describe("calculateCart", () => {
  it("দুই দোকানের কার্টে দুই পার্সেল ও সঠিক চার্জ", () => {
    const summary = calculateCart({
      items: [line(vendorA, 20000), line(vendorB, 300)],
      insideDhaka: true,
    });

    expect(summary.groups).toHaveLength(2);
    expect(summary.itemsTotal).toBe(20300);
    expect(summary.groups[0].shipping).toBe(0);   // ২০,০০০ — ফ্রি
    expect(summary.groups[1].shipping).toBe(30);  // দ্বিতীয় পার্সেল
    expect(summary.shippingTotal).toBe(30);
    expect(summary.grandTotal).toBe(20330);
  });

  it("ছাড় পার্সেলগুলোর মধ্যে অনুপাতে ভাগ হয়", () => {
    const summary = calculateCart({
      items: [line(vendorA, 20000), line(vendorB, 300)],
      insideDhaka: true,
      coupon: { type: "flat", value: 100 },
    });

    const shared = summary.groups.reduce((sum, g) => sum + g.discount, 0);
    expect(shared).toBe(100);
    expect(summary.groups[0].discount).toBeGreaterThan(summary.groups[1].discount);
    expect(summary.grandTotal).toBe(20230);
  });

  it("খারাপ কুপনে কারণ জানায়, ছাড় দেয় না", () => {
    const summary = calculateCart({
      items: [line(vendorA, 500)],
      insideDhaka: true,
      coupon: { type: "flat", value: 100, minOrder: 1000 },
    });

    expect(summary.couponError).toBeTruthy();
    expect(summary.discount).toBe(0);
  });

  it("মোট কখনো ঋণাত্মক হয় না", () => {
    const summary = calculateCart({
      items: [line(vendorA, 100)],
      insideDhaka: true,
      coupon: { type: "flat", value: 99999 },
    });
    expect(summary.grandTotal).toBeGreaterThanOrEqual(0);
  });
});

/* ---------------------------- ভেন্ডরের প্রাপ্য --------------------------- */

describe("vendorSettlement", () => {
  it("কমিশন কেটে প্রাপ্য বের করে", () => {
    const result = vendorSettlement({ itemsTotal: 20000, commissionRate: 8 });
    expect(result.commission).toBe(1600);
    expect(result.payable).toBe(18400);
  });

  it("ছাড় বাদ দিয়ে কমিশন হিসাব হয়", () => {
    const result = vendorSettlement({
      itemsTotal: 1000, discount: 100, commissionRate: 10,
    });
    expect(result.netSales).toBe(900);
    expect(result.commission).toBe(90); // ১০০০ এর ১০% নয়
  });

  it("ডেলিভারি চার্জের উপরে কমিশন বসে না", () => {
    const result = vendorSettlement({
      itemsTotal: 1000, shipping: 500, commissionRate: 10,
    });
    expect(result.commission).toBe(100);
  });
});

/* ----------------------------- পরিমাণের সীমা ---------------------------- */

describe("clampQuantity", () => {
  it("স্টকের বেশি নেওয়া যায় না", () => {
    expect(clampQuantity(10, 3)).toBe(3);
  });

  it("সর্বোচ্চ সীমার বেশি নেওয়া যায় না", () => {
    expect(clampQuantity(50, 100)).toBe(10);
  });

  it("ঋণাত্মক হয় না", () => {
    expect(clampQuantity(-5, 10)).toBe(0);
  });
});
