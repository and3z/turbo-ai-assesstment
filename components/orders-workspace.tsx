"use client";

import { startTransition, useEffect, useRef, useState, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  calculateFinancialSnapshot,
  composeFinancialFields,
  isValidCoveragePercentage,
  roundFinancialValue,
} from "@/lib/order-financials";
import { loadOrdersFromStorage, saveOrdersToStorage } from "@/lib/order-storage";
import {
  buildVendorPayload,
  createEmptyOrder,
  formatTimestamp,
  getSendValidationErrors,
  materializeOrder,
  orderMatchesSearch,
  parseCsvOrders,
} from "@/lib/order-utils";
import type { Order, OrderDraft, PaymentState } from "@/types/order";

type FilterKey = "all" | "pendingPayment" | "awaitingShipment" | "completed";
type ViewMode = "operations" | "financials";
type FinancialField =
  | "financial_cost_per_unit"
  | "financial_billable_amount"
  | "financial_coverage_pct";
type FinancialDraft = Record<FinancialField, string>;
type ParsedFinancialValues = Record<FinancialField, number | null>;
type FinancialCalculationPreview = ReturnType<typeof calculateFinancialSnapshot> & { warnings: string[] };
type FinancialRollup = {
  ordersWithFinancialData: number;
  totalBillableAmount: number;
  totalPatientOwes: number;
  totalPayerCovers: number;
  totalEstimatedProfit: number;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function cloneOrder(order: Order): OrderDraft {
  return { ...order };
}

function toNumberOrNull(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidNumericInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return true;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed);
}

function formatEditableNumber(value: number | null, decimals: number) {
  if (value === null) {
    return "";
  }

  return value.toFixed(decimals);
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return "--";
  }

  return currencyFormatter.format(value);
}

function formatPercent(value: number | null, decimals = 1) {
  if (value === null) {
    return "--";
  }

  return `${roundFinancialValue(value, decimals).toFixed(decimals)}%`;
}

function createFinancialValues(order: Order): ParsedFinancialValues {
  return {
    financial_cost_per_unit: order.financial_cost_per_unit,
    financial_billable_amount: order.financial_billable_amount,
    financial_coverage_pct: order.financial_coverage_pct,
  };
}

function createFinancialDraft(order: Order): FinancialDraft {
  return {
    financial_cost_per_unit: formatEditableNumber(order.financial_cost_per_unit, 2),
    financial_billable_amount: formatEditableNumber(order.financial_billable_amount, 2),
    financial_coverage_pct: formatEditableNumber(order.financial_coverage_pct, 1),
  };
}

function parseFinancialDraft(draft: FinancialDraft): ParsedFinancialValues {
  return {
    financial_cost_per_unit: toNumberOrNull(draft.financial_cost_per_unit),
    financial_billable_amount: toNumberOrNull(draft.financial_billable_amount),
    financial_coverage_pct: toNumberOrNull(draft.financial_coverage_pct),
  };
}

function calculateFinancialPreview(values: ParsedFinancialValues): FinancialCalculationPreview {
  const snapshot = calculateFinancialSnapshot(values);
  const warnings: string[] = [];

  if (snapshot.estimatedProfit !== null && snapshot.estimatedProfit < 0) {
    warnings.push("Billable amount is below unit cost.");
  }

  if (!isValidCoveragePercentage(values.financial_coverage_pct)) {
    warnings.push("Coverage must stay between 0 and 100.");
  }

  return {
    ...snapshot,
    warnings,
  };
}

function buildFinancialRollup(sourceOrders: Order[]): FinancialRollup {
  return sourceOrders.reduce<FinancialRollup>(
    (summary, order) => {
      const values = createFinancialValues(order);
      const preview = calculateFinancialPreview(values);
      const hasFinancialData = Object.values(values).some((value) => value !== null);

      if (hasFinancialData) {
        summary.ordersWithFinancialData += 1;
      }

      summary.totalBillableAmount += values.financial_billable_amount ?? 0;
      summary.totalPatientOwes += preview.financial_patient_owes ?? 0;
      summary.totalPayerCovers += preview.financial_payer_covers ?? 0;
      summary.totalEstimatedProfit += preview.estimatedProfit ?? 0;

      return summary;
    },
    {
      ordersWithFinancialData: 0,
      totalBillableAmount: 0,
      totalPatientOwes: 0,
      totalPayerCovers: 0,
      totalEstimatedProfit: 0,
    },
  );
}

function hasFinancialChanges(order: Order, draft: FinancialDraft) {
  const parsed = parseFinancialDraft(draft);

  return (
    parsed.financial_cost_per_unit !== order.financial_cost_per_unit ||
    parsed.financial_billable_amount !== order.financial_billable_amount ||
    parsed.financial_coverage_pct !== order.financial_coverage_pct
  );
}

function getPatientFullName(order: Order) {
  return [order.patient_first_name, order.patient_last_name].filter(Boolean).join(" ") || "Draft order";
}

function matchesFilter(order: Order, filter: FilterKey) {
  if (filter === "pendingPayment") {
    return order.payment_state === "Waiting";
  }

  if (filter === "awaitingShipment") {
    return order.payment_state === "Paid" && order.vendor_state === "Waiting";
  }

  if (filter === "completed") {
    return order.vendor_state === "Sent";
  }

  return true;
}

export function OrdersWorkspace() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ROWS_PER_PAGE = 25;
  const [isHydrated, setIsHydrated] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("operations");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<OrderDraft | null>(null);
  const [financialDrafts, setFinancialDrafts] = useState<Record<string, FinancialDraft>>({});
  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(searchTerm);

  useEffect(() => {
    const storedOrders = loadOrdersFromStorage();
    setOrders(storedOrders);
    setIsHydrated(true);

    toast.info("Prototype mode: orders persist only in this browser and vendor sends can run in mocked webhook mode.");
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveOrdersToStorage(orders);
  }, [isHydrated, orders]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/");
    router.refresh();
  }

  function openCreateOrder() {
    setEditingDraft(createEmptyOrder(orders));
  }

  function openEditOrder(order: Order) {
    setEditingDraft(cloneOrder(order));
  }

  function closeEditor() {
    setEditingDraft(null);
  }

  function updatePaymentState(orderId: string, paymentState: PaymentState) {
    startTransition(() => {
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.order_id === orderId
            ? {
                ...order,
                payment_state: paymentState,
                updated_at: new Date().toISOString(),
              }
            : order,
        ),
      );
    });

    toast.info(`Payment status updated to ${paymentState}.`);
  }

  async function processFile(file: File) {
    setSelectedFileName(file.name);
    const csvText = await file.text();
    const summary = parseCsvOrders(csvText, orders);

    if (summary.importedOrders.length === 0) {
      toast.error(summary.issues[0] ?? "No orders were imported.");
      setImportSummary(null);
      setSelectedFileName(null);
      return;
    }

    startTransition(() => {
      setOrders((currentOrders) => [...summary.importedOrders, ...currentOrders]);
    });

    const issueCount = summary.issues.length;
    setImportSummary(
      `${summary.importedOrders.length} imported, ${summary.skippedRows} skipped${issueCount ? `, ${issueCount} rule notes` : ""}.`,
    );
    toast.success(`${summary.importedOrders.length} orders imported from ${file.name}.`);
    setIsImportOpen(false);
    setSelectedFileName(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      processFile(file);
    }
  }

  async function handleSaveOrder() {
    if (!editingDraft) {
      return;
    }

    if (!isValidCoveragePercentage(editingDraft.financial_coverage_pct)) {
      toast.error("Coverage must be between 0 and 100 before saving.");
      return;
    }

    setIsSaving(true);

    const nextOrder = materializeOrder(editingDraft, orders);

    startTransition(() => {
      setOrders((currentOrders) => {
        const exists = currentOrders.some((order) => order.order_id === nextOrder.order_id);

        if (!exists) {
          return [nextOrder, ...currentOrders];
        }

        return currentOrders.map((order) =>
          order.order_id === nextOrder.order_id ? nextOrder : order,
        );
      });
    });

    toast.success(`Order ${nextOrder.order_id} saved locally.`);
    setIsSaving(false);
    setEditingDraft(null);
  }

  async function confirmVendorSend() {
    if (!sendingOrderId) {
      return;
    }

    const order = orders.find((entry) => entry.order_id === sendingOrderId);

    if (!order) {
      setSendingOrderId(null);
      toast.error("The order could not be found.");
      return;
    }

    const validationErrors = getSendValidationErrors(order);

    if (validationErrors.length > 0) {
      setSendingOrderId(null);
      toast.error(validationErrors[0]);
      return;
    }

    setIsSending(true);
    const response = await fetch("/api/orders/send-to-vendor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildVendorPayload(order)),
    }).catch(() => null);

    if (!response?.ok) {
      setIsSending(false);
      setSendingOrderId(null);
      toast.error("The vendor webhook failed. The order stayed in Waiting.");
      return;
    }

    startTransition(() => {
      setOrders((currentOrders) =>
        currentOrders.map((entry) =>
          entry.order_id === sendingOrderId
            ? {
                ...entry,
                vendor_state: "Sent",
                updated_at: new Date().toISOString(),
              }
            : entry,
        ),
      );
    });

    setIsSending(false);
    setSendingOrderId(null);
    toast.success(`${order.order_id} was marked as Sent and routed to the vendor.`);
  }

  function updateFinancialField(order: Order, field: FinancialField, value: string) {
    setFinancialDrafts((currentDrafts) => {
      const currentDraft = currentDrafts[order.order_id] ?? createFinancialDraft(order);

      return {
        ...currentDrafts,
        [order.order_id]: {
          ...currentDraft,
          [field]: value,
        },
      };
    });
  }

  function saveFinancialDraft(order: Order) {
    const draft = financialDrafts[order.order_id];

    if (!draft) {
      return;
    }

    if (Object.values(draft).some((value) => !isValidNumericInput(value))) {
      toast.error("Review the financial inputs before saving. Only numeric values are allowed.");
      return;
    }

    const parsedDraft = parseFinancialDraft(draft);

    if (!isValidCoveragePercentage(parsedDraft.financial_coverage_pct)) {
      toast.error("Coverage must be between 0 and 100 before saving.");
      return;
    }

    if (!hasFinancialChanges(order, draft)) {
      setFinancialDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[order.order_id];
        return nextDrafts;
      });
      return;
    }

    startTransition(() => {
      setOrders((currentOrders) =>
        currentOrders.map((entry) =>
          entry.order_id === order.order_id
            ? {
                ...entry,
                ...composeFinancialFields(parsedDraft),
                updated_at: new Date().toISOString(),
              }
            : entry,
        ),
      );
    });

    setFinancialDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[order.order_id];
      return nextDrafts;
    });
    toast.success(`${order.order_id} financial values were saved.`);
  }

  const filteredOrders = orders
    .filter((order) => matchesFilter(order, activeFilter) && orderMatchesSearch(order, deferredSearch))
    .sort((a, b) => b.order_id.localeCompare(a.order_id));
  const financialRollup = buildFinancialRollup(filteredOrders);
  const editingFinancialPreview = editingDraft
    ? calculateFinancialPreview({
        financial_cost_per_unit: editingDraft.financial_cost_per_unit,
        financial_billable_amount: editingDraft.financial_billable_amount,
        financial_coverage_pct: editingDraft.financial_coverage_pct,
      })
    : null;

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ROWS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * ROWS_PER_PAGE;
  const visibleOrders = filteredOrders.slice(startIndex, startIndex + ROWS_PER_PAGE);
  const pendingCount = orders.filter((order) => order.payment_state === "Waiting").length;
  const awaitingShipmentCount = orders.filter(
    (order) => order.payment_state === "Paid" && order.vendor_state === "Waiting",
  ).length;
  const readyToSendCount = orders.filter(
    (order) =>
      order.payment_state === "Paid" &&
      order.vendor_state === "Waiting" &&
      getSendValidationErrors(order).length === 0,
  ).length;
  const sendingOrder = sendingOrderId
    ? orders.find((order) => order.order_id === sendingOrderId) ?? null
    : null;
  const directoryDescription =
    viewMode === "operations"
      ? "Manage and track high-density medical supply distributions across regional vendors."
      : "Manage and update financial data for medical supply distributions.";

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-4 py-2 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex flex-1 items-center gap-4 lg:gap-8">
            <div className="flex items-center gap-3">
              <BrandMark />
              <div>
                <p className="font-display text-[1.65rem] font-semibold tracking-[-0.04em] text-slate-900">
                  MedSupp
                </p>
              </div>
            </div>

            <label className="relative hidden max-w-[420px] flex-1 md:block">
              <SearchGlyph className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-11 w-full rounded border border-transparent bg-slate-100 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-sky focus:bg-white focus:ring-4 focus:ring-sky/10"
                onChange={(event) => { setSearchTerm(event.target.value); setCurrentPage(1); }}
                placeholder="Search orders, patients, or vendors..."
                type="search"
                value={searchTerm}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <nav className="hidden items-center gap-6 xl:flex">
              {/*<HeaderNavItem active={false} label="Inventory" />*/}
              <HeaderNavItem active label="Orders" />
              <HeaderNavItem active={false} label="Configs" />
              {/* <HeaderNavItem active={false} label="Analytics" />
              <HeaderNavItem active={false} label="Finances" />*/}
            </nav>
            <div className="hidden h-8 w-px bg-slate-200 xl:block" />
            <HeaderActionButton
              icon={<UploadGlyph className="h-4 w-4" />}
              label="Import CSV"
              onClick={() => {
                setImportSummary(null);
                setIsImportOpen(true);
              }}
              tone="secondary"
            />
            <HeaderActionButton
              icon={<PlusGlyph className="h-4 w-4" />}
              label="Create Order"
              onClick={openCreateOrder}
              tone="primary"
            />
            <button
              aria-label="Sign out"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-sky/15 bg-sky/10 text-sky transition hover:bg-sky/15"
              onClick={handleLogout}
              title="Sign out"
              type="button"
            >
              <UserGlyph className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-[1480px] px-4 pb-4 sm:px-6 md:hidden lg:px-8">
          <label className="relative block">
            <SearchGlyph className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-11 w-full rounded border border-transparent bg-slate-100 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-sky focus:bg-white focus:ring-4 focus:ring-sky/10"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search orders, patients, or vendors..."
              type="search"
              value={searchTerm}
            />
          </label>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl">
              Order Directory
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500 sm:text-base">
              {directoryDescription}
            </p>
          </div>

          {viewMode === "financials" ? (
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FinancialSummaryCard
                accent="text-sky"
                helper={`${financialRollup.ordersWithFinancialData} orders with financial data`}
                label="Billable Pipeline"
                value={formatCurrency(roundFinancialValue(financialRollup.totalBillableAmount))}
              />
              <FinancialSummaryCard
                accent="text-emerald-600"
                helper="Billable amount minus unit cost"
                label="Estimated Profit"
                value={formatCurrency(roundFinancialValue(financialRollup.totalEstimatedProfit))}
              />
              <FinancialSummaryCard
                accent="text-slate-700"
                helper="Current insurer responsibility"
                label="Payer Covers"
                value={formatCurrency(roundFinancialValue(financialRollup.totalPayerCovers))}
              />
              <FinancialSummaryCard
                accent="text-amber-600"
                helper="Current patient contribution"
                label="Patient Owes"
                value={formatCurrency(roundFinancialValue(financialRollup.totalPatientOwes))}
              />
            </section>
          ) : null}
        </div>

        <section className="overflow-hidden rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 pt-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-wrap gap-5 sm:gap-7">
                <FilterChip
                  active={activeFilter === "all"}
                  label="All Orders"
                  onClick={() => { setActiveFilter("all"); setCurrentPage(1); }}
                />
                <FilterChip
                  active={activeFilter === "pendingPayment"}
                  label="Pending Payment"
                  onClick={() => { setActiveFilter("pendingPayment"); setCurrentPage(1); }}
                />
                <FilterChip
                  active={activeFilter === "awaitingShipment"}
                  label="Awaiting Shipment"
                  onClick={() => { setActiveFilter("awaitingShipment"); setCurrentPage(1); }}
                />
                <FilterChip
                  active={activeFilter === "completed"}
                  label="Completed"
                  onClick={() => { setActiveFilter("completed"); setCurrentPage(1); }}
                />
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded bg-slate-100 p-1">
                  <ToggleChip
                    active={viewMode === "operations"}
                    label="Operations"
                    onClick={() => setViewMode("operations")}
                  />
                  <ToggleChip
                    active={viewMode === "financials"}
                    label="Financials"
                    onClick={() => setViewMode("financials")}
                  />
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  type="button"
                >
                  Date: Last 30 Days
                  <ChevronGlyph className="h-3.5 w-3.5" direction="down" />
                </button>
              </div>
            </div>
          </div>

          <div className="scrollbar-thin overflow-x-auto">
            <table className="min-w-[1320px] w-full border-collapse text-left">
              <thead className="border-b border-slate-200 bg-slate-50/80">
                <tr className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-5 py-2">Order ID</th>
                  <th className="px-5 py-2">Patient Name</th>
                  {viewMode === "operations" ? (
                    <>
                      <th className="px-5 py-2">Product Details</th>
                      <th className="px-5 py-2">Vendor Name</th>
                      <th className="px-5 py-2">Payment Status</th>
                      <th className="px-5 py-2 text-center">Vendor Status</th>
                    </>
                  ) : (
                    <>
                      <th className="px-5 py-2 text-right">Cost Per Unit</th>
                      <th className="px-5 py-2 text-right">Billable Amount</th>
                      <th className="px-5 py-2 text-right">Coverage (%)</th>
                      <th className="px-5 py-2 text-right">Margin (%)</th>
                      <th className="px-5 py-2 text-right">Patient Owes</th>
                      <th className="px-5 py-2 text-right">Payer Covers</th>
                    </>
                  )}
                  <th className="px-5 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => {
                  const storedDraft = financialDrafts[order.order_id];
                  const financialDraft = storedDraft ?? createFinancialDraft(order);
                  const parsedFinancialDraft = parseFinancialDraft(financialDraft);
                  const financialPreview = calculateFinancialPreview(parsedFinancialDraft);
                  const hasDraftChanges = storedDraft
                    ? hasFinancialChanges(order, financialDraft)
                    : false;
                  const hasDraftErrors = storedDraft
                    ? Object.values(financialDraft).some((value) => !isValidNumericInput(value)) ||
                      !isValidCoveragePercentage(parsedFinancialDraft.financial_coverage_pct)
                    : false;
                  const patientOwesValue = financialPreview.financial_patient_owes;

                  return (
                    <tr
                      className="border-b border-slate-200 text-sm text-slate-600 transition hover:bg-slate-50/60"
                      key={order.order_id}
                    >
                      <td className="px-5 py-2 align-middle">
                        <div>
                          <p className="font-semibold text-slate-900">#{order.order_id}</p>
                          <p className="mt-1 text-[11px] font-medium text-slate-400">
                            Updated {formatTimestamp(order.updated_at)}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-2 align-middle">
                        <div>
                          <p className="font-medium text-slate-700">{getPatientFullName(order)}</p>
                          {viewMode === "operations" ? (
                            <p className="mt-1 max-w-[18rem] truncate text-xs text-slate-400">
                              {order.shipping_address || "Shipping address missing"}
                            </p>
                          ) : null}
                        </div>
                      </td>

                      {viewMode === "operations" ? (
                        <>
                          <td className="px-5 py-2 align-middle font-medium text-slate-600">
                            {order.product_details || "--"}
                          </td>
                          <td className="px-5 py-2 align-middle">
                            <div>
                              <p className="font-medium text-slate-600">
                                {order.vendor_name || "--"}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {order.vendor_email || "Vendor email missing"}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-2 align-middle">
                            <div className="relative inline-flex">
                              <select
                                className={`appearance-none rounded-full border px-8 py-2 text-xs font-semibold outline-none transition ${
                                  order.payment_state === "Paid"
                                    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                    : "border-amber-200 bg-amber-100 text-amber-700"
                                }`}
                                disabled={order.vendor_state === "Sent"}
                                onChange={(event) =>
                                  updatePaymentState(order.order_id, event.target.value as PaymentState)
                                }
                                value={order.payment_state}
                              >
                                <option value="Waiting">Waiting</option>
                                <option value="Paid">Paid</option>
                              </select>
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-current">
                                <ChevronGlyph className="h-3 w-3" direction="down" />
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-2 align-middle text-center">
                            {order.vendor_state === "Sent" ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                                <CheckGlyph className="h-4 w-4" />
                                Sent
                              </span>
                            ) : order.payment_state !== "Paid" ? (
                              <span className="text-xs font-medium text-slate-400">Waiting</span>
                            ) : (
                              <button
                                className="inline-flex min-w-28 items-center justify-center rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                                onClick={() => setSendingOrderId(order.order_id)}
                                type="button"
                              >
                                Send
                              </button>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-5 py-2 align-middle text-right">
                            <FinancialInput
                              align="right"
                              ariaLabel={`Cost per unit for ${order.order_id}`}
                              onChange={(value) =>
                                updateFinancialField(order, "financial_cost_per_unit", value)
                              }
                              prefix="$"
                              value={financialDraft.financial_cost_per_unit}
                            />
                          </td>
                          <td className="px-5 py-2 align-middle text-right">
                            <FinancialInput
                              align="right"
                              ariaLabel={`Billable amount for ${order.order_id}`}
                              onChange={(value) =>
                                updateFinancialField(order, "financial_billable_amount", value)
                              }
                              prefix="$"
                              value={financialDraft.financial_billable_amount}
                            />
                          </td>
                          <td className="px-5 py-2 align-middle text-right">
                            <FinancialInput
                              align="right"
                              ariaLabel={`Coverage for ${order.order_id}`}
                              onChange={(value) =>
                                updateFinancialField(order, "financial_coverage_pct", value)
                              }
                              suffix="%"
                              value={financialDraft.financial_coverage_pct}
                            />
                          </td>
                          <td className="px-5 py-2 align-middle text-right">
                            <p className="font-semibold text-slate-700">
                              {formatPercent(financialPreview.financial_margin)}
                            </p>
                          </td>
                          <td className="px-5 py-2 align-middle text-right">
                            <p
                              className={`font-semibold ${
                                patientOwesValue !== null && patientOwesValue > 0
                                  ? "text-amber-700"
                                  : "text-emerald-600"
                              }`}
                            >
                              {formatCurrency(financialPreview.financial_patient_owes)}
                            </p>
                          </td>
                          <td className="px-5 py-2 align-middle text-right">
                            <p className="font-semibold text-slate-700">
                              {formatCurrency(financialPreview.financial_payer_covers)}
                            </p>
                          </td>
                        </>
                      )}

                      <td className="px-5 py-2 text-right align-middle">
                        {viewMode === "operations" ? (
                          <button
                            className="text-xs font-bold tracking-[0.12em] text-sky transition hover:text-tide"
                            onClick={() => openEditOrder(order)}
                            type="button"
                          >
                            EDIT
                          </button>
                        ) : (
                          <div className="ml-auto flex max-w-[15rem] flex-col items-end gap-1.5">
                            <button
                              className={`rounded px-4 py-2 text-xs font-bold transition ${
                                hasDraftChanges && !hasDraftErrors
                                  ? "border border-sky/30 bg-white text-sky hover:border-sky hover:bg-sky/5"
                                  : "cursor-not-allowed border border-transparent bg-slate-100 text-slate-300"
                              }`}
                              disabled={!hasDraftChanges || hasDraftErrors}
                              onClick={() => saveFinancialDraft(order)}
                              type="button"
                            >
                              SAVE
                            </button>
                            <div className="space-y-0.5 text-right text-[11px] font-medium leading-4 text-slate-400">
                              {financialPreview.warnings[0] ? (
                                <p className="text-amber-600">{financialPreview.warnings[0]}</p>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm font-medium text-slate-500">
              No orders match the current filters.
            </div>
          ) : (
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/60 px-5 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Showing {startIndex + 1}–{Math.min(startIndex + ROWS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} orders
              </span>
              <div className="flex items-center gap-1">
                <button
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition ${safePage <= 1 ? "text-slate-300 cursor-not-allowed" : "text-slate-500 hover:bg-slate-200"}`}
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  <ChevronGlyph className="h-3.5 w-3.5" direction="left" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-xs font-bold transition ${page === safePage ? "bg-sky text-white" : "text-slate-500 hover:bg-slate-200"}`}
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    type="button"
                  >
                    {page}
                  </button>
                ))}
                <button
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition ${safePage >= totalPages ? "text-slate-300 cursor-not-allowed" : "text-slate-500 hover:bg-slate-200"}`}
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  type="button"
                >
                  <ChevronGlyph className="h-3.5 w-3.5" direction="right" />
                </button>
              </div>
            </div>
          )}
        </section>
      </section>

      {isImportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
          <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" style={{ maxHeight: "80vh" }}>
            {/* Modal Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-8 py-5">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Bulk CSV Import</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Centralize your Excel records into the distribution platform.
                </p>
              </div>
              <button
                className="text-slate-400 transition-colors hover:text-slate-600"
                onClick={() => {
                  setIsImportOpen(false);
                  setSelectedFileName(null);
                  setImportSummary(null);
                }}
                type="button"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content — Two Columns */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="grid gap-8 lg:grid-cols-2">
                {/* Left Column — Upload Zone */}
                <div className="flex flex-col gap-6">
                  {/* Drag & Drop Zone */}
                  <div
                    className={`group flex flex-1 flex-col items-center justify-center gap-5 rounded-xl border-2 border-dashed px-8 py-12 transition-colors ${
                      isDragOver
                        ? "border-sky bg-sky/5"
                        : "border-slate-300 bg-slate-50 hover:border-sky/50"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky/10 text-sky transition-transform group-hover:scale-110">
                      <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                      </svg>
                    </div>
                    <div className="space-y-1.5 text-center">
                      <p className="text-base font-bold tracking-tight text-slate-900">
                        Drag and drop your .csv file here, or{" "}
                        <span
                          className="cursor-pointer text-sky hover:underline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          browse
                        </span>
                      </p>
                      <p className="text-xs font-medium text-slate-500">
                        .CSV format only. Maximum file size 10MB.
                      </p>
                    </div>
                    <button
                      className="mt-2 flex min-w-[120px] cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-bold text-slate-900 shadow-sm transition-all hover:bg-slate-50"
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
                      Select File
                    </button>
                  </div>

                  <input
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleFileSelection}
                    ref={fileInputRef}
                    type="file"
                  />

                  {/* Upload Progress */}
                  <div className="space-y-2">
                    <div className="flex items-end justify-between">
                      <p className="text-sm font-semibold text-slate-700">Upload Progress</p>
                      <span className="text-xs font-medium italic text-slate-400">
                        {selectedFileName ?? "No file selected"}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-sky/20 transition-all duration-500"
                        style={{ width: importSummary ? "100%" : "0%" }}
                      />
                    </div>
                  </div>

                  {importSummary ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                      {importSummary}
                    </div>
                  ) : null}
                </div>

                {/* Right Column — Required Fields & Info */}
                <div className="flex flex-col gap-5">
                  {/* Required Fields */}
                  <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Required Headers</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "patient_first_name",
                        "patient_last_name",
                        "shipping_address",
                        "product_details",
                        "vendor_name",
                        "vendor_email",
                        "financial_cost_per_unit",
                        "financial_billable_amount",
                        "financial_coverage_pct",
                      ].map((field) => (
                        <span
                          className="inline-block rounded bg-slate-200/70 px-2 py-1 text-xs font-semibold text-slate-700"
                          key={field}
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Optional Fields */}
                  <div className="mt-1">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Optional Columns</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["payment_state", "vendor_state"].map((field) => (
                        <span
                          className="inline-block rounded bg-sky/10 px-2 py-1 text-xs font-semibold text-sky"
                          key={field}
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Guidance Note */}
                  <div className="flex gap-3 rounded-lg border border-sky/10 bg-sky/5 p-4">
                    <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-sky" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                    <p className="text-xs leading-relaxed text-slate-600">
                      Margin, patient responsibility, and payer coverage are derived automatically when the CSV is processed.
                    </p>
                  </div>

                  {/* Download Template Button */}
                  <a
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-sky hover:text-sky"
                    download
                    href="/template.csv"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download Template
                  </a>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-shrink-0 justify-end gap-3 border-t border-slate-100 bg-slate-50 px-8 py-5">
              <button
                className="rounded-lg px-6 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
                onClick={() => {
                  setIsImportOpen(false);
                  setSelectedFileName(null);
                  setImportSummary(null);
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="flex items-center gap-2 rounded-lg bg-sky px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky/20 transition-all hover:bg-tide"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Upload &amp; Process
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingDraft ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm">
          <div className="scrollbar-thin h-full w-full max-w-2xl overflow-y-auto border-l border-white/70 bg-white shadow-panel">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Order editor
                  </p>
                  <h3 className="mt-2 font-display text-3xl font-semibold text-ink">
                    {editingDraft.order_id ?? "New order"}
                  </h3>
                </div>
                <button
                  className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                  onClick={closeEditor}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-8 px-6 py-6">
              <section className="space-y-4">
                <SectionLabel title="Patient and shipping" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldLabel label="First name">
                    <input
                      className="field-input"
                      onChange={(event) =>
                        setEditingDraft((current) =>
                          current ? { ...current, patient_first_name: event.target.value } : current,
                        )
                      }
                      type="text"
                      value={editingDraft.patient_first_name}
                    />
                  </FieldLabel>
                  <FieldLabel label="Last name">
                    <input
                      className="field-input"
                      onChange={(event) =>
                        setEditingDraft((current) =>
                          current ? { ...current, patient_last_name: event.target.value } : current,
                        )
                      }
                      type="text"
                      value={editingDraft.patient_last_name}
                    />
                  </FieldLabel>
                </div>

                <FieldLabel label="Shipping address">
                  <textarea
                    className="field-input min-h-28 resize-y"
                    onChange={(event) =>
                      setEditingDraft((current) =>
                        current ? { ...current, shipping_address: event.target.value } : current,
                      )
                    }
                    value={editingDraft.shipping_address}
                  />
                </FieldLabel>
              </section>

              <section className="space-y-4">
                <SectionLabel title="Product and vendor" />
                <FieldLabel label="Product details">
                  <textarea
                    className="field-input min-h-28 resize-y"
                    onChange={(event) =>
                      setEditingDraft((current) =>
                        current ? { ...current, product_details: event.target.value } : current,
                      )
                    }
                    value={editingDraft.product_details}
                  />
                </FieldLabel>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldLabel label="Vendor name">
                    <input
                      className="field-input"
                      onChange={(event) =>
                        setEditingDraft((current) =>
                          current ? { ...current, vendor_name: event.target.value } : current,
                        )
                      }
                      type="text"
                      value={editingDraft.vendor_name}
                    />
                  </FieldLabel>
                  <FieldLabel label="Vendor email">
                    <input
                      className="field-input"
                      onChange={(event) =>
                        setEditingDraft((current) =>
                          current ? { ...current, vendor_email: event.target.value } : current,
                        )
                      }
                      type="email"
                      value={editingDraft.vendor_email}
                    />
                  </FieldLabel>
                </div>
              </section>

              <section className="space-y-4 rounded border border-slate-200 bg-mist p-5">
                <SectionLabel title="Financial inputs" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldLabel label="Cost per unit">
                    <input
                      className="field-input"
                      onChange={(event) =>
                        setEditingDraft((current) =>
                          current
                            ? {
                                ...current,
                                financial_cost_per_unit: toNumberOrNull(event.target.value),
                              }
                            : current,
                        )
                      }
                      type="number"
                      value={editingDraft.financial_cost_per_unit ?? ""}
                    />
                  </FieldLabel>
                  <FieldLabel label="Billable amount">
                    <input
                      className="field-input"
                      onChange={(event) =>
                        setEditingDraft((current) =>
                          current
                            ? {
                                ...current,
                                financial_billable_amount: toNumberOrNull(event.target.value),
                              }
                            : current,
                        )
                      }
                      type="number"
                      value={editingDraft.financial_billable_amount ?? ""}
                    />
                  </FieldLabel>
                  <FieldLabel label="Coverage (%)">
                    <input
                      className="field-input"
                      onChange={(event) =>
                        setEditingDraft((current) =>
                          current
                            ? {
                                ...current,
                                financial_coverage_pct: toNumberOrNull(event.target.value),
                              }
                            : current,
                        )
                      }
                      type="number"
                      value={editingDraft.financial_coverage_pct ?? ""}
                    />
                  </FieldLabel>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <ReadOnlyFinancialField
                    label="Margin (%)"
                    tone="neutral"
                    value={formatPercent(editingFinancialPreview?.financial_margin ?? null)}
                  />
                  <ReadOnlyFinancialField
                    label="Patient owes"
                    tone="warning"
                    value={formatCurrency(editingFinancialPreview?.financial_patient_owes ?? null)}
                  />
                  <ReadOnlyFinancialField
                    label="Payer covers"
                    tone="positive"
                    value={formatCurrency(editingFinancialPreview?.financial_payer_covers ?? null)}
                  />
                </div>
                {editingFinancialPreview?.warnings[0] ? (
                  <p className="text-xs font-medium text-amber-700">
                    {editingFinancialPreview.warnings[0]}
                  </p>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldLabel label="Payment state">
                    <select
                      className="field-input"
                      onChange={(event) =>
                        setEditingDraft((current) =>
                          current
                            ? {
                                ...current,
                                payment_state: event.target.value as PaymentState,
                                vendor_state:
                                  event.target.value === "Waiting" ? "Waiting" : current.vendor_state,
                              }
                            : current,
                        )
                      }
                      value={editingDraft.payment_state}
                    >
                      <option value="Waiting">Waiting</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </FieldLabel>
                  <FieldLabel label="Vendor state">
                    <select
                      className="field-input"
                      disabled={editingDraft.payment_state === "Waiting"}
                      onChange={(event) =>
                        setEditingDraft((current) =>
                          current
                            ? { ...current, vendor_state: event.target.value as Order["vendor_state"] }
                            : current,
                        )
                      }
                      value={editingDraft.vendor_state}
                    >
                      <option value="Waiting">Waiting</option>
                      <option value="Sent">Sent</option>
                    </select>
                  </FieldLabel>
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
              <button
                className="rounded border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-ink"
                onClick={closeEditor}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-tide disabled:cursor-wait disabled:opacity-75"
                disabled={isSaving}
                onClick={handleSaveOrder}
                type="button"
              >
                {isSaving ? "Saving..." : "Save order"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sendingOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded border border-white/70 bg-white p-8 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Send to vendor
            </p>
            <h3 className="mt-2 font-display text-3xl font-semibold text-ink">
              Confirm order shipment
            </h3>
            <div className="mt-6 grid gap-4 rounded border border-slate-200 bg-mist p-5 text-sm text-slate-600">
              <div>
                <span className="font-semibold text-ink">Order:</span> {sendingOrder.order_id}
              </div>
              <div>
                <span className="font-semibold text-ink">Patient:</span>{" "}
                {sendingOrder.patient_first_name} {sendingOrder.patient_last_name}
              </div>
              <div>
                <span className="font-semibold text-ink">Vendor:</span> {sendingOrder.vendor_name}
              </div>
              <div>
                <span className="font-semibold text-ink">Product:</span>{" "}
                {sendingOrder.product_details}
              </div>
            </div>

            {getSendValidationErrors(sendingOrder).length > 0 ? (
              <div className="mt-5 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This order still has missing send requirements:
                <ul className="mt-2 list-disc pl-5">
                  {getSendValidationErrors(sendingOrder).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-5 rounded border border-sky/20 bg-sky/10 px-4 py-3 text-sm text-tide">
                Financial fields will be excluded from the payload before the request goes to
                Make.com.
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-ink"
                onClick={() => setSendingOrderId(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-tide disabled:cursor-wait disabled:opacity-75"
                disabled={isSending || getSendValidationErrors(sendingOrder).length > 0}
                onClick={confirmVendorSend}
                type="button"
              >
                {isSending ? "Sending..." : "Confirm and send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function MetricCard({
  accent,
  label,
  value,
}: {
  accent: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-2 font-display text-2xl font-semibold tracking-[-0.04em] ${accent}`}>
        {value}
      </p>
    </div>
  );
}

function FinancialSummaryCard({
  accent,
  helper,
  label,
  value,
}: {
  accent: string;
  helper: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-2 font-display text-2xl font-semibold tracking-[-0.04em] ${accent}`}>
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-slate-400">{helper}</p>
    </div>
  );
}

function ReadOnlyFinancialField({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "neutral" | "positive" | "warning";
  value: string;
}) {
  const textTone =
    tone === "positive" ? "text-emerald-600" : tone === "warning" ? "text-amber-700" : "text-slate-700";

  return (
    <div className="rounded border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${textTone}`}>{value}</p>
    </div>
  );
}

function HeaderNavItem({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`text-sm font-semibold transition ${
        active ? "text-sky" : "text-slate-500 hover:text-slate-900"
      }`}
    >
      {label}
    </span>
  );
}

function HeaderActionButton({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: "primary" | "secondary";
}) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded px-4 py-2.5 text-sm font-bold transition ${
        tone === "primary"
          ? "bg-sky text-white hover:bg-tide"
          : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function ToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`rounded px-4 py-1.5 text-xs font-bold transition ${
        active
          ? "bg-white text-sky shadow-sm"
          : "text-slate-500 hover:text-slate-900"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`border-b-2 pb-4 text-sm font-bold transition ${
        active
          ? "border-sky text-sky"
          : "border-transparent text-slate-500 hover:text-slate-900"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function StatusPill({
  icon,
  label,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  tone: "success" | "locked";
}) {
  return (
    <span
      className={`inline-flex min-w-28 items-center justify-center gap-1.5 rounded px-4 py-2 text-xs font-bold ${
        tone === "success"
          ? "bg-emerald-100 text-emerald-700"
          : "border border-slate-200 bg-slate-100 text-slate-400"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}

function FinancialInput({
  align,
  ariaLabel,
  onChange,
  prefix,
  suffix,
  tone = "neutral",
  value,
}: {
  align: "left" | "right";
  ariaLabel: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  tone?: "neutral" | "positive" | "warning";
  value: string;
}) {
  const valueToneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-600"
        : "text-slate-700";

  return (
    <label className={`inline-flex items-center gap-1 text-sm font-semibold ${valueToneClass}`}>
      {prefix ? <span className="text-xs text-slate-400">{prefix}</span> : null}
      <input
        aria-label={ariaLabel}
        className={`h-10 w-24 rounded border border-transparent bg-transparent px-2 text-sm font-semibold outline-none transition hover:border-slate-200 focus:border-sky focus:bg-white focus:ring-2 focus:ring-sky/10 ${
          align === "right" ? "text-right" : "text-left"
        }`}
        inputMode="decimal"
        onChange={(event) => onChange(event.target.value)}
        step="0.01"
        type="number"
        value={value}
      />
      {suffix ? <span className="text-xs text-slate-400">{suffix}</span> : null}
    </label>
  );
}

function BrandMark() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded bg-sky text-white shadow-sm">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 20 20">
        <path
          d="M10 3.25a.75.75 0 0 1 .75.75V9.25H16a.75.75 0 0 1 0 1.5H10.75V16a.75.75 0 0 1-1.5 0v-5.25H4a.75.75 0 0 1 0-1.5h5.25V4a.75.75 0 0 1 .75-.75Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 20 20">
      <path
        d="M8.75 3.5a5.25 5.25 0 1 0 0 10.5a5.25 5.25 0 0 0 0-10.5Zm0 12a6.75 6.75 0 1 1 4.245-11.998A6.75 6.75 0 0 1 8.75 15.5Zm5.78-.28a.75.75 0 0 1 1.06 0l1.69 1.69a.75.75 0 1 1-1.06 1.06l-1.69-1.69a.75.75 0 0 1 0-1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlusGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 20 20">
      <path
        d="M10 4.25a.75.75 0 0 1 .75.75v4.25H15a.75.75 0 0 1 0 1.5h-4.25V15a.75.75 0 0 1-1.5 0v-4.25H5a.75.75 0 0 1 0-1.5h4.25V5a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function UploadGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 20 20">
      <path
        d="M10 2.75a.75.75 0 0 1 .75.75v6.69l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72V3.5a.75.75 0 0 1 .75-.75ZM4.5 13.25a.75.75 0 0 1 .75.75v1.25c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25V14a.75.75 0 0 1 1.5 0v1.25A1.75 1.75 0 0 1 14 17H5.5a1.75 1.75 0 0 1-1.75-1.75V14a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function UserGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 20 20">
      <path
        d="M10 3.5a3.25 3.25 0 1 0 0 6.5a3.25 3.25 0 0 0 0-6.5Zm-5.25 12a4.5 4.5 0 1 1 9 0a.75.75 0 0 1-1.5 0a3 3 0 0 0-6 0a.75.75 0 0 1-1.5 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChevronGlyph({
  className,
  direction,
}: {
  className?: string;
  direction: "down" | "left" | "right";
}) {
  const rotation =
    direction === "down" ? "" : direction === "left" ? "rotate-90" : "-rotate-90";

  return (
    <svg className={`${className ?? ""} ${rotation}`.trim()} fill="none" viewBox="0 0 20 20">
      <path
        d="M5.47 7.97a.75.75 0 0 1 1.06 0L10 11.44l3.47-3.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 0-1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 20 20">
      <path
        d="M14.78 6.97a.75.75 0 0 1 0 1.06l-5.5 5.5a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47l4.97-4.97a.75.75 0 0 1 1.06 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LockGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 20 20">
      <path
        d="M6.75 8V6.75a3.25 3.25 0 1 1 6.5 0V8h.25A1.75 1.75 0 0 1 15.25 9.75v4.5A1.75 1.75 0 0 1 13.5 16h-7A1.75 1.75 0 0 1 4.75 14.25v-4.5A1.75 1.75 0 0 1 6.5 8h.25Zm1.5 0h3.5V6.75a1.75 1.75 0 1 0-3.5 0V8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
    </div>
  );
}

function FieldLabel({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
