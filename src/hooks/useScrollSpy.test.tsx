import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScrollSpy } from "./useScrollSpy";

type Callback = (entries: Array<Partial<IntersectionObserverEntry>>) => void;

let callbacks: Callback[] = [];
let observed: Element[] = [];

class MockObserver {
  private cb: Callback;
  constructor(cb: Callback) {
    this.cb = cb;
    callbacks.push(cb);
  }
  observe(el: Element) {
    observed.push(el);
  }
  disconnect() {
    observed = [];
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
}

function emit(id: string, ratio: number, isIntersecting = ratio > 0) {
  for (const cb of callbacks) {
    cb([{ target: { id } as Element, intersectionRatio: ratio, isIntersecting }]);
  }
}

describe("useScrollSpy", () => {
  beforeEach(() => {
    callbacks = [];
    observed = [];
    vi.stubGlobal("IntersectionObserver", MockObserver);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mountSection(id: string) {
    const el = document.createElement("section");
    el.id = id;
    document.body.appendChild(el);
    return el;
  }

  it("não registra observer quando desabilitado", () => {
    mountSection("cat-a");
    const onChange = vi.fn();
    renderHook(() => useScrollSpy({ ids: ["a"], onChange, enabled: false }));
    expect(callbacks).toHaveLength(0);
  });

  it("ignora ids sem elemento correspondente no DOM", () => {
    const onChange = vi.fn();
    renderHook(() => useScrollSpy({ ids: ["a", "b"], onChange }));
    expect(observed).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("avisa a seção com maior fração visível, sem o prefixo cat-", () => {
    mountSection("cat-a");
    mountSection("cat-b");
    const onChange = vi.fn();
    renderHook(() => useScrollSpy({ ids: ["a", "b"], onChange }));

    emit("cat-b", 0.8);
    expect(onChange).toHaveBeenLastCalledWith("b");

    emit("cat-a", 0.9);
    expect(onChange).toHaveBeenLastCalledWith("a");
  });

  it("não anuncia nada quando nenhuma seção está visível", () => {
    mountSection("cat-a");
    const onChange = vi.fn();
    renderHook(() => useScrollSpy({ ids: ["a"], onChange }));

    emit("cat-a", 1);
    expect(onChange).toHaveBeenCalledWith("a");

    onChange.mockClear();
    emit("cat-a", 0, false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("desconecta o observer ao desmontar", () => {
    mountSection("cat-a");
    const disconnect = vi.spyOn(MockObserver.prototype, "disconnect");
    const { unmount } = renderHook(() => useScrollSpy({ ids: ["a"], onChange: vi.fn() }));
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});