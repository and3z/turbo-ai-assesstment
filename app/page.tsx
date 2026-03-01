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
        <header className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/80 bg-primary/12 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)]">
            <svg
              aria-hidden="true"
              className="h-7 w-7 text-primary"
              fill="none"
              viewBox="0 0 24 24"
            >
              <rect
                height="15"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.8"
                width="15"
                x="4.5"
                y="4.5"
              />
              <path
                d="M12 8.25v7.5M8.25 12h7.5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
              />
            </svg>
          </div>

          <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-slate-900">
            Medical Logistics
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Supply Chain Distribution Management
          </p>
        </header>

        <LoginForm />
      </section>
    </main>
  );
}
