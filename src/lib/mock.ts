// Dados de exemplo para a aprovação visual. Serão trocados pelo banco (Neon).

export const user = {
  name: "Lucas",
  fullName: "Lucas Liberato",
  totalXp: 1180,
  studiedDays: 53,
  streak: 10,
  firewood: 1,
  studyMode: "Regular" as "Baixo" | "Regular" | "Avançado",
  petName: "Brasa",
  enemDate: "2026-11-08",
};

export type Area = "Natureza" | "Matemática" | "Linguagens" | "Humanas" | "Redação";

export const areaColor: Record<Area, string> = {
  Natureza: "bg-emerald-500",
  Matemática: "bg-blue-500",
  Linguagens: "bg-amber-500",
  Humanas: "bg-rose-500",
  Redação: "bg-violet-500",
};

export const tree: { area: Area; subjects: { name: string; topics: string[] }[] }[] = [
  {
    area: "Matemática",
    subjects: [
      { name: "Matemática Básica", topics: ["Porcentagem", "Razão e proporção", "Regra de três"] },
      { name: "Funções", topics: ["Função do 1º grau", "Função do 2º grau", "Exponencial"] },
      { name: "Probabilidade", topics: ["Análise combinatória", "Probabilidade"] },
    ],
  },
  {
    area: "Natureza",
    subjects: [
      { name: "Biologia", topics: ["Citologia", "Metabolismo energético", "Ecologia"] },
      { name: "Física", topics: ["Ondulatória", "Cinemática", "Eletrodinâmica"] },
      { name: "Química", topics: ["Estequiometria", "Soluções", "Orgânica"] },
    ],
  },
  {
    area: "Humanas",
    subjects: [
      { name: "História", topics: ["História do Brasil", "Era Vargas"] },
      { name: "Geografia", topics: ["Clima", "Urbanização"] },
    ],
  },
  {
    area: "Linguagens",
    subjects: [{ name: "Português", topics: ["Interpretação de texto", "Funções da linguagem"] }],
  },
];

export const tasksToday = [
  { id: "t1", area: "Matemática" as Area, subject: "Funções", topic: "Função do 2º grau", hours: 1, doneMin: 25 },
  { id: "t2", area: "Natureza" as Area, subject: "Física", topic: "Ondulatória", hours: 1, doneMin: 0 },
  { id: "t3", area: "Natureza" as Area, subject: "Biologia", topic: "Metabolismo energético", hours: 0.5, doneMin: 30 },
  { id: "t4", area: "Humanas" as Area, subject: "História", topic: "História do Brasil", hours: 1, doneMin: 0 },
];

export const reviewsToday = [
  { id: "r1", topic: "Probabilidade", area: "Matemática" as Area, label: "Revisão 7 dias" },
  { id: "r2", topic: "Citologia", area: "Natureza" as Area, label: "Revisão 1 dia" },
];

export const goalsToday = [
  { label: "Horas de foco", value: 1.4, target: 3.5, unit: "h" },
  { label: "Questões", value: 22, target: 40, unit: "" },
  { label: "Aulas", value: 1, target: 2, unit: "" },
];

// D S T Q Q S S — true = estudou, null = futuro
export const week: (boolean | null)[] = [true, true, true, true, false, null, null];
export const todayIndex = 4;

export const weekHours = [
  { d: "Dom", h: 1.2 },
  { d: "Seg", h: 3.1 },
  { d: "Ter", h: 2.6 },
  { d: "Qua", h: 3.8 },
  { d: "Qui", h: 1.4 },
  { d: "Sex", h: 0 },
  { d: "Sáb", h: 0 },
];

export const hoursBySubject = [
  { name: "Matemática", h: 5.5, color: "var(--chart-1)" },
  { name: "Natureza", h: 4.2, color: "var(--chart-2)" },
  { name: "Humanas", h: 1.6, color: "var(--chart-4)" },
  { name: "Linguagens", h: 0.8, color: "var(--chart-3)" },
];

export const stats = {
  accuracy: 74,
  accuracyDelta: 6,
  weekVsLast: 18,
  groupRank: 2,
  groupSize: 6,
  recordHits: 132,
};

// XP ganho por dia na semana atual (Dom → Sáb); hoje = todayIndex.
export const xpWeek = [
  { d: "Dom", xp: 95 },
  { d: "Seg", xp: 240 },
  { d: "Ter", xp: 185 },
  { d: "Qua", xp: 310 },
  { d: "Qui", xp: 80 },
  { d: "Sex", xp: 0 },
  { d: "Sáb", xp: 0 },
];

// XP de hoje, hora a hora (para o gráfico "Dia").
export const xpToday = [
  { h: "8h", xp: 5 },
  { h: "9h", xp: 20 },
  { h: "10h", xp: 25 },
  { h: "11h", xp: 0 },
  { h: "14h", xp: 30 },
];

export const xpGoals = { day: 150, week: 1200 };
