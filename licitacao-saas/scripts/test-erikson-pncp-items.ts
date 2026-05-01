import assert from "node:assert/strict";
import { __testing } from "../src/lib/pncp/search";

const licitacaoMaterialLimpeza = {
  numeroControlePNCP: "12345678000199-1-42/2026",
  anoCompra: 2026,
  sequencialCompra: 42,
  objetoCompra: "Aquisição de materiais de limpeza",
  valorTotalEstimado: 1000,
  modalidadeNome: "Pregão Eletrônico",
  situacaoCompraId: 1,
  situacaoCompraNome: "Divulgada no PNCP",
  dataPublicacaoPncp: "2026-04-29",
  dataEncerramentoProposta: "2026-05-20",
  linkSistemaOrigem: null,
  srp: false,
  orgaoEntidade: { cnpj: "12345678000199", razaoSocial: "Município Exemplo" },
  unidadeOrgao: { ufSigla: "SP", municipioNome: "São Paulo", nomeUnidade: "Compras" },
  informacaoComplementar: "",
};

assert.equal(
  __testing.matchKeyword(licitacaoMaterialLimpeza, "papel"),
  false,
  "pré-condição Erikson: palavra 'papel' não aparece nos campos principais"
);

assert.equal(
  __testing.matchKeywordInPncpItens(
    [
      { numeroItem: 1, descricao: "Detergente neutro 500ml" },
      { numeroItem: 2, descricao: "Papel higiênico folha dupla 30m" },
    ],
    "papel"
  ),
  true,
  "deve aprovar keyword quando o termo aparece apenas nos itens internos PNCP"
);

assert.equal(
  __testing.matchKeywordInPncpItens(
    [{ numeroItem: 1, descricao: "Sabonete líquido" }],
    "papel"
  ),
  false,
  "não deve aprovar quando nem campos principais nem itens contêm a keyword"
);

assert.deepEqual(
  __testing.parsePncpCompraRef(licitacaoMaterialLimpeza),
  { cnpj: "12345678000199", ano: "2026", sequencial: "42" },
  "deve montar referência da compra PNCP para consultar /itens"
);

console.log("OK: validação Erikson PNCP itens passou");
