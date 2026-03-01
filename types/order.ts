export type PaymentState = "Waiting" | "Paid";
export type VendorState = "Waiting" | "Sent";

export type Order = {
  order_id: string;
  patient_first_name: string;
  patient_last_name: string;
  shipping_address: string;
  product_details: string;
  vendor_name: string;
  vendor_email: string;
  financial_margin: number | null;
  financial_cost_per_unit: number | null;
  financial_billable_amount: number | null;
  financial_coverage_pct: number | null;
  financial_patient_owes: number | null;
  payment_state: PaymentState;
  vendor_state: VendorState;
  created_at: string;
  updated_at: string;
};

export type OrderDraft = Omit<Order, "order_id" | "created_at" | "updated_at"> & {
  order_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type SendableOrderPayload = {
  order_id: string;
  patient_first_name: string;
  patient_last_name: string;
  shipping_address: string;
  product_details: string;
  vendor_name: string;
  vendor_email: string;
  timestamp: string;
};

export type CsvImportSummary = {
  importedOrders: Order[];
  totalRows: number;
  skippedRows: number;
  issues: string[];
};
