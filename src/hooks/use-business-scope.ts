import { useActiveBusinessId } from "@/stores/business-context-store";
import {
  BUSINESS_GOALS_BLOCKED_MESSAGE,
  BUSINESS_WRITE_BLOCKED_MESSAGE,
  canWriteForBusiness,
  withBusinessQuery,
} from "@/lib/business-units";

export function useBusinessScope() {
  const activeBusinessId = useActiveBusinessId();
  const canWrite = canWriteForBusiness(activeBusinessId);

  return {
    activeBusinessId,
    canWrite,
    withQuery: (url: string) => withBusinessQuery(url, activeBusinessId),
    writeBlockedMessage: BUSINESS_WRITE_BLOCKED_MESSAGE,
    goalsBlockedMessage: BUSINESS_GOALS_BLOCKED_MESSAGE,
  };
}
