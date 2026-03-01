import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { OrdersWorkspace } from "@/components/orders-workspace";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export default async function OrdersPage() {
  const cookieStore = await cookies();

  if (cookieStore.get(AUTH_COOKIE_NAME)?.value !== "1") {
    redirect("/");
  }

  return <OrdersWorkspace />;
}
