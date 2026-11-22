export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6">
      <section className="w-full rounded border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">SANAD</p>
        <h1 className="mt-2 text-3xl font-semibold">Synthetic relief workflow prototype</h1>
        <p className="mt-3 text-slate-600">Sign in to access the citizen or authorized staff workspace.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a className="rounded bg-slate-900 px-4 py-2 text-sm text-white" href="/login">Sign in</a>
          <a className="rounded border border-slate-300 px-4 py-2 text-sm" href="/citizen">Citizen view</a>
        </div>
      </section>
    </main>
  );
}
