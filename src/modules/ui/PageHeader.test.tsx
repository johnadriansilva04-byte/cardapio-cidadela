import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StoreStatusBadge } from "@/modules/ui/PageHeader";

describe("StoreStatusBadge", () => {
  it("sinaliza a loja aberta", () => {
    render(<StoreStatusBadge open />);
    expect(screen.getByText("Aberto agora")).toBeInTheDocument();
  });

  it("sinaliza a loja fechada", () => {
    render(<StoreStatusBadge open={false} />);
    expect(screen.getByText("Fechado agora")).toBeInTheDocument();
  });

  it("acrescenta o complemento de horário quando informado", () => {
    render(<StoreStatusBadge open hint="fecha às 22h" />);
    expect(screen.getByText(/fecha às 22h/)).toBeInTheDocument();
  });
});
