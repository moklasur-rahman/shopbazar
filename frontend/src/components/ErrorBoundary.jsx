import { Component } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

const RELOAD_KEY = "sb.chunk-reload-at";

/** এত সেকেন্ডের মধ্যে দ্বিতীয়বার রিলোড নয় */
const RELOAD_COOLDOWN_MS = 15_000;

/**
 * এখন রিলোড করা যাবে কি না।
 *
 * শেষ কবে রিলোড করেছি সেটা সময় হিসেবে রাখা হয় — শুধু "করেছি কি না"
 * নয়। কারণ রিলোডের পরেও যদি একই এরর আসে (মানে আসলেই কোড ভাঙা),
 * তখন যেন অসীম রিলোডের ফাঁদে না পড়ে। "একবার হয়েছে" ধরনের পতাকা এই
 * কাজটা করতে পারে না — রিলোডের পর সেটা মুছতেই হয়, আর মুছে দিলেই
 * পরের এররে আবার রিলোড হয়ে লুপ তৈরি হয়।
 */
function shouldReload() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    return true;
  } catch {
    // প্রাইভেট মোডে sessionStorage বন্ধ থাকতে পারে। তখন লুপ ঠেকানোর
    // উপায় নেই, তাই রিলোডও করা হয় না — ব্যবহারকারী নিজে বোতাম চাপবেন।
    return false;
  }
}

/**
 * এররটা কি পুরোনো বিল্ডের চাংক না পাওয়ার কারণে?
 *
 * ব্রাউজারভেদে বার্তা আলাদা — Chrome বলে "Failed to fetch dynamically
 * imported module", Firefox বলে "error loading dynamically imported
 * module", Safari বলে "Importing a module script failed"।
 */
function isStaleChunkError(error) {
  const text = `${error?.name ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return (
    text.includes("dynamically imported module") ||
    text.includes("importing a module script failed") ||
    text.includes("failed to fetch dynamically")
  );
}

/**
 * রেন্ডারের সময় কোনো কম্পোনেন্ট এরর দিলে পুরো অ্যাপ সাদা স্ক্রিন হয়ে যায় —
 * ব্যবহারকারী বুঝতেই পারেন না কী হলো। এই বাউন্ডারি সেটা ধরে একটা
 * পড়ার মতো বার্তা দেখায়।
 *
 * React-এ এটা এখনো ক্লাস কম্পোনেন্ট হতেই হয় — componentDidCatch এর
 * কোনো হুক সংস্করণ নেই।
 *
 * ⚠️ ইভেন্ট হ্যান্ডলার বা async কোডের এরর এটা ধরে না — সেগুলোর জন্য
 * try/catch আর toast ব্যবহার করা হয়েছে।
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // লাইভে এখানে Sentry বা অন্য কোনো সার্ভিসে পাঠানো হবে
    console.error("ধরা পড়া এরর:", error, info?.componentStack);

    // নতুন বিল্ড দেওয়ার পর খোলা থাকা ট্যাব পুরোনো নামের চাংক খোঁজে,
    // সেটা আর সার্ভারে নেই — তখন এই এররটা আসে। ব্যবহারকারীর দোষ নেই,
    // আর একবার রিলোড করলেই ঠিক হয়ে যায়। তাই নিজে থেকেই করে দেওয়া হয়।
    if (isStaleChunkError(error) && shouldReload()) {
      window.location.reload();
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <div className="grid min-h-screen place-items-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 text-center shadow-soft">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
            <AlertTriangle size={26} />
          </span>

          <h1 className="mt-4 font-display text-xl font-semibold text-ink">
            কিছু একটা ভুল হয়েছে
          </h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
            পাতাটি দেখাতে সমস্যা হচ্ছে। আবার চেষ্টা করুন — না হলে হোমে ফিরে যান।
          </p>

          {isDev && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-ink p-3 text-left text-[11.5px] leading-relaxed text-red-300">
              {error.message}
            </pre>
          )}

          <div className="mt-5 flex justify-center gap-2.5">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              <RefreshCw size={16} /> আবার চেষ্টা করুন
            </button>
            <a
              href="/"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-line-2 bg-white px-5 text-sm font-medium text-ink transition hover:border-brand-400"
            >
              <Home size={16} /> হোম
            </a>
          </div>
        </div>
      </div>
    );
  }
}
