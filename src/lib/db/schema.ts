import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const businessUnits = sqliteTable("business_units", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businessUnits.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: real("price").notNull(),
  cost: real("cost").notNull(),
  supplierId: text("supplier_id").references(() => suppliers.id),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  soldQuantity: integer("sold_quantity").notNull().default(0),
  minStock: integer("min_stock").notNull().default(10),
  imageUrl: text("image_url"),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .default("salgados")
    .references(() => businessUnits.id),
  name: text("name").notNull(),
  sector: text("sector"),
  company: text("company"),
  phone: text("phone"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const sales = sqliteTable("sales", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businessUnits.id),
  date: text("date").notNull(),
  time: text("time").notNull(),
  clientId: text("client_id").references(() => clients.id),
  department: text("department"),
  paymentMethod: text("payment_method", {
    enum: ["pix", "card", "cash"],
  }).notNull(),
  paymentStatus: text("payment_status", {
    enum: ["paid", "pending", "partial"],
  })
    .notNull()
    .default("paid"),
  amountReceived: real("amount_received"),
  paymentDate: text("payment_date"),
  totalAmount: real("total_amount").notNull(),
  totalCost: real("total_cost").notNull(),
  profit: real("profit").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const saleItems = sqliteTable("sale_items", {
  id: text("id").primaryKey(),
  saleId: text("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  unitCost: real("unit_cost").notNull(),
  subtotal: real("subtotal").notNull(),
  profit: real("profit").notNull(),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  saleId: text("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  method: text("method", { enum: ["pix", "card", "cash"] }).notNull(),
  amount: real("amount").notNull(),
  createdAt: text("created_at").notNull(),
});

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businessUnits.id),
  type: text("type", {
    enum: ["daily", "weekly", "monthly", "yearly"],
  }).notNull(),
  targetAmount: real("target_amount").notNull(),
  targetUnits: integer("target_units"),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const stockMovements = sqliteTable("stock_movements", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  type: text("type", { enum: ["entry", "exit", "adjustment"] }).notNull(),
  quantity: integer("quantity").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
});

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

/** Bloco de notas pessoal (estilo Keep). */
export const stickyNotes = sqliteTable("sticky_notes", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  businessId: text("business_id"),
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  color: text("color").notNull().default("default"),
  noteDate: text("note_date"),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  clientUpdatedAt: text("client_updated_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const investments = sqliteTable("investments", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().default("salgados"),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  type: text("type", { enum: ["initial", "additional", "withdrawal"] }).notNull(),
  date: text("date").notNull(),
  sourceType: text("source_type", {
    enum: ["own_capital", "family", "partner", "investor", "supplier", "loan", "other"],
  }),
  sourceName: text("source_name"),
  createdAt: text("created_at").notNull(),
});

export const cashFlow = sqliteTable("cash_flow", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  createdAt: text("created_at").notNull(),
});

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  type: text("type", {
    enum: ["daily", "weekly", "monthly", "yearly"],
  }).notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  data: text("data").notNull(),
  createdAt: text("created_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const operationalLosses = sqliteTable("operational_losses", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businessUnits.id),
  date: text("date").notNull(),
  productId: text("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const dailyPurchases = sqliteTable("daily_purchases", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businessUnits.id),
  date: text("date").notNull(),
  totalUnits: integer("total_units").notNull(),
  investment: real("investment").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const dailyPurchaseItems = sqliteTable("daily_purchase_items", {
  id: text("id").primaryKey(),
  purchaseId: text("purchase_id")
    .notNull()
    .references(() => dailyPurchases.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitCost: real("unit_cost"),
});

export const operationalActions = sqliteTable("operational_actions", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businessUnits.id),
  date: text("date").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status", { enum: ["planned", "in_progress", "done"] })
    .notNull()
    .default("planned"),
  source: text("source").notNull().default("diary"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const productHypotheses = sqliteTable("product_hypotheses", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businessUnits.id),
  date: text("date").notNull(),
  flavor: text("flavor").notNull(),
  hypothesis: text("hypothesis").notNull(),
  confirmed: integer("confirmed", { mode: "boolean" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const operationalLessons = sqliteTable("operational_lessons", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businessUnits.id),
  date: text("date").notNull(),
  content: text("content").notNull(),
  tags: text("tags"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type BusinessUnit = typeof businessUnits.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type OperationalLoss = typeof operationalLosses.$inferSelect;
export type DailyPurchase = typeof dailyPurchases.$inferSelect;
export type DailyPurchaseItem = typeof dailyPurchaseItems.$inferSelect;
export type OperationalAction = typeof operationalActions.$inferSelect;
export type ProductHypothesis = typeof productHypotheses.$inferSelect;
export type OperationalLesson = typeof operationalLessons.$inferSelect;
export type Investment = typeof investments.$inferSelect;
export type CashFlowEntry = typeof cashFlow.$inferSelect;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type User = typeof users.$inferSelect;

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull(),
});

export * from "@/platform/db/schema-operations";
