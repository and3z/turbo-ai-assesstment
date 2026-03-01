const fs = require('fs');
const path = '/Users/andreansescobar/Documents/TurboAI-assestment/components/orders-workspace.tsx';
let content = fs.readFileSync(path, 'utf8');

// The React JSX for the buttons right now
const currentJSX = `            <nav className="hidden items-center gap-6 xl:flex">
              {/*<HeaderNavItem active={false} label="Inventory" />*/}
              <HeaderNavItem active label="Orders" />
              <HeaderNavItem active={false} label="Vendors" />
              {/* <HeaderNavItem active={false} label="Analytics" />
              <HeaderNavItem active={false} label="Finances" /> */}
            </nav>
            <div className="hidden h-8 w-px bg-slate-200 xl:block" />
            <HeaderActionButton
              icon={<PlusGlyph className="h-4 w-4" />}
              label="Create Order"
              onClick={openCreateOrder}
              tone="primary"
            />
            <HeaderActionButton
              icon={<UploadGlyph className="h-4 w-4" />}
              label="Import CSV"
              onClick={() => {
                setImportSummary(null);
                setIsImportOpen(true);
              }}
              tone="secondary"
            />
            <button
              aria-label="Sign out"`;

// The fixed JSX we want
const nextJSX = `            <nav className="hidden items-center gap-6 xl:flex">
              {/*<HeaderNavItem active={false} label="Inventory" />*/}
              <HeaderNavItem active label="Orders" />
              <HeaderNavItem active={false} label="Vendors" />
              {/* <HeaderNavItem active={false} label="Analytics" />
              <HeaderNavItem active={false} label="Finances" /> */}
            </nav>
            <div className="hidden h-8 w-px bg-slate-200 xl:block" />
            <HeaderActionButton
              icon={<PlusGlyph className="h-4 w-4" />}
              label="Create Order"
              onClick={openCreateOrder}
              tone="primary"
            />
            <HeaderActionButton
              icon={<UploadGlyph className="h-4 w-4" />}
              label="Import CSV"
              onClick={() => {
                setImportSummary(null);
                setIsImportOpen(true);
              }}
              tone="secondary"
            />
            <button
              aria-label="Sign out"`;


// Try to parse using a generic regex just to grab the 2 buttons and swap them.
let newContent = content.replace(
    /<HeaderActionButton\s+icon=\{<PlusGlyph[^}]+\}\s+label="Create Order"\s+onClick=\{openCreateOrder\}\s+tone="primary"\s+\/>\s+<HeaderActionButton\s+icon=\{<UploadGlyph[^}]+\}\s+label="Import CSV"\s+onClick=\{\(\) => \{\s+setImportSummary\(null\);\s+setIsImportOpen\(true\);\s+\}\}\s+tone="secondary"\s+\/>/m,
    `
            <HeaderActionButton
              icon={<PlusGlyph className="h-4 w-4" />}
              label="Create Order"
              onClick={openCreateOrder}
              tone="primary"
            />
            <HeaderActionButton
              icon={<UploadGlyph className="h-4 w-4" />}
              label="Import CSV"
              onClick={() => {
                setImportSummary(null);
                setIsImportOpen(true);
              }}
              tone="secondary"
            />
    `
); // Note: I see you actually want "Create Order" primary and "Import CSV" secondary. Wait!

// The original prompt said: "Change the order of the buttons in the header "create order" in the main action, import is secodary action. so we change position an buttons style."
// The first code edit above *did* exactly this, but you said "Sigo viendo los botones igual."
// So is Next.js HMR hanging, or is the file not saving, or does Next.js need `npx next build` or a dev server restart? Let me double-check the code.
