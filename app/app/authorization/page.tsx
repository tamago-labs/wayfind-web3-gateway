export default function AuthorizationPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-4 pt-2">
      <div className="rounded-3xl border border-navy/10 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-heroslate">
          Delegation · Devnet
        </p>
        <p className="mt-2 text-lg font-bold">Your Bots act only with permission</p>
        <p className="mt-2 text-sm text-heroslate">
          Transfer limits, allowlists, and time bounds are approved here and enforced before every
          transaction.
        </p>
      </div>
      <div className="rounded-3xl border border-dashed border-navy/20 p-6 text-sm text-heroslate">
        <p className="font-bold text-navy">Policies ship with the gateway</p>
        <p className="mt-2">
          Create spending limits, approve token allowlists, and set active hours for each Bot. New
          policies will ask for your signature first.
        </p>
      </div>
    </section>
  );
}
