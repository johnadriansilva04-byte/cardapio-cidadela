import { describe, expect, it } from "vitest";
import { buildVisionBody } from "@/api/lib/ai";

describe("buildVisionBody", () => {
  it("põe a imagem DENTRO de messages como image_url", () => {
    const body = buildVisionBody("leia isso", "data:image/png;base64,AAA", 1500);
    expect(body.max_tokens).toBe(1500);
    expect(body.messages).toHaveLength(1);
    const [msg] = body.messages;
    expect(msg.role).toBe("user");
    expect(Array.isArray(msg.content)).toBe(true);
    // o formato que a API aceita: texto + image_url no content
    expect(msg.content[0]).toEqual({ type: "text", text: "leia isso" });
    expect(msg.content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,AAA" },
    });
  });

  it("não usa o campo de topo `image` (formato que a API rejeita com 3030)", () => {
    const body = buildVisionBody("x", "data:image/png;base64,AAA", 10) as Record<string, unknown>;
    expect(body).not.toHaveProperty("image");
  });
});
