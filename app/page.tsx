import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export default async function LoginPage() {
  const cookieStore = await cookies();

  if (cookieStore.get(AUTH_COOKIE_NAME)?.value === "1") {
    redirect("/orders");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f3f5f7] px-6 py-12">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.94),rgba(243,245,247,0.98)_36%,rgba(235,239,244,1))]" />
      <div className="absolute inset-0 -z-10 opacity-50 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute inset-x-0 top-[-10rem] -z-10 mx-auto h-80 w-80 rounded-full bg-primary/10 blur-3xl" />

      <section className="w-full max-w-[25rem]">
        <LoginForm />
      </section>
    </main>
  );
}
