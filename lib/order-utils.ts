import type {
  CsvImportSummary,
  Order,
  OrderDraft,
  PaymentState,
  SendableOrderPayload,
  VendorState,
} from "@/types/order";
import { composeFinancialFields } from "@/lib/order-financials";

const REQUIRED_CSV_HEADERS = [
  "patient_first_name",
  "patient_last_name",
  "shipping_address",
  "product_details",
  "vendor_name",
  "vendor_email",
  "financial_cost_per_unit",
  "financial_billable_amount",
  "financial_coverage_pct",
] as const;

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCurrency(value: string) {
  const normalized = value.replaceAll("$", "").replaceAll("%", "").replaceAll(",", "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePaymentState(value: string): PaymentState {
  return value.trim().toLowerCase() === "paid" ? "Paid" : "Waiting";
}

export function normalizeVendorState(value: string): VendorState {
  return value.trim().toLowerCase() === "sent" ? "Sent" : "Waiting";
}

export function createOrderId(existingOrders: Order[]) {
  const highestId = existingOrders.reduce((maxValue, order) => {
    const numericValue = Number.parseInt(order.order_id.replace("ORD-", ""), 10);
    return Number.isFinite(numericValue) ? Math.max(maxValue, numericValue) : maxValue;
  }, 0);

  return `ORD-${String(highestId + 1).padStart(5, "0")}`;
}

export function createEmptyOrder(existingOrders: Order[]): OrderDraft {
  const timestamp = new Date().toISOString();
  return {
    order_id: createOrderId(existingOrders),
    patient_first_name: "",
    patient_last_name: "",
    shipping_address: "",
    product_details: "",
    vendor_name: "",
    vendor_email: "",
    financial_margin: null,
    financial_cost_per_unit: null,
    financial_billable_amount: null,
    financial_coverage_pct: null,
    financial_patient_owes: null,
    payment_state: "Waiting",
    vendor_state: "Waiting",
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function materializeOrder(draft: OrderDraft, existingOrders: Order[]): Order {
  const timestamp = new Date().toISOString();
  const orderId = draft.order_id?.trim() || createOrderId(existingOrders);

  return {
    order_id: orderId,
    patient_first_name: draft.patient_first_name.trim(),
    patient_last_name: draft.patient_last_name.trim(),
    shipping_address: draft.shipping_address.trim(),
    product_details: draft.product_details.trim(),
    vendor_name: draft.vendor_name.trim(),
    vendor_email: draft.vendor_email.trim(),
    ...composeFinancialFields({
      financial_cost_per_unit: draft.financial_cost_per_unit,
      financial_billable_amount: draft.financial_billable_amount,
      financial_coverage_pct: draft.financial_coverage_pct,
    }),
    payment_state: draft.payment_state,
    vendor_state:
      draft.payment_state === "Waiting" && draft.vendor_state === "Sent"
        ? "Waiting"
        : draft.vendor_state,
    created_at: draft.created_at ?? timestamp,
    updated_at: timestamp,
  };
}

export function parseCsvOrders(csvText: string, existingOrders: Order[]): CsvImportSummary {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      importedOrders: [],
      totalRows: 0,
      skippedRows: 0,
      issues: ["CSV is empty or missing data rows."],
    };
  }

  const headerLine = splitCsvLine(lines[0]).map((column) => column.trim());
  const missingHeaders = REQUIRED_CSV_HEADERS.filter((header) => !headerLine.includes(header));
  const importedOrders: Order[] = [];
  const issues: string[] = [];
  let skippedRows = 0;

  if (missingHeaders.length > 0) {
    return {
      importedOrders,
      totalRows: lines.length - 1,
      skippedRows: lines.length - 1,
      issues: [`Missing required headers: ${missingHeaders.join(", ")}`],
    };
  }

  let workingOrders = [...existingOrders];

  for (let index = 1; index < lines.length; index += 1) {
    const rowValues = splitCsvLine(lines[index]);
    const rowData = Object.fromEntries(
      headerLine.map((header, columnIndex) => [header, rowValues[columnIndex] ?? ""]),
    ) as Record<string, string>;

    const requiredPreview = [
      rowData.patient_first_name,
      rowData.patient_last_name,
      rowData.product_details,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!requiredPreview) {
      skippedRows += 1;
      issues.push(`Row ${index + 1} skipped because it does not include usable order data.`);
      continue;
    }

    const timestamp = new Date().toISOString();
    const order: Order = {
      order_id: createOrderId(workingOrders),
      patient_first_name: rowData.patient_first_name.trim(),
      patient_last_name: rowData.patient_last_name.trim(),
      shipping_address: rowData.shipping_address.trim(),
      product_details: rowData.product_details.trim(),
      vendor_name: rowData.vendor_name.trim(),
      vendor_email: rowData.vendor_email.trim(),
      ...composeFinancialFields({
        financial_cost_per_unit: parseCurrency(rowData.financial_cost_per_unit),
        financial_billable_amount: parseCurrency(rowData.financial_billable_amount),
        financial_coverage_pct: parseCurrency(rowData.financial_coverage_pct),
      }),
      payment_state: normalizePaymentState(rowData.payment_state ?? ""),
      vendor_state: normalizeVendorState(rowData.vendor_state ?? ""),
      created_at: timestamp,
      updated_at: timestamp,
    };

    if (order.payment_state === "Waiting" && order.vendor_state === "Sent") {
      order.vendor_state = "Waiting";
      issues.push(`Row ${index + 1} was reset to Vendor=Waiting because payment is not Paid.`);
    }

    workingOrders = [...workingOrders, order];
    importedOrders.push(order);
  }

  return {
    importedOrders,
    totalRows: lines.length - 1,
    skippedRows,
    issues,
  };
}

export function getSendValidationErrors(order: Order) {
  const errors: string[] = [];

  if (order.payment_state !== "Paid") {
    errors.push("Payment must be marked as Paid before sending.");
  }

  if (!order.patient_first_name.trim()) {
    errors.push("First name is required.");
  }

  if (!order.patient_last_name.trim()) {
    errors.push("Last name is required.");
  }

  if (!order.shipping_address.trim()) {
    errors.push("Shipping address is required.");
  }

  if (!order.product_details.trim()) {
    errors.push("Product details are required.");
  }

  if (!order.vendor_name.trim()) {
    errors.push("Vendor name is required.");
  }

  if (!order.vendor_email.trim()) {
    errors.push("Vendor email is required.");
  }

  return errors;
}

export function buildVendorPayload(order: Order): SendableOrderPayload {
  return {
    order_id: order.order_id,
    patient_first_name: order.patient_first_name,
    patient_last_name: order.patient_last_name,
    shipping_address: order.shipping_address,
    product_details: order.product_details,
    vendor_name: order.vendor_name,
    vendor_email: order.vendor_email,
    timestamp: new Date().toISOString(),
  };
}

export function orderMatchesSearch(order: Order, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();

  if (!query) {
    return true;
  }

  const haystack = [
    order.order_id,
    order.patient_first_name,
    order.patient_last_name,
    order.product_details,
    order.vendor_name,
    order.vendor_email,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export function formatCurrency(value: number | null) {
  if (value === null) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
