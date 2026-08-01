import React from "react";

const Evidence = ({ value }) => <div className="mt-1 space-y-1">{(value?.tenants || []).map((group) => <div key={group.tenant}><span className="text-emerald-400">{group.tenant}</span>{group.records.map((record) => <div key={`${record.type}:${record.id}`} className="pl-3 text-gray-500">{record.type}: {record.id}</div>)}</div>)}{!value?.tenants?.length && <span className="text-amber-400">No authoritative tenant evidence</span>}{value?.relationship_conflicts?.map((record) => <div key={`${record.type}:${record.id}`} className="text-red-400">Conflicting relationship: {record.type} {record.id}</div>)}</div>;

export default function OwnershipEvidenceQueue({ queue, evidence, onAction }) {
  const unresolved = queue?.unresolved_unscoped_customer_ids || [];
  const quarantined = queue?.hard_quarantined_customer_ids || [];
  return <div className="space-y-2"><h3 className="font-semibold text-white">Ownership evidence review</h3>{[...unresolved, ...quarantined].map((id) => <div key={id} className="rounded-md border border-gray-800 p-3 text-xs font-mono text-gray-400"><div>{id}</div><Evidence value={evidence?.[id]} /><div className="mt-2 flex flex-wrap gap-3"><button onClick={() => onAction("assign", id)} className="text-sky-400">Assign From Verified Relationships</button><button onClick={() => onAction("quarantine", id)} className="text-amber-400">Keep Hard-Quarantined</button></div></div>)}{!unresolved.length && !quarantined.length && <p className="text-sm text-gray-400">No unscoped customers require review.</p>}</div>;
}