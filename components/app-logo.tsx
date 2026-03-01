export function AppLogo() {
  return (
    <div className="flex items-center gap-4">
      <div className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-sky via-sky to-tide text-lg font-bold text-white shadow-panel">
        MS
      </div>
      <div>
        <p className="font-display text-2xl font-semibold text-ink">MedSupply Flow</p>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-slate-500">
          Internal dispatch prototype
        </p>
      </div>
    </div>
  );
}

