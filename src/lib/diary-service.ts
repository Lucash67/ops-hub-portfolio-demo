import type { OperationalDiaryEntry } from "@/lib/diary/types";
import {
  deleteDiaryEntryRecord,
  getDiaryEntryRecord,
  listDiaryEntryRecords,
  upsertDiaryEntryRecord,
} from "@/platform/db/repositories/diary-repository";

export async function getDiaryEntry(
  businessId: string,
  date: string,
): Promise<(OperationalDiaryEntry & { id: string; createdAt: string }) | null> {
  return getDiaryEntryRecord(businessId, date);
}

export async function listDiaryEntries(
  businessId: string,
  from?: string,
  to?: string,
): Promise<Array<OperationalDiaryEntry & { id: string; createdAt: string }>> {
  return listDiaryEntryRecords(businessId, from, to);
}

export async function upsertDiaryEntry(entry: OperationalDiaryEntry): Promise<{ id: string }> {
  return upsertDiaryEntryRecord(entry);
}

export async function deleteDiaryEntry(businessId: string, date: string): Promise<boolean> {
  return deleteDiaryEntryRecord(businessId, date);
}
