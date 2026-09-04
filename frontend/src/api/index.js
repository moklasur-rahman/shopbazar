/**
 * পুরো অ্যাপের একমাত্র ডেটা-দরজা।
 *
 * কম্পোনেন্ট সবসময় লিখবে:  import { api } from "../api";
 * তারপর:                     api.catalog.listProducts({ ... })
 *
 * Django রেডি হলে .env-এ VITE_USE_MOCK=false — ব্যস, এই একটা লাইনেই
 * পুরো অ্যাপ আসল ব্যাকএন্ডে চলে যাবে।
 */

import { USE_MOCK } from "../config";
import * as real from "./services";
import * as mock from "../mock/services";

const impl = USE_MOCK ? mock : real;

export const api = {
  auth: impl.authApi,
  catalog: impl.catalogApi,
  vendors: impl.vendorsApi,
  checkout: impl.checkoutApi,
  orders: impl.ordersApi,
  vendorPanel: impl.vendorPanelApi,
  admin: impl.adminApi,
};

export { ApiError, downloadFile } from "./client";
export const isMockMode = USE_MOCK;
