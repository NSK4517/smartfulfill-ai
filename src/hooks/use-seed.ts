import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useEffect } from "react";

let seedingStarted = false;

/** Seeds the demo warehouse once per page load (idempotent — no-ops if data exists). */
export function useSeedOnMount() {
  const ensureSeeded = useMutation(api.seed.ensureSeeded);
  useEffect(() => {
    if (seedingStarted) return;
    seedingStarted = true;
    void ensureSeeded();
  }, [ensureSeeded]);
}
