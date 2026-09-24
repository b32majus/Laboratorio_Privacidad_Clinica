/**
 * Ambient declaration for the pdf.js legacy worker module, imported only by
 * deterministic tests to provide the main-thread fake-worker handler
 * (`globalThis.pdfjsWorker`); the upstream package ships no types for this
 * build artifact. The V4 runtime never imports it — the worker is served as
 * the governed same-origin asset /vendor/pdf.worker.min.js.
 */
declare module "pdfjs-dist/legacy/build/pdf.worker.js" {
  const workerModule: unknown;
  export default workerModule;
}
