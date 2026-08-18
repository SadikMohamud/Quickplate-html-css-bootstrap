// ================================================================
// v2 STUB: analytics
//
// Not implemented in v1. Nothing imports this module yet.
//
// v2 plan: since stamp_events is append-only, analytics are pure
// queries over the log. Add SQL views for the metrics below, plus a
// charts page on the owner dashboard.
// ================================================================

export interface AnalyticsSummary {
  stampsPerWeek: { weekStarting: string; stamps: number }[];
  redemptionRate: number;
  activeCustomers30d: number;
  returningCustomers30d: number;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  throw new Error("Analytics are planned for v2");
}
