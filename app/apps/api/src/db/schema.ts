import { date, doublePrecision, index, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  contract: text('contract').notNull(),
  cutoff: date('cutoff', { mode: 'string' }).notNull(),
});

/** Project-level operation state per module (spec MOD-02). Catalog manifests live in code. */
export const projectModules = pgTable(
  'project_modules',
  {
    projectId: text('project_id').notNull().references(() => projects.id),
    moduleKey: text('module_key').notNull(),
    state: text('state').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [primaryKey({ columns: [t.projectId, t.moduleKey] })],
);

/** Decision log for module state changes (spec MOD-03: record the decision). */
export const moduleStateChanges = pgTable('module_state_changes', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  moduleKey: text('module_key').notNull(),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  reason: text('reason'),
  actor: text('actor').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

export const scurvePoints = pgTable(
  'scurve_points',
  {
    projectId: text('project_id').notNull().references(() => projects.id),
    pointDate: date('point_date', { mode: 'string' }).notNull(),
    plan: doublePrecision('plan'),
    forecast: doublePrecision('forecast'),
    actual: doublePrecision('actual'),
  },
  t => [primaryKey({ columns: [t.projectId, t.pointDate] })],
);

export const workPackages = pgTable(
  'work_packages',
  {
    projectId: text('project_id').notNull().references(() => projects.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    weight: doublePrecision('weight'),
    lastWeekPlan: doublePrecision('last_week_plan'),
    lastWeekActual: doublePrecision('last_week_actual'),
    achievedPlan: doublePrecision('achieved_plan'),
    achievedActual: doublePrecision('achieved_actual'),
    thisWeekPlan: doublePrecision('this_week_plan'),
    thisWeekActual: doublePrecision('this_week_actual'),
  },
  t => [primaryKey({ columns: [t.projectId, t.code] })],
);

export const procurementPackages = pgTable(
  'procurement_packages',
  {
    projectId: text('project_id').notNull().references(() => projects.id),
    id: text('id').notNull(),
    code: text('code').notNull(),
    discipline: text('discipline'),
    description: text('description'),
    vendorCode: text('vendor_code'),
    vendor: text('vendor'),
    origins: text('origins'),
    loaNo: text('loa_no'),
    loaDate: date('loa_date', { mode: 'string' }),
    poNo: text('po_no'),
    poDate: date('po_date', { mode: 'string' }),
    buyer: text('buyer'),
    expeditor: text('expeditor'),
    pe: text('pe'),
    vqc: text('vqc'),
    status: text('status').notNull(),
  },
  t => [primaryKey({ columns: [t.projectId, t.id] }), index('procurement_discipline_idx').on(t.projectId, t.discipline)],
);

export const expeditingPackages = pgTable(
  'expediting_packages',
  {
    projectId: text('project_id').notNull().references(() => projects.id),
    id: text('id').notNull(),
    discipline: text('discipline').notNull(),
    code: text('code').notNull(),
    name: text('name'),
    vendor: text('vendor'),
    status: text('status').notNull(),
    planPct: doublePrecision('plan_pct'),
    actualPct: doublePrecision('actual_pct'),
    variance: doublePrecision('variance'),
    rosDate: date('ros_date', { mode: 'string' }),
    /** Discipline-specific fields (stage progress, highlights, shipment text). */
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  },
  t => [primaryKey({ columns: [t.projectId, t.id] }), index('expediting_discipline_idx').on(t.projectId, t.discipline)],
);

/** Personal tasks (Personal workspace). Owner is a placeholder until identity (spec §2) lands. */
export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  title: text('title').notNull(),
  note: text('note'),
  due: date('due', { mode: 'string' }).notNull(),
  priority: text('priority').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
