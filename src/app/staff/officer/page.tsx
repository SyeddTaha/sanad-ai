"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createStaffApi } from "@/lib/staff-api";
import type { OfficerQueueItem } from "@/lib/staff-api";

export default function OfficerQueuePage() {
  const [items, setItems] = useState<OfficerQueueItem[]>([]);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"priority" | "confidence" | "oldest">("priority");
  const [cursor, setCursor] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const api = createStaffApi();
    api.getOfficerQueue(cursor || undefined, status || undefined, 20, sort).then((response) => {
      if (!active) return;
      setItems(response?.data.items ?? []);
      setNextCursor(response?.data.nextCursor ?? null);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Queue unavailable");
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [status, cursor, sort]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Assigned cases</h1>
        <p className="mt-1 text-sm text-slate-600">Review only cases assigned to your account.</p>
      </header>
      <label className="block text-sm">
        Status
        <select className="mt-1 block rounded border border-slate-300 bg-white px-3 py-2" value={status} onChange={(event) => { setLoading(true); setCursor(""); setStatus(event.target.value); }}>
          <option value="">All statuses</option>
          {["SUBMITTED", "UNDER_REVIEW", "NEEDS_EVIDENCE", "PENDING_CONSENT", "RESOLVED", "CLOSED"].map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        Sort
        <select className="mt-1 block rounded border border-slate-300 bg-white px-3 py-2" value={sort} onChange={(event) => { setLoading(true); setCursor(""); setSort(event.target.value as "priority" | "confidence" | "oldest"); }}>
          <option value="priority">Priority</option>
          <option value="confidence">Confidence</option>
          <option value="oldest">Oldest</option>
        </select>
      </label>
      {loading && <p role="status">Loading assigned cases...</p>}
      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">{error}</div>}
      {!loading && !error && items.length === 0 && <p className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-600">No assigned cases match this filter.</p>}
      {!loading && items.length > 0 && (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr><th className="px-4 py-3">Case</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Confidence</th><th className="px-4 py-3">Updated</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.caseId} className="border-t border-slate-100">
                  <td className="px-4 py-3"><Link className="font-medium underline" href={`/staff/officer/cases/${item.caseId}`}>{item.caseId.slice(0, 8)}</Link></td>
                  <td className="px-4 py-3">{item.status}</td>
                  <td className="px-4 py-3"><span className={item.priority === "HIGH" ? "font-semibold text-red-700" : ""}>{item.priority}</span></td>
                  <td className="px-4 py-3">{item.confidence === null ? "UNKNOWN" : item.confidence.toFixed(2)}</td>
                  <td className="px-4 py-3">{new Date(item.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nextCursor && <button className="rounded border border-slate-300 bg-white px-3 py-2 text-sm" onClick={() => { setLoading(true); setCursor(nextCursor); }}>Load next page</button>}
    </div>
  );
}
