import type { OperationSource, PayloadType, StructuredPayload } from "./operation-types";

export interface OperationInput {
  id: string;
  source: OperationSource;
  rawPayload: string;
  payloadType: PayloadType;
  structuredPayload?: StructuredPayload;
  receivedAt: string;
  businessId: string;
}
