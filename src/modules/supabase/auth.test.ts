import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const profileEq = vi.fn(async () => ({ error: null }));
  const profileUpdate = vi.fn(() => ({ eq: profileEq }));
  const upload = vi.fn(async () => ({ error: null }));
  const getPublicUrl = vi.fn(() => ({
    data: { publicUrl: "https://cdn.test/avatars/u1/avatar_1.png" },
  }));
  const storageFrom = vi.fn(() => ({ upload, getPublicUrl }));
  return {
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    updateUser: vi.fn(),
    profileUpdate,
    profileEq,
    from: vi.fn(() => ({ update: profileUpdate })),
    upload,
    getPublicUrl,
    storageFrom,
  };
});

vi.mock("./client", () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      signInWithPassword: mocks.signInWithPassword,
      updateUser: mocks.updateUser,
    },
    from: mocks.from,
    storage: { from: mocks.storageFrom },
  },
}));

import { updateProfileAvatar, updateProfilePhone } from "./auth";

function signedInUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    user_metadata: { phone: "11999998888", display_phone: "(11) 99999-8888" },
    ...overrides,
  };
}

describe("updateProfilePhone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: signedInUser() } });
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    mocks.updateUser.mockResolvedValue({ data: { user: { new_email: null } }, error: null });
    mocks.profileEq.mockResolvedValue({ error: null });
  });

  it("exige telefone com DDD", async () => {
    const result = await updateProfilePhone("1199", "senha123");
    expect(result).toEqual({ ok: false, error: "Informe um telefone válido com DDD." });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("exige a senha atual", async () => {
    const result = await updateProfilePhone("11988887777", "");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/senha/i);
  });

  it("recusa quando não há usuário autenticado", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const result = await updateProfilePhone("11988887777", "senha123");
    expect(result.ok).toBe(false);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("avisa quando o telefone é o mesmo", async () => {
    const result = await updateProfilePhone("(11) 99999-8888", "senha123");
    expect(result).toEqual({ ok: false, error: "Este já é o seu telefone." });
  });

  it("rejeita senha incorreta antes de trocar o acesso", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: "Invalid login credentials" },
    });
    const result = await updateProfilePhone("11988887777", "errada");
    expect(result).toEqual({ ok: false, error: "Senha incorreta." });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("troca o telefone mapeando para o pseudo-email e atualiza o perfil", async () => {
    const result = await updateProfilePhone("(11) 98888-7777", "senha123");

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "11999998888@menufacil.local",
      password: "senha123",
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      email: "11988887777@menufacil.local",
      data: { phone: "11988887777", display_phone: "(11) 98888-7777" },
    });
    expect(mocks.profileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "11988887777" }),
    );
    expect(mocks.profileEq).toHaveBeenCalledWith("id", "u1");
    expect(result).toEqual({ ok: true, pending: false });
  });

  it("sinaliza confirmação pendente quando o Supabase devolve new_email", async () => {
    mocks.updateUser.mockResolvedValue({
      data: { user: { new_email: "11988887777@menufacil.local" } },
      error: null,
    });
    const result = await updateProfilePhone("11988887777", "senha123");
    expect(result).toEqual({ ok: true, pending: true });
  });

  it("não falha o login quando a atualização do perfil dá erro", async () => {
    mocks.profileEq.mockResolvedValue({ error: { message: "rls" } });
    const result = await updateProfilePhone("11988887777", "senha123");
    expect(result).toEqual({ ok: true, pending: false });
  });
});

describe("updateProfileAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: signedInUser() } });
    mocks.profileEq.mockResolvedValue({ error: null });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
  });

  function png(name = "foto.png", size = 1024) {
    return new File([new Uint8Array(size)], name, { type: "image/png" });
  }

  it("recusa quando não há usuário autenticado", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const res = await updateProfileAvatar(png());
    expect(res.ok).toBe(false);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("recusa formato não permitido", async () => {
    const gif = new File([new Uint8Array(10)], "x.gif", { type: "image/gif" });
    const res = await updateProfileAvatar(gif);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/formato/i);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("recusa arquivo acima de 5 MB", async () => {
    const res = await updateProfileAvatar(png("grande.png", 5 * 1024 * 1024 + 1));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/grande/i);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("envia na pasta do usuário e grava a URL no perfil", async () => {
    const res = await updateProfileAvatar(png());
    expect(res.ok).toBe(true);
    expect(res.url).toBe("https://cdn.test/avatars/u1/avatar_1.png");
    const [path] = mocks.upload.mock.calls[0];
    expect(path.startsWith("u1/avatar_")).toBe(true);
    expect(path.endsWith(".png")).toBe(true);
    expect(mocks.profileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: "https://cdn.test/avatars/u1/avatar_1.png" }),
    );
    expect(mocks.profileEq).toHaveBeenCalledWith("id", "u1");
  });

  it("propaga erro de upload sem gravar o perfil", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "rls" } });
    const res = await updateProfileAvatar(png());
    expect(res.ok).toBe(false);
    expect(mocks.profileUpdate).not.toHaveBeenCalled();
  });
});
