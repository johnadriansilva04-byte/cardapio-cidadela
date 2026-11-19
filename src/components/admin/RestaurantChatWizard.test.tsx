import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { RestaurantChatWizard } from "@/components/admin/RestaurantChatWizard";
import { buildInitialFormValues } from "@/components/admin/restaurantForm";
import type { RestaurantFormValues } from "@/components/admin/restaurantForm";
import type { DraftNeighborhood } from "@/lib/restaurantChat";

vi.mock("@/lib/neighborhoodLookup", () => ({
  searchNeighborhoodsByCity: vi.fn(async () => ({
    city: { cityName: "Florianópolis", stateCode: "SC", osmId: 1, lat: 0, lon: 0 },
    neighborhoods: ["Centro", "Trindade"],
  })),
}));

/**
 * Harness que guarda o formulário de verdade: cada resposta do chat precisa
 * aparecer no objeto que o diálogo salvaria.
 */
function Harness({ onFinish = vi.fn() }: { onFinish?: () => void }) {
  const [form, setForm] = useState<RestaurantFormValues>(() => buildInitialFormValues(null));
  const [neighborhoods, setNeighborhoods] = useState<DraftNeighborhood[]>([]);
  return (
    <div>
      <RestaurantChatWizard
        form={form}
        onPatch={(part) => setForm((s) => ({ ...s, ...part }))}
        onFinish={onFinish}
        onSwitchToForm={vi.fn()}
        neighborhoods={neighborhoods}
        onNeighborhoodsChange={setNeighborhoods}
      />
      <pre data-testid="form-json">{JSON.stringify(form)}</pre>
      <pre data-testid="hoods-json">{JSON.stringify(neighborhoods)}</pre>
    </div>
  );
}

function formJson(): RestaurantFormValues {
  return JSON.parse(screen.getByTestId("form-json").textContent ?? "{}");
}
function hoodsJson(): DraftNeighborhood[] {
  return JSON.parse(screen.getByTestId("hoods-json").textContent ?? "[]");
}

/** Responde o passo de texto atual e envia. */
async function answer(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByRole("textbox"), text);
  await user.click(screen.getByRole("button", { name: /enviar resposta/i }));
}
async function skip(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^pular$/i }));
}

describe("RestaurantChatWizard", () => {
  it("pergunta o nome primeiro e avança ao responder", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByText(/qual é o nome do seu restaurante/i)).toBeInTheDocument();
    await answer(user, "Cantina da Pracinha");

    expect(formJson().name).toBe("Cantina da Pracinha");
    expect(await screen.findByText(/slogan ou uma descrição/i)).toBeInTheDocument();
  });

  it("normaliza o WhatsApp ao responder", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await answer(user, "Cantina");
    await skip(user);
    expect(await screen.findByText(/qual whatsapp vai receber/i)).toBeInTheDocument();
    await answer(user, "(48) 99999-9999");

    expect(formJson().whatsapp).toBe("5548999999999");
  });

  it("mostra erro e não avança com telefone inválido", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await answer(user, "Cantina");
    await skip(user);
    await screen.findByText(/qual whatsapp vai receber/i);
    await answer(user, "abc");

    expect(await screen.findByText(/telefone inválido/i)).toBeInTheDocument();
    expect(formJson().whatsapp).toBe("");
  });

  it('aceita "não" no telefone opcional sem acusar telefone inválido', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await answer(user, "Cantina");
    await skip(user);
    await screen.findByText(/qual whatsapp vai receber/i);
    await answer(user, "48999880030");
    expect(formJson().whatsapp).toBe("5548999880030");

    await screen.findByText(/telefone fixo de contato/i);
    await answer(user, "não");

    expect(screen.queryByText(/telefone inválido/i)).not.toBeInTheDocument();
    expect(formJson().phone).toBe("");
    expect(await screen.findByText(/onde você fica/i)).toBeInTheDocument();
  });

  it("busca os bairros da cidade, deixa marcar e define a taxa", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await answer(user, "Cantina");
    await skip(user); // slogan
    await answer(user, "48999880030");
    await skip(user); // telefone
    await skip(user); // endereço

    await screen.findByText(/de quais bairros você entrega/i);
    await answer(user, "Florianópolis SC");

    // A busca traz os bairros e já marca todos.
    expect(await screen.findByText(/2 bairros em Florianópolis/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/taxa de entrega para centro/i), "5");
    // Desmarca Trindade: só o Centro deve entrar.
    await user.click(screen.getByRole("button", { name: /trindade/i }));
    await user.click(screen.getByRole("button", { name: /usar 1 bairro/i }));

    const hoods = hoodsJson();
    expect(hoods).toEqual([{ name: "Centro", fee: "5.00" }]);
    expect(await screen.findByText(/qual sua chave pix/i)).toBeInTheDocument();
  });

  it("cai no modo manual quando a busca não devolve bairros", async () => {
    const lookup = await import("@/lib/neighborhoodLookup");
    vi.mocked(lookup.searchNeighborhoodsByCity).mockResolvedValueOnce({
      city: { cityName: "Florianópolis", stateCode: "SC", osmId: 1, lat: 0, lon: 0 },
      neighborhoods: [],
    });

    const user = userEvent.setup();
    render(<Harness />);

    await answer(user, "Cantina");
    await skip(user); // slogan
    await answer(user, "48999880030");
    await skip(user); // telefone
    await skip(user); // endereço

    await screen.findByText(/de quais bairros você entrega/i);
    await answer(user, "Florianópolis SC");

    // Sem lista automática a tela não trava: ela pede os bairros por escrito.
    expect(await screen.findByText(/não encontrei a lista de bairros/i)).toBeInTheDocument();
    expect(screen.getByText(/escreva os bairros que você atende/i)).toBeInTheDocument();

    await answer(user, "Centro 5\nTrindade 8,50");
    expect(hoodsJson()).toEqual([
      { name: "Centro", fee: "5.00" },
      { name: "Trindade", fee: "8.50" },
    ]);
    // A taxa padrão passa a ser a maior das informadas (bairro fora da lista).
    expect(formJson().delivery_fee).toBe("8.50");
    expect(await screen.findByText(/qual sua chave pix/i)).toBeInTheDocument();
  });

  it("cai no modo manual quando a busca automática falha", async () => {
    const lookup = await import("@/lib/neighborhoodLookup");
    vi.mocked(lookup.searchNeighborhoodsByCity).mockRejectedValueOnce(new Error("offline"));

    const user = userEvent.setup();
    render(<Harness />);

    await answer(user, "Cantina");
    await skip(user);
    await answer(user, "48999880030");
    await skip(user);
    await skip(user);

    await screen.findByText(/de quais bairros você entrega/i);
    await answer(user, "Florianópolis");

    expect(await screen.findByText(/busca automática está fora do ar/i)).toBeInTheDocument();
    await answer(user, "Centro");
    expect(hoodsJson()).toEqual([{ name: "Centro", fee: "" }]);
  });

  it("a escolha de tema preenche as duas cores e a revisão mostra o resumo", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<Harness onFinish={onFinish} />);

    await answer(user, "Cantina");
    await skip(user);
    await answer(user, "48999999999");
    await skip(user);
    await skip(user);
    // Bairros: busca a cidade, marca um e conclui.
    await screen.findByText(/de quais bairros você entrega/i);
    await answer(user, "Florianópolis SC");
    await screen.findByText(/2 bairros em Florianópolis/i);
    await user.type(screen.getByLabelText(/taxa de entrega para centro/i), "5");
    await user.click(screen.getByRole("button", { name: /trindade/i }));
    await user.click(screen.getByRole("button", { name: /usar 1 bairro/i }));
    // PIX: pula.
    await screen.findByText(/qual sua chave pix/i);
    await skip(user);
    // Horário e tema.
    await user.click(await screen.findByRole("button", { name: /todos os dias, 17h/i }));
    await user.click(await screen.findByRole("button", { name: /laranja e vermelho/i }));

    const json = formJson();
    expect(json.primary_color).toBe("#f97316");
    expect(json.secondary_color).toBe("#ef4444");
    expect(json.operating_hours.seg).toEqual({ closed: false, open: "17:00", close: "00:00" });

    expect(await screen.findByText(/tudo pronto/i)).toBeInTheDocument();
    expect(screen.getByText(/Centro \(R\$ 5\.00\)/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /criar cardápio/i }));
    expect(onFinish).toHaveBeenCalledOnce();
  });
});
