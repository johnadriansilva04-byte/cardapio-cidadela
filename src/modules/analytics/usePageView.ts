import { useCallback, useEffect, useState } from "react";
import { analytics } from "./client";
import type { AnalyticsEventName, AnalyticsProps, AnalyticsStatus } from "./types";

/**
 * Registrar uma visualização de página. O `path` vem do roteador para não
 * depender de `window.location`, que no SSR não existe.
 */
export function usePageView(path: string, props?: AnalyticsProps): void {
  useEffect(() => {
    if (!path) return;
    analytics.track("page_view", { path, ...props });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
}

/** Estado de consentimento do analytics, com atualização reativa. */
export function useAnalyticsConsent() {
  const [status, setStatus] = useState<AnalyticsStatus>(() => analytics.status());

  const setEnabled = useCallback((enabled: boolean) => {
    analytics.setEnabled(enabled);
    setStatus(analytics.status());
  }, []);

  return { status, setEnabled };
}

export type { AnalyticsEventName, AnalyticsProps, AnalyticsStatus };
