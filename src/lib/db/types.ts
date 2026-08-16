import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  businesses,
  products,
  clients,
  sales,
  saleItems,
  goals,
  appSettings,
  operationDays,
  stockMovements,
  diaryEntries,
} from "@/lib/db/postgres/schema";

export type BusinessRow = InferSelectModel<typeof businesses>;
export type ProductRow = InferSelectModel<typeof products>;
export type ClientRow = InferSelectModel<typeof clients>;
export type SaleRow = InferSelectModel<typeof sales>;
export type SaleItemRow = InferSelectModel<typeof saleItems>;
export type GoalRow = InferSelectModel<typeof goals>;
export type AppSettingRow = InferSelectModel<typeof appSettings>;
export type OperationDayRow = InferSelectModel<typeof operationDays>;
export type StockMovementRow = InferSelectModel<typeof stockMovements>;
export type DiaryEntryRow = InferSelectModel<typeof diaryEntries>;

export type ProductInsert = InferInsertModel<typeof products>;
export type ClientInsert = InferInsertModel<typeof clients>;
export type SaleInsert = InferInsertModel<typeof sales>;

/** Shape legado exposto pela API (compatível SQLite + Postgres). */
export interface LegacyProduct {
  id: string;
  businessId: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  supplierId?: string | null;
  stockQuantity: number;
  soldQuantity: number;
  minStock: number;
  imageUrl: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface LegacyClient {
  id: string;
  businessId?: string;
  name: string;
  sector: string | null;
  company: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LegacySale {
  id: string;
  businessId: string;
  date: string;
  time: string;
  clientId: string | null;
  department: string | null;
  paymentMethod: string | null;
  paymentStatus: string;
  amountReceived: number;
  paymentDate?: string | null;
  settlementDate?: string | null;
  totalAmount: number;
  totalCost: number;
  profit: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LegacyGoal {
  id: string;
  businessId: string;
  type: "daily" | "weekly" | "monthly" | "yearly";
  targetAmount: number;
  targetUnits: number | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  updatedAt: string;
}

export type { InferSelectModel, InferInsertModel };
