import type { EffectAction } from "./operation-types";

export interface EffectRecord {
  id: string;
  entityType: string;
  entityId: string;
  action: EffectAction;
  before?: Record<string, unknown>;
  after: Record<string, unknown>;
}
