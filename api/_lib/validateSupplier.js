// Returns true if a supplier with this id exists in the given org. Used by the
// contracts and spend endpoints to reject a client-supplied supplierId that
// belongs to another org (or does not exist) — a referential-integrity guard.
export async function isSupplierInOrg(prisma, supplierId, orgId) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, orgId } })
  return Boolean(supplier)
}
