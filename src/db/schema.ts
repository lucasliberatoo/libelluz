import {
  boolean,
  jsonb,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/* ---------- Auth.js ---------- */

export const users = pgTable("users", {
  id: id(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  petName: text("pet_name").notNull().default("Brasa"),
  enemDate: date("enem_date"),
  // Metas pessoais (editáveis em Config)
  waterGoal: integer("water_goal").notNull().default(8),
  readingGoalMin: integer("reading_goal_min").notNull().default(30),
  focusGoalMin: integer("focus_goal_min").notNull().default(180),
  questionsGoal: integer("questions_goal").notNull().default(30),
  dailyXpGoal: integer("daily_xp_goal").notNull().default(150),
  weeklyXpGoal: integer("weekly_xp_goal").notNull().default(900),
  // Cronograma: minutos disponíveis por dia da semana (Dom..Sáb). 0 = sem estudo.
  weekMinutes: jsonb("week_minutes").$type<number[]>().notNull().default([0, 180, 180, 180, 180, 180, 120]),
  // Dia de descanso semanal (0 = domingo), null = nenhum. Não quebra a sequência.
  restDay: integer("rest_day").default(0),
  // Redação: "fixo" (sorteia no dia escolhido) ou "semana" (tema da semana, sorteado na segunda)
  essayRhythm: text("essay_rhythm").notNull().default("semana"),
  essayDay: integer("essay_day").notNull().default(6),
  // Fase 3
  petAccessory: text("pet_accessory"), // acessório equipado no foguinho
  privacy: jsonb("privacy").$type<{ hideAccuracy?: boolean; hideHours?: boolean; hideFeed?: boolean; hideStudyingNow?: boolean }>().notNull().default({}),
  notifPrefs: jsonb("notif_prefs").$type<{ off?: string[]; quietStart?: number; quietEnd?: number }>().notNull().default({}),
  achievementsCheckedAt: timestamp("achievements_checked_at", { mode: "date" }),
  lastLevelSeen: integer("last_level_seen").notNull().default(1),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ---------- Convites ---------- */

export const invites = pgTable("invites", {
  code: text("code").primaryKey(),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  usedBy: text("used_by").references(() => users.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/* ---------- Árvore de estudos: Área → Disciplina → Tópico → Habilidade ---------- */

export const studyNodes = pgTable(
  "study_nodes",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    level: text("level", { enum: ["area", "subject", "topic", "skill"] }).notNull(),
    area: text("area").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    phase: text("phase"), // Nivelamento, Básico I, Básico II, Construção, Ataque
    relevance: text("relevance"),
    theory: boolean("theory").notNull().default(false),
    practice: boolean("practice").notNull().default(false),
    mastery: boolean("mastery").notNull().default(false),
  },
  (t) => [index("study_nodes_user_idx").on(t.userId, t.parentId)],
);

/* ---------- Foco ---------- */

export const focusSessions = pgTable(
  "focus_sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nodeId: text("node_id").references(() => studyNodes.id, { onDelete: "set null" }),
    area: text("area").notNull(),
    subject: text("subject").notNull(),
    topic: text("topic").notNull(),
    kind: text("kind").notNull(),
    method: text("method").notNull(),
    plannedMin: integer("planned_min").notNull(),
    startedAt: timestamp("started_at", { mode: "date" }).notNull(),
    pausedAt: timestamp("paused_at", { mode: "date" }),
    pausedMs: integer("paused_ms").notNull().default(0),
    endedAt: timestamp("ended_at", { mode: "date" }),
    durationMin: real("duration_min"),
    day: date("day"), // dia (America/Sao_Paulo) em que a sessão começou
    questionsDone: integer("questions_done"),
    questionsCorrect: integer("questions_correct"),
    mood: integer("mood"),
    notes: text("notes"),
  },
  (t) => [index("focus_user_day_idx").on(t.userId, t.day)],
);

/* ---------- XP ---------- */

export const xpEvents = pgTable(
  "xp_events",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    at: timestamp("at", { mode: "date" }).notNull().defaultNow(),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    // Chave para não dar o mesmo bônus duas vezes (ex.: "login:2026-10-06")
    dedupe: text("dedupe"),
  },
  (t) => [index("xp_user_day_idx").on(t.userId, t.day), uniqueIndex("xp_dedupe_idx").on(t.userId, t.dedupe)],
);

/* ---------- Tarefas do dia ---------- */

export const dailyTasks = pgTable(
  "daily_tasks",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    title: text("title").notNull(),
    nodeId: text("node_id").references(() => studyNodes.id, { onDelete: "set null" }),
    area: text("area"),
    plannedMin: integer("planned_min"),
    done: boolean("done").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("tasks_user_day_idx").on(t.userId, t.day)],
);

/* ---------- Hábitos ---------- */

export const habitLogs = pgTable(
  "habit_logs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    waterCups: integer("water_cups").notNull().default(0),
    mood: integer("mood"),
    journal: text("journal"),
    // Foto do dia, já comprimida no navegador (JPEG em data URL, ~100–200 KB). Vai para o R2 na Fase 2.
    photo: text("photo"),
    readingMin: integer("reading_min").notNull().default(0),
    exercise: boolean("exercise").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

/* ---------- Cronograma (Fase 2) ---------- */

// Bloco = tópico da árvore + duração, num dia. Sem horários.
export const scheduleBlocks = pgTable(
  "schedule_blocks",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    nodeId: text("node_id").references(() => studyNodes.id, { onDelete: "set null" }),
    area: text("area").notNull(),
    subject: text("subject").notNull(),
    topic: text("topic").notNull(),
    kind: text("kind", { enum: ["study", "review"] }).notNull().default("study"),
    plannedMin: integer("planned_min").notNull(),
    // minutos de foco já feitos neste bloco (o Foco preenche sozinho)
    doneMin: real("done_min").notNull().default(0),
    doneAt: timestamp("done_at", { mode: "date" }),
    reviewId: text("review_id"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("blocks_user_day_idx").on(t.userId, t.day)],
);

// Revisão espaçada de um tópico: 1 → 7 → 30 dias, ajustada pelo acerto.
export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nodeId: text("node_id").references(() => studyNodes.id, { onDelete: "cascade" }),
    area: text("area").notNull(),
    subject: text("subject").notNull(),
    topic: text("topic").notNull(),
    dueDay: date("due_day").notNull(),
    step: integer("step").notNull().default(0), // 0 = 1ª revisão (1 dia), 1 = 7 dias, 2 = 30 dias, 3+ = manutenção
    intervalDays: integer("interval_days").notNull().default(1),
    lastAccuracy: integer("last_accuracy"),
    doneAt: timestamp("done_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("reviews_user_due_idx").on(t.userId, t.dueDay)],
);

/* ---------- Simulados e ENEMs antigos ---------- */

export const exams = pgTable("exams", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["simulado", "enem"] }).notNull(),
  name: text("name").notNull(),
  source: text("source"),
  // ENEM antigo: chave da lista pré-cadastrada (ex.: "2023-regular-1")
  enemKey: text("enem_key"),
  url: text("url"),
  materialId: text("material_id"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const examParts = pgTable(
  "exam_parts",
  {
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    part: text("part", { enum: ["natureza", "matematica", "linguagens", "humanas", "redacao"] }).notNull(),
    day: date("day").notNull(),
    correct: integer("correct"), // de 45
    total: integer("total").notNull().default(45),
    minutes: integer("minutes"),
    essayScore: integer("essay_score"), // 0–1000
    competencies: jsonb("competencies").$type<number[]>(), // C1–C5 (0–200)
  },
  (t) => [primaryKey({ columns: [t.examId, t.part] })],
);

/* ---------- Redação ---------- */

export const essayThemes = pgTable("essay_themes", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  axis: text("axis").notNull(), // educação, saúde, tecnologia, meio ambiente, sociedade, economia, cultura
  source: text("source"),
  notes: text("notes"),
  status: text("status", { enum: ["stock", "drawn", "accepted", "done"] }).notNull().default("stock"),
  passCount: integer("pass_count").notNull().default(0),
  drawnAt: timestamp("drawn_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const essays = pgTable("essays", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  themeId: text("theme_id").references(() => essayThemes.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  day: date("day").notNull(),
  score: integer("score"),
  competencies: jsonb("competencies").$type<number[]>(),
  errorTags: jsonb("error_tags").$type<string[]>().notNull().default([]),
  comments: text("comments"),
  text: text("text"),
  photo: text("photo"),
  materialId: text("material_id"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/* ---------- Banco de questões ---------- */

export const questions = pgTable(
  "questions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    area: text("area").notNull(),
    subject: text("subject"),
    topic: text("topic"),
    nodeId: text("node_id").references(() => studyNodes.id, { onDelete: "set null" }),
    statement: text("statement").notNull(),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    alternatives: jsonb("alternatives").$type<string[]>().notNull().default([]),
    answer: integer("answer"), // índice da alternativa correta
    explanation: text("explanation"),
    source: text("source"),
    visibility: text("visibility", { enum: ["private", "group", "global"] }).notNull().default("private"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("questions_user_idx").on(t.userId)],
);

export const questionAttempts = pgTable(
  "question_attempts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    correct: boolean("correct").notNull(),
    at: timestamp("at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("attempts_user_q_idx").on(t.userId, t.questionId)],
);

/* ---------- Materiais (PDF, vídeo, áudio, links) ---------- */

export const materials = pgTable(
  "materials",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind", { enum: ["pdf", "video", "audio", "image", "link", "book", "other"] }).notNull(),
    // "aula" aparece em Aulas/Estrutura (no tópico); "material" na sub-aba Materiais
    section: text("section", { enum: ["aula", "material"] }).notNull().default("material"),
    area: text("area"),
    subject: text("subject"),
    nodeId: text("node_id").references(() => studyNodes.id, { onDelete: "set null" }),
    url: text("url"), // link externo (YouTube, Drive…)
    storageKey: text("storage_key"), // arquivo no R2
    size: integer("size"),
    mime: text("mime"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("materials_user_idx").on(t.userId)],
);

/* ---------- Notas da sessão de foco (nota, insight, áudio, checklist) ---------- */

export const focusNotes = pgTable(
  "focus_notes",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => focusSessions.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["note", "insight", "audio", "check"] }).notNull(),
    text: text("text"),
    // nota em áudio: data URL (webm/opus, poucos minutos)
    audio: text("audio"),
    done: boolean("done").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("focus_notes_session_idx").on(t.sessionId), index("focus_notes_user_idx").on(t.userId)],
);

/* ---------- Fase 3: foguinho, conquistas, grupos, notificações ---------- */

// Calor do foguinho que não dá para derivar do histórico (ex.: pausa de respiração).
export const heatEvents = pgTable(
  "heat_events",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    dedupe: text("dedupe"),
    at: timestamp("at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("heat_user_day_idx").on(t.userId, t.day), uniqueIndex("heat_dedupe_idx").on(t.userId, t.dedupe)],
);

export const achievements = pgTable(
  "achievements",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    tier: integer("tier").notNull().default(1), // estrelas (1–3)
    unlockedAt: timestamp("unlocked_at", { mode: "date" }).notNull().defaultNow(),
    seenAt: timestamp("seen_at", { mode: "date" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key, t.tier] })],
);

// Posts manuais do feed (as sessões de foco e conquistas entram no feed direto das suas tabelas).
export const feedPosts = pgTable(
  "feed_posts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text"),
    photo: text("photo"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("feed_posts_created_idx").on(t.createdAt)],
);

// Alvo de reação/comentário: "session" (focus_sessions.id), "post" (feed_posts.id) ou "achievement" ("userId:key:tier").
export const feedReactions = pgTable(
  "feed_reactions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetKind, t.targetId, t.emoji] }), index("reactions_target_idx").on(t.targetKind, t.targetId)],
);

export const feedComments = pgTable(
  "feed_comments",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("comments_target_idx").on(t.targetKind, t.targetId)],
);

export const pokes = pgTable(
  "pokes",
  {
    id: id(),
    fromId: text("from_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toId: text("to_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pokes_once_a_day_idx").on(t.fromId, t.toId, t.day)],
);

// Missões cooperativas (grupo inteiro ou dupla).
export const missions = pgTable("missions", {
  id: id(),
  title: text("title").notNull(),
  metric: text("metric", { enum: ["hours", "questions", "sessions", "days"] }).notNull(),
  target: real("target").notNull(),
  startDay: date("start_day").notNull(),
  endDay: date("end_day").notNull(),
  // vazio = grupo inteiro; com ids = dupla/trio
  memberIds: jsonb("member_ids").$type<string[]>().notNull().default([]),
  xp: integer("xp").notNull().default(100),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh"),
    auth: text("auth"),
    platform: text("platform").notNull().default("web"), // web | android
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("push_user_idx").on(t.userId)],
);

// Caixa de notificações (o sino). O push é só a entrega; tudo fica registrado aqui.
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url"),
    dedupe: text("dedupe"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    readAt: timestamp("read_at", { mode: "date" }),
    pushedAt: timestamp("pushed_at", { mode: "date" }),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt), uniqueIndex("notifications_dedupe_idx").on(t.userId, t.dedupe)],
);

/* ---------- Modo Disciplina (bloqueio de apps no APK) ---------- */

// Uma linha por pessoa: os apps escolhidos e as regras dos tokens.
export const disciplineSettings = pgTable("discipline_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  // [{ pkg: "com.instagram.android", label: "Instagram" }]
  apps: jsonb("apps").$type<{ pkg: string; label: string }[]>().notNull().default([]),
  baseTokens: integer("base_tokens").notNull().default(3),
  minutesPerToken: integer("minutes_per_token").notNull().default(10),
  blockNotifications: boolean("block_notifications").notNull().default(true),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// Log de uso: um registro por token gasto. `clientId` é o id gerado no celular (evita duplicar
// quando a fila é sincronizada duas vezes).
export const tokenSpends = pgTable(
  "token_spends",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    at: timestamp("at", { mode: "date" }).notNull().defaultNow(),
    pkg: text("pkg").notNull(),
    label: text("label").notNull(),
    minutes: integer("minutes").notNull(),
    clientId: text("client_id").notNull(),
  },
  (t) => [index("spends_user_day_idx").on(t.userId, t.day), uniqueIndex("spends_client_idx").on(t.userId, t.clientId)],
);
