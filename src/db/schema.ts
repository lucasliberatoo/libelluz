import {
  boolean,
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
