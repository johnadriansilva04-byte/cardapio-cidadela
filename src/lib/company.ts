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
  /**
   * Dados exigidos para EMITIR NOTA FISCAL DE SERVIÇO (NFS-e).
   *
   * O app não emite nota hoje. Estes campos existem para (a) não se perderem
   * quando alguém for integrar um provedor de NFS-e e (b) deixar visível, em
   * `missingFiscalFields`, o que ainda falta. Preencha com o contador.
   *
   * Atenção: preencher isto NÃO habilita emissão — o enquadramento fiscal
   * (MEI com CNAE de vestuário) precisa comportar venda de software. Ver
   * `AGENTS.md` → "Identidade legal e fiscal".
   */
  fiscal: {
    /** Logradouro (rua/avenida). */
    street: "",
    /** Número. Use "S/N" quando não houver. */
    number: "",
    /** Complemento (sala, bloco) — opcional. */
    complement: "",
    /** Bairro. */
    district: "",
    /** CEP, só dígitos (ex.: "88000000"). */
    zip: "",
    /** Código IBGE do município (Florianópolis = 4205407). */
    municipalityCode: "",
    /** Inscrição municipal do prestador (emitida pela prefeitura). */
    municipalRegistration: "",
    /** CNAE principal do serviço prestado (ex.: "6201-5/01"). */
    cnae: "",
    /** Item da lista da LC 116/2003 (ex.: "1.05" para licenciamento de software). */
    serviceItem: "",
    /** Alíquota do ISS em % (ex.: 2). */
    issRate: "",
    /** E-mail que recebe as notas emitidas. */
    email: "",
  },
} as const;

/** Nomes amigáveis dos campos fiscais, para a UI e a mensagem de pendência. */
const FISCAL_FIELD_LABELS: Record<keyof typeof COMPANY.fiscal, string> = {
  street: "logradouro",
  number: "número",
  complement: "complemento",
  district: "bairro",
  zip: "CEP",
  municipalityCode: "código do município (IBGE)",
  municipalRegistration: "inscrição municipal",
  cnae: "CNAE do serviço",
  serviceItem: "item da lista LC 116",
  issRate: "alíquota do ISS",
  email: "e-mail para notas",
};

/** Verdadeiro quando há ao menos um canal de suporte configurado. */
export const hasSupportContact = Boolean(COMPANY.supportEmail || COMPANY.supportPhone);

/**
 * Campos fiscais obrigatórios que ainda estão vazios.
 *
 * `complement` é opcional e não entra. Enquanto a lista não estiver vazia, não
 * há como emitir NFS-e — a UI deve dizer o que falta em vez de deixar o dono
 * descobrir na hora de faturar.
 */
export const missingFiscalFields: string[] = (
  Object.keys(FISCAL_FIELD_LABELS) as (keyof typeof COMPANY.fiscal)[]
).filter((key) => key !== "complement" && !COMPANY.fiscal[key]);

/** Verdadeiro quando os dados fiscais estão completos (ainda não emite nota). */
export const hasFiscalData = missingFiscalFields.length === 0;

/** Linha de identificação legal usada em rodapés: "Razão social · CNPJ". */
export const COMPANY_LEGAL_LINE = `${COMPANY.legalName} · CNPJ ${COMPANY.cnpj}`;
