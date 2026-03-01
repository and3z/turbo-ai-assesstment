"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ passcode }),
    }).catch(() => null);

    if (!response?.ok) {
      setErrorMessage("The passcode is incorrect. Use the shared internal credential.");
      setIsSubmitting(false);
      return;
    }

    router.push("/orders");
    router.refresh();
  }

  return (
    <div>
      <section className="rounded-2xl border border-slate-200/90 bg-white px-6 py-8 shadow-[0_28px_60px_-36px_rgba(15,23,42,0.28)] sm:px-8">
        <div className="mb-6">
          <h2 className="text-[1.7rem] font-semibold tracking-[-0.03em] text-slate-900">
            Global Login
          </h2>
          <p className="mt-2 max-w-[30ch] text-sm leading-6 text-slate-500">
            Enter your secure passcode to access the internal distribution dashboard.
          </p>
        </div>

        <div className="relative mb-6 h-32 overflow-hidden rounded-2xl border border-[#d5e7ff] bg-gradient-to-r from-[#edf5ff] via-[#c7ddff] to-[#9fc3ff]">
          <div className="absolute inset-y-0 right-16 w-1 bg-white/75" />
          <div className="absolute inset-y-0 right-10 w-1 bg-white/50" />
          <div className="absolute right-0 top-0 h-full w-28 bg-gradient-to-bl from-[#5e9df3]/35 to-transparent" />
          <div className="absolute left-[22%] top-1/2 h-14 w-40 -translate-y-1/2 rounded-md border border-[#a9caff] bg-white/70 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.45)] backdrop-blur-sm" />
          <div className="absolute left-[calc(22%+1rem)] top-1/2 -translate-y-1/2 text-center text-[#5f87c2]">
            <p className="text-sm font-extrabold uppercase tracking-[0.18em]">Medical</p>
            <p className="-mt-1 text-sm font-extrabold uppercase tracking-[0.18em]">Agility</p>
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.26em]">
              Supply Chain
            </p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">Global Passcode</span>
            <span className="relative block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M8.25 10V7.75a3.75 3.75 0 1 1 7.5 0V10M7 10h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </span>
              <input
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                onChange={(event) => setPasscode(event.target.value)}
                placeholder="••••••••"
                type="password"
                value={passcode}
              />
            </span>
          </label>

          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-sm font-semibold text-white shadow-[0_12px_26px_-18px_rgba(58,154,255,0.8)] transition hover:bg-primary-strong disabled:cursor-wait disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            <span>{isSubmitting ? "Checking access..." : "Access Dashboard"}</span>
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path
                d="M5 12h14m-4-4 4 4-4 4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </button>
        </form>

        <p className="mt-4 text-xs font-medium text-slate-400">
          Demo default passcode: <span className="font-semibold text-slate-500">12345</span>
        </p>

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-4 text-xs font-medium text-slate-400">
          <span className="inline-flex items-center gap-2">
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path
                d="M12 3.75 5.25 6.75v4.5c0 4.18 2.87 8.05 6.75 9 3.88-.95 6.75-4.82 6.75-9v-4.5L12 3.75Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
            Secure Access
          </span>
          <span>Forgot passcode? Contact IT</span>
        </div>
      </section>

      <div className="mt-7 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-[0_18px_38px_-32px_rgba(15,23,42,0.38)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Server Status: Operational
        </div>
      </div>
    </div>
  );
}
