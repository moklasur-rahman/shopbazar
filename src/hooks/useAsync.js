import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ডেটা আনার ছোট্ট হুক — loading / error / data তিনটাই সামলায়।
 *
 * পরে TanStack Query যোগ করতে চাইলে শুধু এই ফাইলটা বদলালেই হবে,
 * কম্পোনেন্টের কোড একই থাকবে।
 *
 * const { data, loading, error, reload } = useAsync(
 *   () => api.catalog.listProducts({ category }),
 *   [category],
 * );
 */
export function useAsync(fn, deps = [], { skip = false, initial = null } = {}) {
  const [state, setState] = useState({
    data: initial,
    loading: !skip,
    error: null,
  });

  const callbackRef = useRef(fn);
  callbackRef.current = fn;

  const requestId = useRef(0);

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await callbackRef.current();
      // পুরোনো রিকোয়েস্ট দেরিতে ফিরলে সেটা যেন নতুন ডেটা মুছে না দেয়
      if (id === requestId.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (id === requestId.current) {
        setState({ data: null, loading: false, error });
      }
    }
  }, []);

  useEffect(() => {
    if (skip) {
      setState({ data: initial, loading: false, error: null });
      return;
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, skip]);

  return { ...state, reload: run, setData: (d) => setState((s) => ({ ...s, data: d })) };
}
