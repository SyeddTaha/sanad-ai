"use client";

import { useEffect, useState } from "react";
import { createStaffApi } from "@/lib/staff-api";
import type { DispatchItem } from "@/lib/staff-api";
import { fixtureDepartmentId, fixtureDispatch, fixtureOfficerIds } from "@/lib/staff-fixtures";

export default function AdminPage() {
  const [items, setItems] = useState<DispatchItem[]>([]);
  const [selected, setSelected] = useState<DispatchItem | null>(null);
  const [officerId, setOfficerId] = useState("");
  const [reason, setReason] = useState("");
  const [parameters, setParameters] = useState({ maxMonthlyIncomeMinor: 800000, minRoutingConfidence: 0.8, integrityFailurePriority: "HIGH" as "NORMAL" | "HIGH" });
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const api = createStaffApi();
    Promise.all([api.getDispatch(), api.getRule()]).then(([dispatch, rule]) => {
      if (!active) return;
      setItems(dispatch?.data.items ?? fixtureDispatch);
      if (rule) {
        setParameters(rule.rule.parameters);
        setCurrentVersion(rule.rule.version);
      }
    }).catch((cause) => active && setError(cause instanceof Error ? cause.message : "Admin data unavailable"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  async function assign() {
    if (!selected || !officerId || reason.trim().length === 0) {
      setError("Choose an officer and provide a meaningful reason.");
      return;
    }
    setError("");
    setMessage("");
    try {
      const api = createStaffApi();
      if (api.mode === "fixture") {
        setItems((current) => current.map((item) => item.caseId === selected.caseId ? { ...item, assignedOfficerId: officerId, version: item.version + 1 } : item));
        setMessage("Fixture assignment applied. No live authorization or dispatch occurred.");
      } else {
        await api.mutate("assign", selected.caseId, { expectedVersion: selected.version, departmentId: fixtureDepartmentId, officerId, reason });
        setMessage("Case assigned.");
      }
      setSelected(null);
      setReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Assignment failed");
    }
  }

  async function publishRule() {
    setError("");
    setMessage("");
    try {
      const api = createStaffApi();
      if (api.mode === "fixture") {
        setCurrentVersion((version) => (version ?? 0) + 1);
        setMessage("Fixture-only synthetic policy published locally. No live policy changed.");
      } else {
        await api.publishRule({ programRef: "program_demo", expectedCurrentVersion: currentVersion, parameters });
        setMessage("Synthetic policy published.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Policy publication failed");
    }
  }

  return (
    <div className="space-y-6">
      <header><h1 className="text-2xl font-semibold">Admin dispatch</h1><p className="mt-1 text-sm text-slate-600">Admin has no evidence access in this view.</p></header>
      {loading && <p role="status">Loading dispatch queue...</p>}
      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">{error}</div>}
      {message && <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{message}</div>}
      {!loading && (
        <>
          <section className="overflow-x-auto rounded border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Case</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Officer</th><th className="px-4 py-3">Version</th><th></th></tr></thead>
              <tbody>{items.map((item) => (
                <tr key={item.caseId} className="border-t border-slate-100">
                  <td className="px-4 py-3">{item.caseId.slice(0, 8)}</td><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3">{item.priority}</td>
                  <td className="px-4 py-3">{item.assignedOfficerId?.slice(0, 8) ?? "Unassigned"}</td><td className="px-4 py-3">{item.version}</td>
                  <td className="px-4 py-3"><button className="rounded border border-slate-300 px-3 py-1.5" onClick={() => setSelected(item)}>Assign</button></td>
                </tr>
              ))}</tbody>
            </table>
          </section>
          {selected && (
            <dialog open className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg rounded border border-slate-300 bg-white p-5 shadow-lg">
              <h2 className="text-lg font-semibold">Assign case {selected.caseId.slice(0, 8)}</h2>
              <label className="mt-4 block text-sm">Officer<select className="mt-1 block w-full rounded border p-2" value={officerId} onChange={(event) => setOfficerId(event.target.value)}><option value="">Select officer</option>{fixtureOfficerIds.map((id) => <option key={id} value={id}>{id.slice(0, 8)}</option>)}</select></label>
              <label className="mt-3 block text-sm">Reason<textarea className="mt-1 block min-h-24 w-full rounded border p-2" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
              <div className="mt-4 flex justify-end gap-2"><button className="rounded border px-3 py-2" onClick={() => setSelected(null)}>Cancel</button><button className="rounded bg-slate-900 px-3 py-2 text-white" onClick={assign}>Confirm assignment</button></div>
            </dialog>
          )}
          <section className="max-w-2xl rounded border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Synthetic demo policy</h2>
            <p className="mt-1 text-sm text-slate-600">SANAD Synthetic Relief Demo — not government policy or payment authorization.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm">Income ceiling (minor units)<input className="mt-1 block w-full rounded border p-2" type="number" value={parameters.maxMonthlyIncomeMinor} onChange={(event) => setParameters((p) => ({ ...p, maxMonthlyIncomeMinor: Number(event.target.value) }))} /></label>
              <label className="text-sm">Routing confidence<input className="mt-1 block w-full rounded border p-2" type="number" min={0} max={1} step={0.1} value={parameters.minRoutingConfidence} onChange={(event) => setParameters((p) => ({ ...p, minRoutingConfidence: Number(event.target.value) }))} /></label>
              <label className="text-sm">Integrity failure priority<select className="mt-1 block w-full rounded border p-2" value={parameters.integrityFailurePriority} onChange={(event) => setParameters((p) => ({ ...p, integrityFailurePriority: event.target.value as "NORMAL" | "HIGH" }))}><option>NORMAL</option><option>HIGH</option></select></label>
            </div>
            <button className="mt-4 rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={publishRule}>Publish synthetic policy</button>
          </section>
        </>
      )}
    </div>
  );
}
