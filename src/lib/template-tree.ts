// Árvore inicial pré-carregada (editável por cada pessoa).
// Base: checklist do Mapa de Progresso Competitivo (fases, habilidades e relevância), com as
// habilidades reescritas em frases curtas, mais tópicos e habilidades do ENEM que faltavam.
// Os NOMES de áreas, disciplinas e tópicos que já existiam não podem mudar: o backfill
// (enrichTree) e as sessões de foco casam por nome.

export type Area = "Matemática" | "Natureza" | "Linguagens" | "Humanas" | "Redação";

export const PHASES = ["Nivelamento", "Básico I", "Básico II", "Construção", "Ataque"] as const;
export type Phase = (typeof PHASES)[number];
export const PHASE_INFO: Record<Phase, { short: string; level: string }> = {
  Nivelamento: { short: "Nivel.", level: "Novato" },
  "Básico I": { short: "Bás. I", level: "Iniciante" },
  "Básico II": { short: "Bás. II", level: "Intermediário" },
  Construção: { short: "Constr.", level: "Avançado" },
  Ataque: { short: "Ataque", level: "Competitivo" },
};

export type TemplateSkill = { name: string; phase: Phase; relevance: string };
export type TemplateTopic = { name: string; phase: Phase; relevance: string; skills: TemplateSkill[] };
export type TemplateSubject = { name: string; topics: TemplateTopic[] };

/* ---------- Relevância ---------- */

const O = "Obrigatório";
const R = "Recomendado";
const rel = (inc: "Alta" | "Média" | "Baixa", comp: "Baixa" | "Média" | "Alta" | "Altíssima") =>
  `${inc} incidência · ${comp} complexidade`;
const AB = rel("Alta", "Baixa");
const AM = rel("Alta", "Média");
const AA = rel("Alta", "Alta");
const AX = rel("Alta", "Altíssima");
const MB = rel("Média", "Baixa");
const MM = rel("Média", "Média");
const MA = rel("Média", "Alta");
const MX = rel("Média", "Altíssima");
const BB = rel("Baixa", "Baixa");
const BM = rel("Baixa", "Média");
const BA = rel("Baixa", "Alta");

/** Lista de etiquetas para escolher no editor. */
export const RELEVANCES = [O, R, AB, AM, AA, AX, MB, MM, MA, MX, BB, BM, BA];

/** Quanto menor, mais importante. */
export function relevanceRank(r?: string | null) {
  if (!r) return 9;
  if (r.startsWith("Obrigatório")) return 0;
  if (r.startsWith("Alta")) return 1;
  if (r.startsWith("Recomendado")) return 2;
  if (r.startsWith("Média")) return 3;
  if (r.startsWith("Baixa")) return 4;
  return 5;
}

/** Relevância resumida de um tópico: a etiqueta mais forte das habilidades, sem a complexidade. */
export function topicRelevance(skills: { relevance: string }[], fallback = R) {
  if (!skills.length) return fallback;
  const best = [...skills].sort((a, b) => relevanceRank(a.relevance) - relevanceRank(b.relevance))[0];
  return best.relevance.split(" · ")[0];
}

/* ---------- Atalhos de escrita ---------- */

const N: Phase = "Nivelamento";
const B1: Phase = "Básico I";
const B2: Phase = "Básico II";
const C: Phase = "Construção";
const A: Phase = "Ataque";

type S = [name: string, relevance: string, phase?: Phase];

function t(name: string, phase: Phase, skills: S[], relevance?: string): TemplateTopic {
  const sk = skills.map(([n, r, p]) => ({ name: n, relevance: r, phase: p ?? phase }));
  return { name, phase, relevance: relevance ?? topicRelevance(sk), skills: sk };
}

/* ---------- Árvore ---------- */

export const TEMPLATE_TREE: { area: Area; subjects: TemplateSubject[] }[] = [
  {
    area: "Matemática",
    subjects: [
      {
        name: "Matemática Básica",
        topics: [
          t("Fundamentos da Matemática", N, [
            ["Somar e subtrair de cabeça", O],
            ["Multiplicar números de dois algarismos de cabeça", O],
            ["Fazer divisões simples de cabeça", O],
            ["Somar e subtrair no papel", O],
            ["Multiplicar e dividir no papel", O],
            ["Tabuada de 1 a 10 com agilidade", O],
            ["Operações com números decimais", O],
            ["Critérios de divisibilidade", O],
            ["Atalhos mentais: ×10, ÷10, dobrar e ÷5", O],
          ]),
          t("Frações", N, [
            ["Frações equivalentes e simplificação", O],
            ["Operações com frações", O],
            ["Números mistos", R],
          ]),
          t("MMC e MDC", N, [
            ["Calcular MMC", O],
            ["Calcular MDC", R],
            ["Problemas de ciclos e encontros (MMC)", AB],
          ]),
          t("Potenciação e Radiciação", N, [
            ["Potenciação básica", O],
            ["Propriedades das potências", O],
            ["Radiciação básica", O],
            ["Fatoração", R],
          ]),
          t("Razão, Proporção e Regra de 3", B1, [
            ["Enxergar a proporção de cabeça (×k dos dois lados)", O],
            ["Grandezas direta e inversamente proporcionais", O],
            ["Regra de três simples", O],
            ["Regra de três composta", O],
          ]),
          t("Porcentagem", B1, [
            ["Porcentagens mentais (1%, 5%, 10%, 25%, 50%…)", O],
            ["Cálculo de porcentagens em geral", O],
            ["Aumentos e descontos sucessivos e preço original", O],
          ]),
          t("Notação Científica", B1, [
            ["Escrever e operar em notação científica", O],
            ["Ajustar a potência de 10 de cabeça", O],
          ]),
          t("Unidades de Medida e Conversões", B1, [
            ["Conversões de comprimento, massa, área e volume", O],
            ["Conversões de cabeça (ex.: m/s ↔ km/h)", O],
          ]),
          t("Vazão", B1, [["Problemas de vazão", O]]),
          t("Escalas", B1, [
            ["Escala linear (mapas e plantas)", O],
            ["Escala de área e de volume", O],
          ]),
          t("Gráficos e Tabelas", B1, [
            ["Ler gráficos simples e tabelas", O],
            ["Plano cartesiano básico", O],
          ]),
          t("Matemática Financeira Básica", B1, [
            ["Faturamento, custo, lucro e prejuízo", O],
            ["Aumentos e descontos sucessivos no contexto financeiro", O],
          ]),
        ],
      },
      {
        name: "Álgebra",
        topics: [
          t("Fundamentos da Álgebra", B2, [
            ["Operar com incógnitas (x + x = 2x)", O],
            ["Produtos notáveis", R],
          ]),
          t("Sistemas e Equações", B2, [
            ["Traduzir o enunciado em equação", O],
            ["Mesma operação dos dois lados da igualdade", O],
            ["Propriedades das operações aplicadas a equações", O],
            ["Montar sistemas 2×2", O],
            ["Resolver sistemas por adição e substituição", O],
          ]),
          t("Conjuntos", B2, [["Diagrama de Venn e as pegadinhas de linguagem", MM]]),
          t("Inequações", B2, [
            ["Inequações do 1º grau", MB],
            ["Estudo de sinal e inequações do 2º grau", BM],
          ]),
          t("Matrizes", A, [
            ["Tipos de matrizes", BB],
            ["Operações com matrizes", BM],
            ["Determinantes e aplicação em sistemas", BM],
          ]),
        ],
      },
      {
        name: "Funções",
        topics: [
          t("Função do 1º grau", B2, [
            ["Montar o problema de função afim a partir do texto", R],
            ["Lei y = ax + b", AB],
            ["Coeficiente angular por Δy/Δx", AB],
            ["Coeficiente angular pela tangente", R],
            ["Ler os coeficientes no gráfico", AB],
            ["Achar a lei a partir de dois pontos", AB],
          ]),
          t("Função do 2º grau", B2, [
            ["Lei y = ax² + bx + c e seus coeficientes", O],
            ["Equações incompletas sem Bhaskara", R],
            ["Discriminante (Δ) e raízes por Bhaskara", AB],
            ["Soma e produto das raízes", AM],
            ["Vértice: fórmulas e significado prático", AB],
            ["Concavidade e corte no eixo y", R],
          ]),
          t("Função Exponencial", A, [
            ["Propriedades das equações exponenciais", MA],
            ["Encontrar o expoente x", MA],
            ["Gráfico clássico da exponencial", AB],
          ]),
          t("Logaritmo", A, [
            ["Propriedades dos logaritmos", AA],
            ["Resolver equações logarítmicas", AX],
            ["Usar log para isolar expoentes em problemas", AX],
          ]),
          t("Função Logarítmica", A, [
            ["Regras básicas e achar o valor de x", MA],
            ["Gráfico clássico da função logarítmica", AB],
          ]),
          t("Função Trigonométrica", A, [
            ["Seno e cosseno como funções: período e amplitude", AA],
            ["Equações trigonométricas e gráficos clássicos", AA],
          ]),
        ],
      },
      {
        name: "Sequências",
        topics: [
          t("Progressão Aritmética", B2, [
            ["Termo geral e classificação da PA", AM],
            ["Soma dos termos em problemas de acúmulo", AM],
            ["Propriedades da PA para encurtar contas", MA],
          ]),
          t("Progressão Geométrica", B2, [
            ["Termo geral e razão da PG", MM],
            ["Soma dos termos (finita e infinita)", MA],
            ["PG em crescimento e decaimento", MM],
          ]),
        ],
      },
      {
        name: "Estatística e Probabilidade",
        topics: [
          t("Estatística", B2, [
            ["Ler tabelas, gráficos e frequências", AB],
            ["Média aritmética e ponderada, moda e mediana", AB],
            ["Ideia de desvio padrão", MB],
            ["Calcular variância e desvio padrão", BA],
          ]),
          t("Análise Combinatória", A, [
            ["Princípio fundamental da contagem", AM],
            ["Permutações e anagramas", AM],
            ["Permutação com repetição e blocos fixos", AA],
            ["Senhas, códigos e filas", AA],
            ["Combinação e arranjo", AA],
            ["Combinação e arranjo no mesmo problema", AA],
            ["Permutação circular", BM],
          ]),
          t("Probabilidade", A, [
            ["Espaço amostral e casos favoráveis", AB],
            ["Conectivos “e” e “ou”", O],
            ["Probabilidade complementar", AM],
            ["Casos com restrições", AA],
            ["Probabilidade com combinatória", AX],
          ]),
        ],
      },
      {
        name: "Geometria",
        topics: [
          t("Geometria Plana", C, [
            ["Retas, ângulos e polígonos", O],
            ["Soma dos ângulos de um polígono", R],
            ["Área do quadrado e do retângulo", O],
            ["Área do paralelogramo e do losango", R],
            ["Área do trapézio", AB],
            ["Área do triângulo", O],
            ["Tipos de triângulo e o equilátero", AB],
            ["Triângulo retângulo e Pitágoras", AB],
            ["Tales e semelhança de triângulos", MM],
            ["Circunferência: comprimento e área", O],
            ["Coroa e setor circular", AM],
            ["Montar e desmontar figuras", MA],
          ]),
          t("Trigonometria", C, [
            ["Seno, cosseno e tangente no triângulo retângulo", MM],
            ["Ângulos notáveis", MB],
            ["Ciclo trigonométrico", BM],
          ]),
          t("Geometria Espacial", C, [
            ["Reconhecer sólidos (prismas, pirâmides, cone, esfera)", O],
            ["Volume do cilindro", O],
            ["Volume de pirâmide e cone", AM],
            ["Volume da esfera", AM],
            ["Sólidos recortados (troncos, semiesfera)", MA],
            ["Transferir volume entre sólidos", AA],
            ["Sólidos de revolução", MA],
          ]),
          t("Projeção Ortogonal", C, [
            ["Projeções e vistas de objetos 3D", AA],
            ["Planificação de sólidos", AM],
          ]),
          t("Geometria Analítica", A, [
            ["Coordenadas e quadrantes", MB],
            ["Distância entre dois pontos", MM],
            ["Estudo da reta: equação, paralelas e perpendiculares", AM],
            ["Circunferência: centro, raio e posições", MA],
            ["Cônicas e suas aplicações", BA],
          ]),
        ],
      },
      {
        name: "Matemática Financeira",
        topics: [
          t("Juros Simples", B1, [
            ["Juros simples em dívidas e empréstimos", O],
            ["Montante e taxa equivalente no regime simples", MB],
          ]),
          t("Juros Compostos", A, [
            ["Regime composto e a linguagem das taxas", AM],
            ["Juros compostos com expoentes e logaritmos", AX],
          ]),
          t("Financiamentos", A, [
            ["Financiamento, amortização e antecipação de parcelas", MX],
            ["Comparar propostas de pagamento", MM],
          ]),
        ],
      },
    ],
  },
  {
    area: "Natureza",
    subjects: [
      {
        name: "Biologia",
        topics: [
          t("Bioquímica", N, [
            ["Papéis da água na vida (polaridade, calor específico)", O],
            ["Proteínas, carboidratos e lipídios", O],
            ["Enzimas e fatores que afetam sua ação", AM],
            ["Vitaminas e sais minerais", MB],
            ["DNA e RNA: estrutura básica", AB],
          ]),
          t("Citologia", N, [
            ["Meio intracelular e extracelular", O],
            ["Membrana plasmática e suas propriedades", AB],
            ["Tipos de transporte pela membrana", AB],
            ["Fagocitose, pinocitose e bomba de sódio e potássio", AB],
            ["Células em meio hipotônico e hipertônico", MB],
            ["Função de cada organela", AB],
            ["Por que certos tecidos têm mais de uma organela", AB],
            ["Procarionte × eucarionte; animal × vegetal", AB],
            ["Autótrofos × heterótrofos", AB],
            ["Teoria endossimbiótica", AB],
            ["Organelas do espermatozoide e fecundação", MM],
          ]),
          t("Metabolismo Energético", B1, [
            ["O Sol como fonte de energia dos ecossistemas", AB],
            ["Respiração celular e fermentação", AM],
            ["Bloqueadores da cadeia respiratória", AB],
            ["Fotossíntese: carbono inorgânico → orgânico", AB],
          ]),
          t("Divisão Celular", B2, [
            ["Ciclo celular e mitose", MM],
            ["Meiose e variabilidade genética", MM],
            ["Câncer, metástase e terapias", AM, B1],
          ]),
          t("Genética", C, [
            ["Conceitos básicos: gene, alelo, homólogos, gametas", AM],
            ["Dominância, codominância e dominância incompleta", MM],
            ["1ª e 2ª leis de Mendel e cruzamentos", AA],
            ["Heredogramas e doenças hereditárias", AA],
            ["Sistema ABO, Rh e transfusões", AM],
            ["Síndromes e anomalias cromossômicas", AM],
            ["Hardy-Weinberg, clonagem, PCR e transgênicos", AA],
          ]),
          t("Biotecnologia", B1, [
            ["DNA mitocondrial na medicina e na perícia", AB],
            ["DNA recombinante e suas enzimas", AM],
            ["Usos comerciais da biotecnologia (insulina etc.)", AM],
          ]),
          t("Evolução", B1, [
            ["Evolução como mudança ao longo do tempo", AB],
            ["Lamarck, Darwin e neodarwinismo", AB],
            ["Seleção natural × artificial", AB],
            ["Mutação aleatória", MB],
            ["Estruturas homólogas e análogas", AB],
            ["Convergência e divergência adaptativa", MB],
            ["Cladogramas e novidades evolutivas", MB],
            ["Biodiversidade como estratégia adaptativa", AB],
            ["Especiação alopátrica e simpátrica", BA],
          ]),
          t("Ecologia", B2, [
            ["População, comunidade, ecossistema e biótopo", AB],
            ["Habitat, nicho, cadeias e teias alimentares", AB],
            ["Bioacumulação e magnificação trófica", AB],
            ["Relações ecológicas harmônicas e desarmônicas", AB],
            ["Espécies exóticas invasoras", AB],
            ["Relações ecológicas em gráficos de população", AB],
            ["Potencial biótico e pirâmides ecológicas", AB],
            ["Sustentabilidade: econômica, social e ambiental", AB],
            ["Corredores ecológicos e fluxo gênico", AB],
            ["Sucessão ecológica e clímax", MM],
            ["Ciclo da água", AB],
          ]),
          t("Impactos Ambientais", B2, [
            ["Poluição da água", AB],
            ["Eutrofização e DBO", AB],
            ["Desmatamento, queimadas e erosão", AB],
            ["Chuva ácida, efeito estufa e CFCs", AB],
            ["Ciclo do carbono e vazamentos de petróleo", AB],
            ["Biorremediação", AB],
            ["Ciclo do nitrogênio", AB],
            ["Ciclo do fósforo", BB],
          ]),
          t("Fisiologia Humana", B2, [
            ["Homeostase e organização do corpo", AB],
            ["Sangue, hemoglobina e coagulação", AM],
            ["Ventilação e diafragma", MM],
            ["Gases no sangue e mergulho", MA],
            ["Anemias, anticoagulantes e coagulantes", AM],
            ["Sistema nervoso e sinapses", BM],
            ["Fibras musculares rápidas × lentas", AB],
            ["Hipófise e feedback hormonal", AM],
            ["Principais glândulas e seus hormônios", AM],
            ["Hormônios antagônicos (insulina × glucagon…)", AB],
            ["Diabetes tipo 1, tipo 2 e insipidus", MB],
            ["Digestão: fases, enzimas e locais", AM],
            ["Pâncreas, fígado, bile e intestino", AM],
            ["Sistema urinário", BA],
            ["Ciclo menstrual, ovulação e fecundação", AM],
            ["Espermatogênese e ovogênese", BA],
            ["Métodos contraceptivos", AM],
          ]),
          t("Imunologia e Vacinas", B2, [
            ["Antígeno, anticorpo e memória imunológica", AM],
            ["Vacina × soro; imunização ativa e passiva", AM],
          ]),
          t("Parasitoses", A, [
            ["Principais doenças parasitárias", AA],
            ["Doenças endêmicas (dengue etc.) e prevenção", AM],
            ["Ciclos de vida de parasitas e saneamento", AM],
          ]),
          t("Botânica", C, [
            ["Briófitas, pteridófitas, gimnospermas e angiospermas", AB],
            ["Conquista do ambiente terrestre pelas plantas", AM],
            ["Sementes, frutos e dispersão", AM],
            ["Raiz, caule, folha e flor", AM],
            ["Tipos de caule, raiz e fruto e suas adaptações", AM],
            ["Seiva bruta e elaborada (capilaridade, coesão)", AB],
            ["Tropismos", MB],
            ["Fito-hormônios e seus usos", AM],
            ["Adaptações das plantas a cada bioma", AA],
            ["Técnicas agrícolas (enxertia, rotação, hidroponia…)", AM],
          ]),
          t("Zoologia", A, [
            ["Sistemas digestórios comparados", MM],
            ["Circulação e respiração conforme o ambiente", MM],
            ["Excretas nitrogenadas e sistemas excretores", MA],
            ["Evolução do coração nos vertebrados", BM],
            ["Principais grupos de invertebrados e vertebrados", MM],
          ]),
          t("Microbiologia e Vírus", C, [
            ["Vírus: reprodução e infecção de células", MM],
            ["Vírus × príons", BM],
            ["Bactérias: estrutura, reprodução e sobrevivência", AM],
            ["Algas: fotossíntese, usos e bioindicação", AB],
            ["Fungos: decomposição e reprodução", MM],
            ["Antibióticos e resistência bacteriana", AM, A],
            ["Doenças bacterianas e virais", AA, A],
          ]),
          t("Taxonomia e Classificação", C, [
            ["Regras de nomenclatura científica", BM],
            ["Categorias taxonômicas", BB],
            ["Os cinco reinos", MM],
            ["Filogenias e grupos monofiléticos", AA],
          ]),
        ],
      },
      {
        name: "Física",
        topics: [
          t("Grandezas e Unidades", N, [
            ["Sistema Internacional de unidades", O],
            ["Ordem de grandeza e algarismos significativos", MB],
          ]),
          t("Vetores", B1, [
            ["Grandezas escalares × vetoriais", BB],
            ["Operações com vetores", MM],
            ["Cinemática vetorial em duas dimensões", MA],
          ]),
          t("Cinemática", B1, [
            ["Posição, deslocamento, trajetória e referencial", O],
            ["Velocidade e suas unidades", O],
            ["Movimento uniforme: fórmulas e equação horária", AB],
            ["Gráficos do movimento uniforme", AM],
            ["Aceleração", O, B2],
            ["MUV: equações e Torricelli", AB, B2],
            ["Gráficos do MUV e área sob a curva", AM, B2],
            ["Frenagens, encontros e ultrapassagens", MM, B2],
            ["Queda livre e lançamento vertical", AM, B2],
            ["Lançamento oblíquo e alcance", AM, B2],
            ["Movimento circular e aceleração centrípeta", MM, B2],
          ]),
          t("Dinâmica (Leis de Newton)", B1, [
            ["As três leis de Newton", AB],
            ["Peso, normal, tração e força elástica", AB],
            ["Polias fixas", AB],
            ["Atrito estático e cinético", AM, C],
            ["Planos inclinados com atrito", MM, C],
            ["Peso aparente em elevadores", MA, C],
            ["Polias móveis", MM, C],
            ["Resistência do ar e arrasto", BA, C],
            ["Dinâmica do movimento circular", MA, C],
          ]),
          t("Trabalho, Energia e Potência", N, [
            ["Trabalho de uma força e energia", MM],
            ["Teorema da energia cinética", MB],
            ["Forças conservativas", MM],
            ["Energia mecânica: cinética, potencial e elástica", AB],
            ["Potência mecânica", AM, C],
            ["Potência útil e rendimento", AM, C],
            ["Usinas e geração de energia", AB, C],
          ]),
          t("Impulso e Quantidade de Movimento", C, [
            ["Quantidade de movimento e impulso", MB],
            ["Teorema do impulso", MM],
            ["Colisões e coeficiente de restituição", BM],
            ["Pêndulo de Newton e efeito estilingue", MM],
          ]),
          t("Estática", C, [
            ["Centro de massa e estabilidade", MM],
            ["Torque (momento de uma força)", AB],
            ["Condições de equilíbrio", MM],
            ["Alavancas e seus tipos", MM],
          ]),
          t("Hidrostática", C, [
            ["Densidade e pressão", AB],
            ["Teorema de Stevin e vasos comunicantes", MM],
            ["Pressão atmosférica", MM],
            ["Princípio de Pascal", MM],
            ["Empuxo e Arquimedes", MM],
            ["Flutuação", MM],
          ]),
          t("Gravitação", A, [
            ["Geocentrismo × heliocentrismo", AB],
            ["Leis de Kepler", MM],
            ["Lei da gravitação universal e órbitas", MB],
            ["Satélites geoestacionários", MB],
            ["Estações do ano", R],
            ["Campo gravitacional e velocidade de escape", MA],
            ["Marés", MM],
          ]),
          t("Termologia", B1, [
            ["Temperatura, calor e energia térmica", O],
            ["Calor sensível, latente e específico", AM],
            ["Condução, convecção e irradiação", AM],
            ["Potência térmica", AM],
            ["Mudanças de fase e curva de aquecimento", AM],
            ["Diagrama de fases da água", AM],
            ["Dilatação linear, superficial e volumétrica", MM],
            ["Dilatação de líquidos e anomalia da água", MM],
            ["Escalas termométricas e conversões", MM],
            ["Calor no dia a dia: garrafa térmica, panela de pressão, casacos", AB],
          ]),
          t("Termodinâmica", C, [
            ["Gás ideal e transformações", MM],
            ["1ª lei da termodinâmica", AM],
            ["Máquinas térmicas e rendimento (Carnot)", AM],
            ["Geladeiras e ar-condicionado", AB, B1],
          ]),
          t("Ondulatória", B1, [
            ["O que é uma onda: energia e informação", O],
            ["Ondas mecânicas × eletromagnéticas", AB],
            ["Frequência, período, comprimento e amplitude", AB],
            ["Equação fundamental (v = λf)", AB],
            ["Reflexão, refração e difração", AB],
            ["Interferência e polarização", AB],
            ["Ressonância", AB],
            ["Ondas estacionárias e batimentos", MM],
            ["Espectro eletromagnético", AB],
          ]),
          t("Acústica", B1, [
            ["Altura, intensidade e timbre", AM],
            ["Eco e reverberação", AM],
            ["Efeito Doppler", AB],
            ["Tubos sonoros e cordas", MM],
          ]),
          t("Óptica", A, [
            ["Luz, cores e meios de propagação", MM],
            ["Câmara escura, sombra e eclipses", MM],
            ["Reflexão e espelhos planos", MM],
            ["Espelhos esféricos e equação de Gauss", MM],
            ["Refração e lei de Snell", MM],
            ["Dispersão, prismas e arco-íris", MM],
            ["Reflexão total, fibra óptica e miragens", MM],
            ["Lentes convergentes e divergentes", MM],
            ["Instrumentos ópticos (lupa, microscópio, telescópio)", MM],
            ["Olho humano e defeitos da visão", MM],
          ]),
          t("Eletrostática", B2, [
            ["Carga elétrica e processos de eletrização", AB],
            ["Lei de Coulomb", MM],
            ["Campo elétrico e linhas de força", MA],
            ["Potencial elétrico e trabalho", BA],
            ["Blindagem e gaiola de Faraday", AB],
          ]),
          t("Eletrodinâmica", B2, [
            ["Corrente, tensão e resistência", O],
            ["Efeitos da corrente e circuito simples", O],
            ["Leis de Ohm", MM],
            ["Associação de resistores", MM],
            ["Curto-circuito e circuitos equivalentes", MM],
            ["Amperímetro e voltímetro", AB],
            ["Fusível e disjuntor", AB],
            ["Consumo de energia (kWh) e conta de luz", AM],
            ["Chuveiro elétrico e potência elétrica", AM],
            ["Leis de Kirchhoff e ponte de Wheatstone", BM, C],
            ["Geradores e receptores (fem e fcem)", MA, C],
            ["Capacitores", BA, C],
          ]),
          t("Magnetismo e Indução", A, [
            ["Ímãs e campo magnético", MM],
            ["Magnetização e desmagnetização", MM],
            ["Campo magnético da corrente elétrica", MM],
            ["Força magnética", MM],
            ["Indução eletromagnética e transformadores", AM],
            ["Geradores elétricos e associação", MM],
          ]),
        ],
      },
      {
        name: "Química",
        topics: [
          t("Propriedades da Matéria", N, [
            ["Propriedades gerais da matéria", AB],
            ["Propriedades específicas", AB],
            ["Densidade", O],
            ["Estados físicos: forma e volume", AB],
            ["Pontos de fusão e de ebulição", AB],
            ["Curvas de aquecimento", AB],
            ["Alotropia", MB],
          ]),
          t("Separação de Misturas", B1, [
            ["Substância pura × mistura homogênea e heterogênea", AB],
            ["Métodos de separação de misturas", O],
            ["Tratamento de água", AB],
          ]),
          t("Atomística", B1, [
            ["Modelos atômicos e partículas", AB],
            ["Íons: cátions e ânions", AB],
            ["Isótopos, isóbaros e isótonos", MM],
            ["Distribuição eletrônica (Pauling)", MB],
            ["Saltos quânticos e emissão de luz", AM],
          ]),
          t("Tabela Periódica", B1, [
            ["Organização em famílias e períodos", MB],
            ["Propriedades periódicas", MA],
          ]),
          t("Ligações Químicas", B1, [
            ["Iônica, covalente e metálica; regra do octeto", AB],
            ["Ligações simples, duplas e triplas (σ e π)", AB],
            ["Ligação dativa e ressonância", MM],
            ["Exceções ao octeto", BM],
            ["Geometria molecular e hibridização", AB],
            ["Polaridade das moléculas", AB],
            ["Forças intermoleculares", AB],
            ["Propriedades ligadas à polaridade", AM],
            ["Sabões, detergentes e moléculas anfifílicas", AM],
          ]),
          t("Funções Inorgânicas", B2, [
            ["Teorias ácido-base (Arrhenius, Brønsted, Lewis)", AM],
            ["Ácidos: hidrácidos, oxiácidos e os mais comuns", AM],
            ["Bases e nomenclatura", AM],
            ["Sais", AM],
            ["Óxidos", AM],
          ]),
          t("Reações Químicas", C, [
            ["Nox e seu cálculo", AB],
            ["Oxidação e redução na prática", AM],
            ["Síntese, decomposição, simples e dupla troca", MM],
            ["Neutralização", AM],
          ]),
          t("Estequiometria", B2, [
            ["Massa atômica, molecular e mol", AB],
            ["Cálculos com mol, massa e número de partículas", AB],
            ["Leis ponderais", AB],
            ["Balanceamento", AB],
            ["Estequiometria básica", AB],
            ["Problemas longos de várias etapas", AM],
            ["Reagente em excesso e limitante", AM],
            ["Pureza e rendimento", AM],
            ["Reações sucessivas", MM],
          ]),
          t("Gases", C, [
            ["Propriedades dos gases", AB],
            ["Transformações gasosas e equação geral", AB],
            ["Equação de Clapeyron", AM],
            ["Lei de Avogadro", MM],
            ["Densidade dos gases", MA],
            ["Pressão e volume parciais", MA],
          ]),
          t("Soluções", C, [
            ["Concentração de soluções", AB],
            ["Solubilidade e curvas de solubilidade", AB],
            ["Diluição e mistura de soluções", AB],
            ["Dispersões e coloides", AB],
            ["Titulação", AB],
          ]),
          t("Propriedades Coligativas", C, [
            ["Tonoscopia, ebulioscopia e crioscopia", MA],
            ["Osmose e pressão osmótica", MA],
          ]),
          t("Termoquímica", C, [
            ["Reações endotérmicas e exotérmicas", AB],
            ["Entalpia de formação e de combustão", AM],
            ["Lei de Hess", AM],
            ["Energia de ligação", AM],
            ["Combustíveis e calor no cotidiano", AM],
            ["Termoquímica com estequiometria", MM],
          ]),
          t("Cinética Química", C, [
            ["Velocidade das reações", AB],
            ["Fatores que alteram a velocidade", AB],
            ["Catalisadores e enzimas", AB],
            ["Gráficos de energia e velocidade", MM],
          ]),
          t("Equilíbrio Químico e pH", C, [
            ["Equilíbrio homogêneo, Kc e Kp", MM],
            ["Princípio de Le Chatelier", AB],
            ["Equilíbrio iônico", AB],
            ["pH e pOH", AM],
            ["Solução-tampão", AM],
            ["Produto de solubilidade (Kps)", BM],
          ]),
          t("Eletroquímica", A, [
            ["Oxirredução, cátodo e ânodo", AA],
            ["Pilhas: ddp, ponte salina e pilha de Daniell", AA],
            ["Pilhas e baterias do dia a dia", AA],
            ["Eletrólise ígnea e aquosa", MA],
            ["Cálculos de eletrólise", MA],
          ]),
          t("Radioatividade", B2, [
            ["O que é radioatividade", AB],
            ["Emissões α, β e γ", AB],
            ["Decaimento e meia-vida", AB],
            ["Usos e riscos (medicina, usinas)", AB],
          ]),
          t("Química Orgânica", C, [
            ["O carbono e suas propriedades", AB],
            ["Representação e classificação de cadeias", AB],
            ["Nomenclatura orgânica", AB],
            ["Hidrocarbonetos", AB],
            ["Propriedades físicas dos compostos orgânicos", AM],
            ["Acidez e basicidade orgânica", AM],
          ]),
          t("Funções Orgânicas", C, [
            ["Álcool, enol e fenol", AB],
            ["Aldeído e cetona", AB],
            ["Éter, ácido carboxílico e éster", AB],
            ["Amina e amida", AB],
            ["Nitrocompostos, haletos e sulfonados", MM],
            ["Funções orgânicas no cotidiano", AB],
          ]),
          t("Isomeria", C, [
            ["Isomeria plana", AM],
            ["Isomeria geométrica", AM],
            ["Isomeria óptica", AM],
          ]),
          t("Reações Orgânicas", A, [
            ["Panorama das reações orgânicas", AM],
            ["Esterificação, hidrólise e transesterificação", AM],
            ["Adição em alcenos e alcinos", AM],
            ["Desidratação de álcoois", AM],
            ["Substituição em alcanos e aromáticos", AM],
            ["Oxidação de álcoois, aldeídos e cetonas", AM],
            ["Polímeros e polimerização", AM],
          ]),
          t("Química Ambiental", A, [
            ["Sustentabilidade e química verde", AB],
            ["Combustíveis fósseis e ciclo do carbono", AB],
            ["Efeito estufa e chuva ácida", AB],
            ["Camada de ozônio e CFCs", AB],
            ["Tratamento de água, esgoto e lixo", AB],
            ["Tipos de poluição", AB],
          ]),
        ],
      },
    ],
  },
  {
    area: "Linguagens",
    subjects: [
      {
        name: "Português",
        topics: [
          t("Interpretação de Texto", N, [
            ["Tema, tese e ideia principal", O],
            ["Informações explícitas e implícitas (inferência)", AM],
            ["Intenção do autor e efeito de sentido", AM],
          ]),
          t("Gêneros Textuais", B1, [
            ["Finalidade e função social dos gêneros", AB],
            ["Gêneros digitais: posts, e-mails, memes", AB],
            ["Tipos textuais dentro de gêneros híbridos", AM],
            ["Intergenericidade (um gênero na forma de outro)", AM],
          ]),
          t("Funções da Linguagem", N, [
            ["Funções da linguagem e elementos da comunicação", AM],
            ["Função predominante em textos mistos", AM],
          ]),
          t("Variação Linguística", B1, [
            ["Variações regional, social, histórica e situacional", AB],
            ["Preconceito linguístico", AB],
          ]),
          t("Figuras de Linguagem", B1, [
            ["Figuras de palavra e de pensamento em contexto", AM],
            ["Figuras de som e de sintaxe", MM],
          ]),
          t("Coesão e Coerência", C, [
            ["Coesão referencial e sequencial", AM],
            ["Coerência e progressão do sentido", AM],
            ["Tipologias: narrar, descrever, dissertar, expor, instruir", AM],
            ["Conectivos e marcadores temporais", AM],
          ]),
          t("Gramática Contextualizada", B2, [
            ["Classes de palavras e seus efeitos de sentido", MM],
            ["Concordância, regência e pontuação em contexto", MM],
            ["Norma-padrão × usos informais", MB],
          ]),
          t("Publicidade e Persuasão", B1, [
            ["Verbal e não verbal na persuasão (multimodalidade)", AB],
            ["Imperativo e estratégias de convencimento", AB],
            ["Público-alvo em campanhas de utilidade pública", AB],
            ["Mídias digitais, algoritmos e consumo", MM],
          ]),
        ],
      },
      {
        name: "Literatura",
        topics: [
          t("Escolas Literárias", B1, [
            ["Trovadorismo e Humanismo", BB],
            ["Classicismo e Camões", BM],
            ["Quinhentismo: informação e catequese", BB],
            ["Barroco: fé × razão, cultismo e conceptismo", MM],
            ["Arcadismo e o bucolismo", BB],
            ["As três gerações do Romantismo", MM],
            ["Realismo e Machado de Assis", AA],
            ["Naturalismo e Parnasianismo", MM],
            ["Simbolismo", MM],
            ["Pré-Modernismo e o Brasil real", AM],
          ]),
          t("Modernismo", B1, [
            ["Semana de 22 e a ruptura estética", AM],
            ["Romance de 30 e a 2ª geração", AA],
            ["3ª geração: Clarice e Guimarães Rosa", AA],
          ]),
          t("Literatura Contemporânea", B1, [
            ["Vozes múltiplas e literatura urbana", AM],
            ["Literatura de autoria negra, indígena e periférica", AM],
          ]),
          t("Análise de Poemas", B2, [
            ["Eu lírico e subjetividade", AB],
            ["Rima, métrica, aliteração e assonância", MM],
            ["Verso fixo, livre e branco", MB],
          ]),
        ],
      },
      {
        name: "Artes",
        topics: [
          t("Movimentos Artísticos", B2, [
            ["Vanguardas europeias", AM],
            ["Arte como reflexo do contexto histórico", MM],
          ]),
          t("Arte Brasileira", B2, [
            ["Patrimônio material e imaterial", MB],
            ["Arte e cultura populares", MB],
          ]),
          t("Arte Contemporânea", B2, [
            ["Arte contemporânea como denúncia e reflexão", AM],
            ["Charges, cartuns e tirinhas como crítica social", AM],
          ]),
        ],
      },
      {
        name: "Educação Física",
        topics: [
          t("Práticas Corporais", B1, [
            ["Esporte, dança, luta e jogo como cultura", MB],
            ["Esporte de alto rendimento × lazer", MB],
          ]),
          t("Corpo, Saúde e Sociedade", B1, [
            ["Padrões de beleza e mídia", MB],
            ["Atividade física, sedentarismo e saúde", MB],
          ]),
        ],
      },
      {
        name: "Língua Estrangeira",
        topics: [
          t("Inglês: Interpretação", N, [
            ["Skimming e scanning", AB],
            ["Cognatos, falsos cognatos e contexto", AB],
            ["Gêneros em inglês (tirinha, poema, notícia)", AM],
          ]),
          t("Espanhol: Interpretação", N, [
            ["Leitura global e palavras-chave", AB],
            ["Falsos amigos (heterosemánticos)", AB],
            ["Gêneros em espanhol (tirinha, poema, notícia)", AM],
          ]),
        ],
      },
      {
        name: "Tecnologias da Informação",
        topics: [
          t("Linguagem Digital e Mídias", B1, [
            ["Linguagem das redes e hipertexto", AB],
            ["Fake news e checagem de fontes", AM],
            ["Bolhas de filtro e algoritmos", MM],
          ]),
        ],
      },
    ],
  },
  {
    area: "Humanas",
    subjects: [
      {
        name: "História",
        topics: [
          t("Antiguidade", B1, [
            ["Grécia: pólis, democracia e cultura clássica", BM],
            ["Roma: sociedade, Direito e crise do Império", BM],
          ]),
          t("Idade Média", B1, [
            ["Feudalismo e vassalagem", BM],
            ["Cruzadas e seus impactos", BA],
            ["Crise do século XIV e Peste Negra", MM],
            ["Guerra dos Cem Anos e Estados Nacionais", BM],
          ]),
          t("Idade Moderna", B2, [
            ["Renascimento e humanismo", MM],
            ["Expansão marítima e mercantilismo", AM],
            ["Reformas religiosas", MM],
            ["Absolutismo e Estados Nacionais", MB],
            ["América Espanhola: exploração e sociedade", MA],
            ["Iluminismo e crítica ao Antigo Regime", AM],
          ]),
          t("Brasil Colônia", B1, [
            ["Capitanias hereditárias e governo-geral", MB],
            ["Economia açucareira no Nordeste", MM],
            ["Escravidão, resistência e quilombos", AM],
            ["Ciclo do ouro e urbanização", AM],
            ["Invasões estrangeiras e domínio holandês", BA],
            ["Vinda da Corte (1808)", MB],
          ]),
          t("Brasil Império", B2, [
            ["Independência no contexto internacional", BB],
            ["Constituição de 1824 e Poder Moderador", AM],
            ["Guerra da Cisplatina", BM],
            ["Revoltas do Período Regencial", AA],
            ["Economia cafeeira e modernização", AA],
            ["Guerra do Paraguai", MA],
            ["Leis abolicionistas e abolição", AM],
            ["Crise do Império e Proclamação da República", MM],
          ]),
          t("República Velha", C, [
            ["Política do café com leite e coronelismo", AM],
            ["Revoltas: Canudos, Vacina, Chibata, Contestado", AM],
            ["Tenentismo e crise de 1930", MM],
          ]),
          t("Era Vargas", C, [
            ["Governo provisório e Constituição de 1934", MM],
            ["Estado Novo, propaganda e trabalhismo", AM],
            ["Industrialização e leis trabalhistas", AM],
          ]),
          t("Ditadura Militar", C, [
            ["Golpe de 1964 e Atos Institucionais", AM],
            ["Censura, repressão e resistência cultural", AM],
            ["Milagre econômico e crise", MM],
            ["Abertura e Diretas Já", AM],
          ]),
          t("Redemocratização", C, [
            ["Constituição de 1988 e cidadania", AM],
            ["Governos da Nova República", MM],
          ]),
          t("Revoluções e Século XIX", B2, [
            ["Revolução Industrial e seus impactos", AB],
            ["Revolução Francesa e cidadania", AM],
            ["Imperialismo no século XIX", AM],
            ["Independência e expansão dos EUA", BM],
          ]),
          t("Guerras Mundiais", C, [
            ["Belle Époque e tensões", BB],
            ["Primeira Guerra Mundial", MM],
            ["Revolução Russa", MA],
            ["Entreguerras e revanchismo", MM],
            ["Crise de 1929 e American Way of Life", AM],
            ["Nazifascismo, totalitarismo e propaganda", AB],
            ["Segunda Guerra e Holocausto", MM],
          ]),
          t("Guerra Fria", C, [
            ["Bipolaridade, corrida armamentista e conflitos periféricos", AM],
            ["Descolonização da África e da Ásia", MM],
          ]),
          t("História da África e Afro-brasileira", B2, [
            ["Reinos africanos antes da colonização", MM],
            ["Diáspora africana e cultura afro-brasileira", AM],
          ]),
        ],
      },
      {
        name: "Geografia",
        topics: [
          t("Cartografia", B1, [
            ["Escalas, coordenadas e fusos horários", AM],
            ["Projeções cartográficas e suas intenções", MM],
            ["Leitura de mapas temáticos", AB],
          ]),
          t("Geologia e Relevo", B2, [
            ["Tectônica, estrutura da Terra e ciclo das rochas", MA],
            ["Relevo brasileiro e agentes modeladores", AA],
            ["Formação dos solos, laterização e erosão", MA],
          ]),
          t("Clima", B2, [
            ["Elementos × fatores climáticos", AM],
            ["Massas de ar no Brasil", BA, A],
            ["Tipos de clima do Brasil", AM, A],
            ["Chuvas orográficas, convectivas e frontais", BM, A],
            ["Fenômenos: El Niño, ilhas de calor, inversão térmica", AM],
          ]),
          t("Hidrografia", C, [
            ["Ciclo hidrológico e distribuição da água", MB],
            ["Bacias hidrográficas brasileiras", AM],
            ["Uso da água e estresse hídrico", MM],
            ["Hidrelétricas e matriz elétrica", AM],
            ["Correntes marítimas e clima", BA],
          ]),
          t("Biomas", B2, [
            ["Domínios morfoclimáticos do Brasil", AM],
            ["Biomas e ameaças a cada um", AM],
          ]),
          t("Questões Ambientais", B2, [
            ["Atividades humanas e impactos globais", AM],
            ["Conferências e acordos ambientais", MM],
          ]),
          t("População", B2, [
            ["Transição demográfica e pirâmides etárias", AM],
            ["Migrações internas e internacionais", AM],
          ]),
          t("Urbanização", B2, [
            ["Urbanização brasileira e metropolização", AM],
            ["Problemas urbanos: segregação, mobilidade, moradia", AM],
          ]),
          t("Agropecuária", A, [
            ["Sistemas agrícolas intensivo e extensivo", MB],
            ["Revolução Verde e biotecnologia no campo", AM],
            ["Estrutura fundiária e concentração de terras", AM],
            ["Reforma agrária e movimentos do campo", MM],
            ["Fronteira agrícola e arco do desmatamento", BM],
            ["Trabalho no campo e escravidão contemporânea", MB],
            ["Agronegócio e commodities", MM],
          ]),
          t("Industrialização", N, [
            ["Do taylorismo ao toyotismo", AM],
            ["Industrialização brasileira (Vargas à ditadura)", MA],
            ["Desconcentração industrial e desindustrialização", MA],
          ]),
          t("Energia", N, [
            ["Matriz energética mundial e brasileira", AM],
            ["Fontes renováveis e não renováveis", AB],
          ]),
          t("Globalização e Geopolítica", N, [
            ["Meio técnico-científico-informacional e fluxos", AM],
            ["Divisão Internacional do Trabalho", AB],
            ["Blocos econômicos, OMC, FMI e BRICS", MM],
            ["Ordem bipolar → multipolaridade", MM, A],
            ["Conflitos no Oriente Médio", AA, A],
            ["Rússia, Ucrânia e OTAN", MA, A],
            ["Ascensão da China", BA, A],
            ["BRICS e G20 na governança global", MB, A],
            ["ONU, OPEP e organismos internacionais", MM, A],
            ["Narcotráfico e terrorismo", MB, A],
          ]),
        ],
      },
      {
        name: "Filosofia",
        topics: [
          t("Filosofia Antiga", A, [
            ["Pré-socráticos e a busca pela arché", MB],
            ["Do mito à razão", MB],
            ["Sócrates e o método do diálogo", AM],
            ["Platão: caverna, sensível e inteligível", AM],
            ["Aristóteles: ética do meio-termo, política e lógica", AM],
            ["Helenismo: estoicos, epicuristas e ataraxia", AM],
          ]),
          t("Filosofia Medieval", A, [
            ["Agostinho: fé, razão e iluminação", AM],
            ["Tomás de Aquino e a escolástica", MA],
          ]),
          t("Filosofia Moderna", A, [
            ["Descartes e a dúvida metódica", AM],
            ["Empirismo e Hume", BA],
            ["Kant: imperativo categórico e conhecimento", MA],
            ["Hobbes e o Estado absoluto", AB],
            ["Locke, liberalismo e direitos naturais", AM],
            ["Rousseau e a vontade geral", MM],
          ]),
          t("Ética e Política", A, [
            ["Maquiavel: ética e poder", AM],
            ["Foucault: vigilância e biopoder", AM],
            ["Arendt: espaço público e banalidade do mal", AM],
          ]),
          t("Filosofia Contemporânea", A, [
            ["Sartre: existência, liberdade e angústia", MM],
            ["Popper e Kuhn: ciência e paradigmas", BA],
            ["Nietzsche: crítica da moral e niilismo", AA],
            ["Bauman e a modernidade líquida", AB],
            ["Escola de Frankfurt e indústria cultural", AM],
          ]),
        ],
      },
      {
        name: "Sociologia",
        topics: [
          t("Clássicos da Sociologia", A, [
            ["Comte e o positivismo", MB],
            ["Durkheim: fato social e coesão", AM],
            ["Weber: ação social e ética protestante", MA],
            ["Marx: classes, mais-valia e alienação", AM],
          ]),
          t("Cultura e Identidade", A, [
            ["Etnocentrismo × relativismo cultural", MM],
            ["Identidade brasileira e diversidade", AB],
            ["Patrimônio material e imaterial", MB],
            ["Globalização e hibridismo cultural", AM],
            ["Aculturação e alteridade", BM],
          ]),
          t("Trabalho e Sociedade", A, [
            ["Ludismo e cartismo", MB],
            ["Taylorismo, fordismo e toyotismo", AM],
            ["Terceirização e uberização", MM],
            ["Divisão social do trabalho", MM],
            ["Trabalho escravo e infantil hoje", AB],
          ]),
          t("Cidadania e Movimentos Sociais", A, [
            ["Movimento negro e feminista", AM],
            ["Movimentos do campo e luta pela terra", AM],
            ["Movimentos ambientais", AB],
            ["Ciberativismo", MM],
            ["Movimentos sociais e novos direitos", MB],
            ["Direitos civis, políticos e sociais", AB],
          ]),
          t("Poder, Estado e Democracia", A, [
            ["Poder, autoridade e tipos de dominação", AM],
            ["Formas de Estado e sistemas de governo", MM],
            ["Políticas públicas e ações afirmativas", MM],
            ["Democracia direta, representativa e participativa", BM],
          ]),
          t("Indústria Cultural e Consumo", A, [
            ["Indústria cultural e mercantilização da cultura", AM],
            ["Consumismo e obsolescência programada", AB],
            ["Algoritmos, bolhas e fake news", AM],
            ["Publicidade e manipulação midiática", MM],
            ["Consumo consciente", AB],
          ]),
          t("Pensamento Social Brasileiro", A, [
            ["Formação étnica e cultural do Brasil", MB],
            ["Patrimonialismo e o “homem cordial”", BA],
            ["Mito da democracia racial", BM],
            ["Racismo estrutural e exclusão", AB],
            ["Povos indígenas e demarcação de terras", MM],
          ]),
        ],
      },
    ],
  },
  {
    area: "Redação",
    subjects: [
      {
        name: "Redação ENEM",
        topics: [
          t(
            "Competência 1: Norma culta",
            N,
            [
              ["Acentuação, crase e ortografia", O],
              ["Concordância e regência", O],
              ["Pontuação e estrutura de períodos", O],
            ],
            O,
          ),
          t(
            "Competência 2: Tema e repertório",
            B1,
            [
              ["Entender o tema e não tangenciar", O],
              ["Estrutura dissertativo-argumentativa", O],
              ["Repertório legitimado, pertinente e produtivo", O],
            ],
            O,
          ),
          t(
            "Competência 3: Argumentação",
            B2,
            [
              ["Projeto de texto e tese clara", O],
              ["Desenvolver argumentos com causas e consequências", O],
            ],
            O,
          ),
          t(
            "Competência 4: Coesão",
            B2,
            [
              ["Conectivos entre parágrafos e dentro deles", O],
              ["Retomadas sem repetição", O],
            ],
            O,
          ),
          t(
            "Competência 5: Proposta de intervenção",
            C,
            [
              ["Os cinco elementos: agente, ação, meio, efeito e detalhamento", O],
              ["Proposta articulada à discussão e aos direitos humanos", O],
            ],
            O,
          ),
        ],
      },
    ],
  },
];
