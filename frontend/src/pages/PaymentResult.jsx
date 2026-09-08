/**
 * গেটওয়ে থেকে ফেরার পর যে পাতাটা দেখা যায়।
 *
 * ⚠️ URL-এ কী লেখা আছে তার উপর ভরসা করা হয় না।
 *
 * SSLCommerz ক্রেতাকে /payment/success/... এ ফেরত পাঠায়, কিন্তু ওই
 * ঠিকানাটা ক্রেতা নিজেও ব্রাউজারে টাইপ করে ফেলতে পারেন। তাই পাতাটা
 * খুলেই সার্ভারকে জিজ্ঞাসা করে — "এই অর্ডারের টাকা সত্যিই এসেছে?"
 * আর সার্ভারের উত্তরটাই দেখায়।
 *
 * URL-এর অংশটা শুধু প্রথম বার্তাটা বেছে নিতে ব্যবহার হয়, আর সেটা
 * সার্ভারের উত্তর আসার সাথে সাথেই বদলে যায়।
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, XCircle, Clock, RefreshCw, ArrowRight } from "lucide-react";

import { api } from "../api";
import { Button, Card, Spinner } from "../components/ui";
import { useToast } from "../store/ToastContext";
import { money, toBnDigits } from "../lib/format";

/** গেটওয়ে যেখান থেকে ফেরত পাঠাতে পারে */
const OUTCOMES = {
  success: { title: "পেমেন্ট যাচাই করা হচ্ছে…", tone: "wait" },
  pending: { title: "পেমেন্ট যাচাই করা হচ্ছে…", tone: "wait" },
  failed: { title: "পেমেন্ট হয়নি", tone: "bad" },
  cancelled: { title: "পেমেন্ট বাতিল করা হয়েছে", tone: "bad" },
};

export default function PaymentResult() {
  const { outcome = "pending", number } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const check = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.payments.status(number));
    } catch (err) {
      setError(err.message || "অবস্থা জানা গেল না");
    } finally {
      setLoading(false);
    }
  }, [number]);

  useEffect(() => {
    check();
  }, [check]);

  /**
   * IPN আসতে কয়েক সেকেন্ড দেরি হতে পারে — ক্রেতা ফিরে আসার সময়
   * সার্ভার এখনো "pending" দেখাতে পারে। তাই কয়েকবার নিজে থেকে
   * আবার দেখা হয়, তারপর থেমে যায় (অনন্তকাল পোল করা হয় না)।
   */
  const [tries, setTries] = useState(0);
  const stillWaiting =
    data && data.paymentStatus === "pending" && outcome === "success" && tries < 5;

  useEffect(() => {
    if (!stillWaiting) return;
    const timer = setTimeout(() => {
      setTries((n) => n + 1);
      check();
    }, 3000);
    return () => clearTimeout(timer);
  }, [stillWaiting, check]);

  async function retry() {
    try {
      const { gatewayUrl } = await api.payments.start(number);
      window.location.href = gatewayUrl;
    } catch (err) {
      toast.error(err.message || "পেমেন্ট পাতা খোলা গেল না");
    }
  }

  if (loading && !data) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4">
        <div className="text-center">
          <Spinner size={30} />
          <p className="mt-3 text-[14px] text-muted">পেমেন্টের অবস্থা দেখা হচ্ছে…</p>
        </div>
      </div>
    );
  }

  // সার্ভারের উত্তরই চূড়ান্ত — URL-এর outcome নয়
  const paid = data?.paymentStatus === "paid";
  const waiting = !paid && stillWaiting;
  const fallback = OUTCOMES[outcome] ?? OUTCOMES.pending;

  const view = paid
    ? {
        icon: CheckCircle2,
        ring: "bg-brand-50 text-brand-600",
        title: "পেমেন্ট সফল হয়েছে",
        body: "টাকা পৌঁছেছে। আপনার অর্ডার প্রস্তুত করা শুরু হয়েছে।",
      }
    : waiting
      ? {
          icon: Clock,
          ring: "bg-amber-50 text-amber-600",
          title: "পেমেন্ট যাচাই করা হচ্ছে…",
          body: "ব্যাংক থেকে নিশ্চিত বার্তা আসতে কয়েক সেকেন্ড লাগতে পারে। পাতাটি খোলা রাখুন।",
        }
      : {
          icon: XCircle,
          ring: "bg-red-50 text-red-600",
          title: fallback.title,
          body:
            data?.transactions?.[0]?.errorReason ||
            "টাকা কাটা হয়নি। আবার চেষ্টা করতে পারেন — অর্ডারটি জমা আছে।",
        };

  const Icon = view.icon;

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <Card className="p-7 text-center">
        <span className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${view.ring}`}>
          {waiting ? <Spinner size={26} /> : <Icon size={30} />}
        </span>

        <h1 className="mt-4 font-display text-xl font-semibold text-ink">{view.title}</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{view.body}</p>

        {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

        {data && (
          <dl className="mt-5 space-y-2 rounded-xl bg-canvas p-4 text-left text-[13.5px]">
            <div className="flex justify-between">
              <dt className="text-muted">অর্ডার</dt>
              <dd className="font-medium text-ink">{data.orderNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">মোট</dt>
              <dd className="tnum font-medium text-ink">{money(data.grandTotal)}</dd>
            </div>
            {data.transactions?.[0]?.cardType && (
              <div className="flex justify-between">
                <dt className="text-muted">মাধ্যম</dt>
                <dd className="text-ink">{data.transactions[0].cardType}</dd>
              </div>
            )}
            {tries > 0 && !paid && (
              <div className="flex justify-between">
                <dt className="text-muted">যাচাইয়ের চেষ্টা</dt>
                <dd className="tnum text-ink">{toBnDigits(tries)}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          {paid ? (
            <Button onClick={() => navigate(`/orders/${number}`)}>
              অর্ডার দেখুন <ArrowRight size={16} />
            </Button>
          ) : (
            <>
              {!waiting && (
                <Button onClick={retry}>
                  <RefreshCw size={16} /> আবার চেষ্টা করুন
                </Button>
              )}
              <Button variant="outline" onClick={check} disabled={loading}>
                অবস্থা আবার দেখুন
              </Button>
            </>
          )}
          <Button as={Link} to="/orders" variant="ghost">
            সব অর্ডার
          </Button>
        </div>
      </Card>
    </div>
  );
}
