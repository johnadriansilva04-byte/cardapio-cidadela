import { describe, expect, it } from "vitest";
import { buildVisionBody, extractAiText } from "@/api/lib/ai";

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

describe("extractAiText", () => {
  it("aceita `response` como string (prosa)", () => {
    expect(extractAiText({ response: "  Pong!  " })).toBe("Pong!");
  });

  it("serializa `response` que já vem como OBJETO (bug do llama-3.1-8b-fast-v2)", () => {
    // O modelo devolve o JSON já parseado. Antes só string era aceita, então
    // toda resposta JSON era descartada e a IA parecia desligada.
    const parsed = { lines: [{ product_id: "p1", quantity: 2 }] };
    const text = extractAiText({ response: parsed });
    expect(text).not.toBeNull();
    expect(JSON.parse(text as string)).toEqual(parsed);
  });

  it("cai para o formato OpenAI `choices[0].message.content`", () => {
    const r = { choices: [{ message: { content: '{"lines":[]}' } }] };
    expect(extractAiText(r)).toBe('{"lines":[]}');
  });

  it("devolve null quando não há texto utilizável", () => {
    expect(extractAiText(null)).toBeNull();
    expect(extractAiText({})).toBeNull();
    expect(extractAiText({ response: "" })).toBeNull();
    expect(extractAiText({ response: 42 })).toBeNull();
  });
});
