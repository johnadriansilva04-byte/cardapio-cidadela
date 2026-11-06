import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { reportError, isThirdPartyBridgeNoise } from "./reportError";

// Erro real capturado em produção (protocolo CID-20261105-2Z5AZJ), disparado
// pela bridge do Instagram no Android quando a aba é fechada no meio da
// navegação. Não é do app.
const PROD_MESSAGE = "Error invoking postMessage: Java object is gone";
const PROD_STACK = [
  "Error: Error invoking postMessage: Java object is gone",
  "    at sendDataToNative (iabjs://navigation_performance_logger_android:1:11722)",
  "    at sendBeforeUnloadMessage (iabjs://navigation_performance_logger_android:1:15376)",
].join("\n");

describe("isThirdPartyBridgeNoise", () => {
  it("reconhece o erro da bridge do Instagram pelo stack (produção)", () => {
    const err = new Error(PROD_MESSAGE);
    err.stack = PROD_STACK;
    expect(isThirdPartyBridgeNoise(err)).toBe(true);
  });

  it("reconhece pela mensagem quando não há stack", () => {
    expect(isThirdPartyBridgeNoise(PROD_MESSAGE)).toBe(true);
  });

  it("reconhece o marcador iabjs:// isolado", () => {
    expect(isThirdPartyBridgeNoise("at x (iabjs://navigation:1:1)")).toBe(true);
  });

  it("não filtra um erro real do app", () => {
    const err = new Error("Cannot read properties of undefined (reading 'map')");
    err.stack = "Error: ... at Cardapio (src/components/cardapio/Cardapio.tsx:120:5)";
    expect(isThirdPartyBridgeNoise(err)).toBe(false);
  });
});

describe("reportError", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("não reporta o ruído da bridge in-app (evita caso urgente falso)", () => {
    const err = new Error(PROD_MESSAGE);
    err.stack = PROD_STACK;
    reportError(err, { component: "window.onerror" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reporta um erro real do app para /api/support/error", () => {
    reportError(new Error("falha real no cardápio"), { component: "ErrorBoundary" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/support/error");
    expect(JSON.parse(init.body).message).toBe("falha real no cardápio");
  });
});
