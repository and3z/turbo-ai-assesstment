import { seedOrders } from "@/lib/demo-data";
import { normalizeOrderFinancials } from "@/lib/order-financials";
import type { Order } from "@/types/order";

const STORAGE_KEY = "medsupp-prototype-orders";

export function loadOrdersFromStorage(): Order[] {
  if (typeof window === "undefined") {
    return seedOrders;
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);

  if (!storedValue) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedOrders));
    return seedOrders;
  }

  try {
    const parsed = JSON.parse(storedValue) as Order[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed.map(normalizeOrderFinancials)
      : seedOrders;
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedOrders));
    return seedOrders;
  }
}

export function saveOrdersToStorage(orders: Order[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders.map(normalizeOrderFinancials)));
}
