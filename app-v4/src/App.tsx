/**
 * V4 migration scaffold shell.
 *
 * Deliberately minimal: no product flow lives here yet (that is T04+).
 * Placeholder copy is synthetic; it must never contain real PHI.
 */
export function App() {
  return (
    <div className="min-h-screen bg-background-light font-sans text-neutral-800">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-background-dark focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <header className="border-b border-primary bg-surface-light">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <h1 className="font-display text-3xl font-bold text-primary-dark">
            Laboratorio de Privacidad Clínica
          </h1>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8">
        <p className="max-w-2xl text-base leading-relaxed">
          This is the V4 migration scaffold placeholder. No product flow is
          implemented yet; review and application flows arrive with the next
          migration tickets.
        </p>
      </main>
    </div>
  );
}
