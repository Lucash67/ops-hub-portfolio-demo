import type { OperationSource } from "./operation-types";

export interface OperationOptions {
  force: boolean;
  dryRun: boolean;
}

export interface OperationContext {
  businessId: string;
  userId?: string;
  correlationId: string;
  source: OperationSource;
  options: OperationOptions;
}

export const DEFAULT_OPERATION_OPTIONS: OperationOptions = {
  force: false,
  dryRun: false,
};

export const DEFAULT_BUSINESS_ID = "salgados";
