export function assertOrgScoped<T extends { org_id?: string | null }>(result: T[], orgId: string): void {
  const leaked = result.find((row) => row.org_id !== orgId)
  if (leaked) {
    throw new Error(`Tenant isolation violation: expected ${orgId}, received ${String(leaked.org_id)}`)
  }
}
