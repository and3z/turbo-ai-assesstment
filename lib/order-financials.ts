import type { Order } from "@/types/order";

export type FinancialInputFields = Pick<
  Order,
  "financial_cost_per_unit" | "financial_billable_amount" | "financial_coverage_pct"
>;

export type FinancialSnapshot = {
  estimatedProfit: number | null;
  financial_margin: number | null;
  financial_patient_owes: number | null;
  financial_payer_covers: number | null;
};

export function roundFinancialValue(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function isValidCoveragePercentage(value: number | null) {
  return value === null || (value >= 0 && value <= 100);
}

export function deriveCoveragePercentage(
  billableAmount: number | null,
  patientOwes: number | null,
) {
  if (
    billableAmount === null ||
    patientOwes === null ||
    billableAmount <= 0 ||
    patientOwes < 0 ||
    patientOwes > billableAmount
  ) {
    return null;
  }

  return roundFinancialValue(((billableAmount - patientOwes) / billableAmount) * 100, 1);
}

export function calculateFinancialSnapshot(inputs: FinancialInputFields): FinancialSnapshot {
  const costPerUnit = inputs.financial_cost_per_unit;
  const billableAmount = inputs.financial_billable_amount;
  const coveragePct = isValidCoveragePercentage(inputs.financial_coverage_pct)
    ? inputs.financial_coverage_pct
    : null;

  const estimatedProfit =
    costPerUnit !== null && billableAmount !== null
      ? roundFinancialValue(billableAmount - costPerUnit)
      : null;
  const financial_margin =
    costPerUnit !== null && billableAmount !== null && billableAmount !== 0
      ? roundFinancialValue(((billableAmount - costPerUnit) / billableAmount) * 100, 1)
      : null;
  const financial_patient_owes =
    billableAmount !== null && coveragePct !== null
      ? roundFinancialValue(billableAmount * (1 - coveragePct / 100))
      : null;
  const financial_payer_covers =
    billableAmount !== null && financial_patient_owes !== null
      ? roundFinancialValue(billableAmount - financial_patient_owes)
      : null;

  return {
    estimatedProfit,
    financial_margin,
    financial_patient_owes,
    financial_payer_covers,
  };
}

export function composeFinancialFields(inputs: FinancialInputFields) {
  const snapshot = calculateFinancialSnapshot(inputs);

  return {
    financial_cost_per_unit: inputs.financial_cost_per_unit,
    financial_billable_amount: inputs.financial_billable_amount,
    financial_coverage_pct: isValidCoveragePercentage(inputs.financial_coverage_pct)
      ? inputs.financial_coverage_pct
      : null,
    financial_margin: snapshot.financial_margin,
    financial_patient_owes: snapshot.financial_patient_owes,
  };
}

export function normalizeOrderFinancials(order: Order): Order {
  const financial_coverage_pct =
    order.financial_coverage_pct ??
    deriveCoveragePercentage(order.financial_billable_amount, order.financial_patient_owes);

  return {
    ...order,
    ...composeFinancialFields({
      financial_cost_per_unit: order.financial_cost_per_unit,
      financial_billable_amount: order.financial_billable_amount,
      financial_coverage_pct,
    }),
  };
}
