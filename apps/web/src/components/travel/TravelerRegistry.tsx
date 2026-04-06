'use client'
import { useEffect, useState } from 'react'
type Traveler = { id: string; full_name: string; email?: string | null; destination?: string | null; status?: string | null; checkin_token?: string | null }
export function TravelerRegistry() {
  const [rows, setRows] = useState<Traveler[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const load = async () => { const res = await fetch('/api/v1/travel?action=travelers', { cache: 'no-store' }); const json = await res.json() as { data?: Traveler[] }; setRows(json.data ?? []) }
  useEffect(() => { void load() }, [])
  const create = async () => { await fetch('/api/v1/travel?action=travelers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: name, email }) }); setName(''); setEmail(''); void load() }
  const generate = async (travelerId: string) => { await fetch('/api/v1/travel/brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ traveler_id: travelerId, destination: 'Unknown', departure_date: new Date().toISOString().slice(0,10) }) }); }
  return <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4"><div className="mb-4 flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Traveler name" className="flex-1 rounded border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-sm text-white" /><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="flex-1 rounded border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-sm text-white" /><button onClick={() => void create()} className="rounded bg-blue-500 px-3 py-2 text-sm text-white">Add</button></div><table className="w-full text-sm"><thead><tr className="text-white/30"><th className="px-3 py-2 text-left">Traveler</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Check-in</th><th className="px-3 py-2 text-left">Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-white/[0.05]"><td className="px-3 py-2 text-white">{row.full_name}</td><td className="px-3 py-2 text-white/50">{row.status ?? 'registered'}</td><td className="px-3 py-2 text-white/50">{row.checkin_token ? `/travel/checkin?token=${row.checkin_token}` : '—'}</td><td className="px-3 py-2"><button onClick={() => void generate(row.id)} className="text-blue-400">Generate report</button></td></tr>)}</tbody></table></div>
}
