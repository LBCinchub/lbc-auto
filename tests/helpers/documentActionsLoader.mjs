// Test-only resolver: maps the app's SDK client and jsPDF to in-memory fakes so the shared
// document action handlers run in Node with no network, data or side effects.
const FAKES = {
  "@/api/base44Client": new URL("./fakeBase44Client.mjs", import.meta.url).href,
  "jspdf": new URL("./fakeJsPdf.mjs", import.meta.url).href,
  "@/lib/constants": new URL("./fakeConstants.mjs", import.meta.url).href,
};

export async function resolve(specifier, context, next) {
  if (FAKES[specifier]) return { url: FAKES[specifier], shortCircuit: true };
  return next(specifier, context);
}