/**
 * ফ্রন্টএন্ডের নিয়ম আর `shared/business-rules.json` এক আছে কি না।
 *
 * ব্যাকএন্ডেও ঠিক এই একই টেস্ট আছে — `backend/tests/test_business_rules.py`।
 * দুইটা মিলে নিশ্চিত করে যে তিন জায়গার (shared, frontend, backend) মান
 * কখনো আলাদা হয়ে যাবে না।
 *
 * আলাদা হলে কী হতো: ক্রেতা কার্টে ৳৬০ ডেলিভারি চার্জ দেখে চেকআউটে গিয়ে
 * ৳১২০ দেখতেন — আর সেটা ধরার আগেই অর্ডার হয়ে যেত।
 */

import { describe, expect, it } from "vitest";

// ফ্রন্টএন্ড ফোল্ডারের বাইরের ফাইল — vite.config.js এর server.fs.allow
// এটাকে পড়ার অনুমতি দেয়। শুধু এই টেস্টেই ইমপোর্ট হয়, তাই অ্যাপের
// বান্ডলে এক বাইটও যায় না।
import sharedRaw from "../../../shared/business-rules.json";

import { RULES } from "../config";

/** "$" দিয়ে শুরু হওয়া কীগুলো শুধু মন্তব্য */
const shared = Object.fromEntries(
  Object.entries(sharedRaw).filter(([key]) => !key.startsWith("$")),
);

describe("ব্যবসার নিয়ম — shared/business-rules.json এর সাথে মিল", () => {
  it("ডিফল্ট কমিশন", () => {
    expect(RULES.defaultCommissionRate).toBe(shared.defaultCommissionRate);
  });

  it("ক্যাটাগরি অনুযায়ী কমিশন — প্রতিটি মান", () => {
    expect(RULES.commissionByCategory).toEqual(shared.commissionByCategory);
  });

  it("ডেলিভারি চার্জ", () => {
    expect(RULES.shipping.insideDhaka).toBe(shared.shipping.insideDhaka);
    expect(RULES.shipping.outsideDhaka).toBe(shared.shipping.outsideDhaka);
    expect(RULES.shipping.extraVendorMultiplier).toBe(
      shared.shipping.extraVendorMultiplier,
    );
    expect(RULES.shipping.freeShippingThreshold).toBe(
      shared.shipping.freeShippingThreshold,
    );
  });

  it("হোল্ড পিরিয়ড, সর্বোচ্চ সংখ্যা, পেজ সাইজ", () => {
    expect(RULES.payoutHoldDays).toBe(shared.payoutHoldDays);
    expect(RULES.maxQtyPerItem).toBe(shared.maxQtyPerItem);
    expect(RULES.pageSize).toBe(shared.pageSize);
  });
});
