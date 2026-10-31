/**
 * Dados legais do fornecedor do serviço — fonte única.
 *
 * Aparecem nos Termos de Uso, na Política de Privacidade, no rodapé da landing
 * e no "Sobre o aplicativo". Mudar de CNPJ/razão social é um lugar só.
 *
 * Dados verificados na Receita Federal (BrasilAPI) em 2026-10-31:
 * situação ATIVA, MEI, Florianópolis/SC.
 */
export const COMPANY = {
  /** Razão social registrada (MEI usa o nome do titular). */
  legalName: "65.025.130 JOHN ADRIAN DA SILVA DO ROSARIO",
  /** Marca exibida ao usuário. O CNPJ não tem nome fantasia registrado. */
  brandName: "Cardápio Cidadela",
  /** CNPJ formatado. */
  cnpj: "65.025.130/0001-24",
  /** Só os dígitos (comparações/validações). */
  cnpjDigits: "65025130000124",
  city: "Florianópolis",
  state: "SC",
  /** Regime tributário — relevante para o que pode ser faturado. */
  taxRegime: "MEI (Microempreendedor Individual)",
  /**
   * Canal de suporte exibido ao cliente.
   *
   * TODO: preencher com um e-mail real e um telefone/WhatsApp de atendimento.
   * Enquanto estiver vazio, as telas omitem o canal em vez de mostrar um dado
   * falso — mas vender sem canal de suporte é vender sem suporte.
   */
  supportEmail: "",
  /** Telefone/WhatsApp de suporte, só dígitos com DDI (ex.: "5548999999999"). */
  supportPhone: "",
} as const;

/** Verdadeiro quando há ao menos um canal de suporte configurado. */
export const hasSupportContact = Boolean(COMPANY.supportEmail || COMPANY.supportPhone);

/** Linha de identificação legal usada em rodapés: "Razão social · CNPJ". */
export const COMPANY_LEGAL_LINE = `${COMPANY.legalName} · CNPJ ${COMPANY.cnpj}`;
