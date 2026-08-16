import {
  averageTicket,
  recurringCustomerCount,
  sumRevenue,
  uniqueCustomerCount,
} from "../aggregates";
import type { ClientKpis, KpiDataset } from "../types";

export function computeClientKpis(dataset: KpiDataset): ClientKpis {
  const unique = uniqueCustomerCount(dataset.sales);
  const recurring = recurringCustomerCount(dataset.sales);
  const totalRevenue = sumRevenue(dataset.sales);

  return {
    unique,
    recurring,
    recurrenceRate: unique > 0 ? (recurring / unique) * 100 : 0,
    averageTicketPerClient: unique > 0 ? totalRevenue / unique : 0,
  };
}

export function averageTicketPerClient(dataset: KpiDataset): number {
  const unique = uniqueCustomerCount(dataset.sales);
  return unique > 0 ? averageTicket(sumRevenue(dataset.sales), unique) : 0;
}
