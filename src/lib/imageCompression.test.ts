import { describe, expect, it } from "vitest";
import { __internals } from "./imageCompression";

const { targetSize } = __internals;

describe("targetSize (compressão de imagem)", () => {
  it("não aumenta imagem pequena", () => {
    expect(targetSize(400, 300)).toEqual({ width: 400, height: 300 });
  });

  it("reduz o lado maior para 800 mantendo a proporção", () => {
    expect(targetSize(1600, 1200)).toEqual({ width: 800, height: 600 });
    expect(targetSize(1200, 1600)).toEqual({ width: 600, height: 800 });
  });

  it("trata imagem quadrada grande", () => {
    expect(targetSize(3000, 3000)).toEqual({ width: 800, height: 800 });
  });

  it("lida com dimensão zero sem quebrar", () => {
    expect(targetSize(0, 0)).toEqual({ width: 0, height: 0 });
  });
});
