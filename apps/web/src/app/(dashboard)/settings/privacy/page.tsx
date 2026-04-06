import { RetentionPolicyEditor } from '@/components/settings/RetentionPolicyEditor'
import { IPAllowlistEditor } from '@/components/settings/IPAllowlistEditor'

export default function PrivacySettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mono text-white">PRIVACY & COMPLIANCE</h1>
        <p className="text-sm mt-1 text-white/50">GDPR controls, cookie preferences, and enterprise data handling.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="p-4 rounded border bg-white/[0.015] border-white/[0.05]">
          <div className="text-xs mono font-bold mb-2 text-white/80">DATA EXPORT</div>
          <a href="/api/v1/compliance/export" className="inline-block px-4 py-2 rounded text-xs mono font-bold bg-blue-500 text-white">DOWNLOAD JSON EXPORT</a>
        </div>
        <div className="p-4 rounded border bg-white/[0.015] border-white/[0.05]">
          <div className="text-xs mono font-bold mb-2 text-white/80">ACCOUNT DELETION</div>
          <DeleteAccountControl />
        </div>
      </div>
      <RetentionPolicyEditor />
      <IPAllowlistEditor />
      <div className="p-4 rounded border bg-white/[0.015] border-white/[0.05]">
        <div className="text-xs mono font-bold mb-2 text-white/80">COOKIE PREFERENCES</div>
        <div className="text-sm text-white/50">Cookie preferences are available on the marketing site banner and saved locally in your browser.</div>
      </div>
    </div>
  )
}

function DeleteAccountControl() {
  return (
    <form action={async (formData: FormData) => {
      'use server'
      const confirm = formData.get('confirm')
      if (confirm !== 'DELETE') return
      await fetch(`${process.env['NEXT_PUBLIC_APP_URL'] ?? ''}/api/v1/compliance/delete`, { method: 'POST', headers: { 'X-Confirm-Delete': 'true' } })
    }}>
      <input name="confirm" className="w-full rounded border px-3 py-2 text-xs mono mb-3 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20" placeholder="Type DELETE to confirm" />
      <button className="px-4 py-2 rounded border text-xs mono bg-red-500/10 text-red-400 border-red-500/15">DELETE ACCOUNT</button>
    </form>
  )
}
