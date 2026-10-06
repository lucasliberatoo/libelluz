// Lista pré-cadastrada de ENEMs antigos (tabela "Provas Antigas" do Mapa de Progresso, de 2009 a 2025).
// Chave estável gravada em exams.enemKey: "<ano>-<tipo>".

export type EnemKind = "regular" | "ppl" | "digital" | "reaplicacao";

export type EnemEntry = { key: string; year: number; kind: EnemKind; label: string };

export const ENEM_KIND_LABEL: Record<EnemKind, string> = {
  regular: "Regular",
  ppl: "PPL",
  digital: "Digital",
  reaplicacao: "Reaplicação",
};

const FIRST = 2009;
const LAST = 2025;
// PPL (Pessoas Privadas de Liberdade) a partir de 2010; ENEM Digital de 2020 a 2022.
const DIGITAL = new Set([2020, 2021, 2022]);
// Reaplicações/2ª aplicação que viraram prova própria.
const REAPLICACAO = new Set([2016, 2020, 2021, 2022, 2024]);

function build(): EnemEntry[] {
  const out: EnemEntry[] = [];
  for (let y = LAST; y >= FIRST; y--) {
    const kinds: EnemKind[] = ["regular"];
    if (y >= 2010) kinds.push("ppl");
    if (DIGITAL.has(y)) kinds.push("digital");
    if (REAPLICACAO.has(y)) kinds.push("reaplicacao");
    for (const kind of kinds) {
      out.push({
        key: `${y}-${kind}`,
        year: y,
        kind,
        label: kind === "regular" ? `ENEM ${y}` : `ENEM ${y} ${ENEM_KIND_LABEL[kind]}`,
      });
    }
  }
  return out;
}

/** Do mais recente para o mais antigo. */
export const ENEM_LIST: EnemEntry[] = build();

export const enemByKey = (key: string) => ENEM_LIST.find((e) => e.key === key);
