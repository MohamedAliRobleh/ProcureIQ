import { PrismaClient } from '@prisma/client'
import { suppliers, contracts, riskAssessments, esgResponses, spendRecords } from '../src/lib/mockData.js'

const prisma = new PrismaClient()

async function main() {
  // FK order: children first
  await prisma.spendRecord.deleteMany()
  await prisma.esgResponse.deleteMany()
  await prisma.riskAssessment.deleteMany()
  await prisma.contract.deleteMany()
  await prisma.supplier.deleteMany()

  await prisma.supplier.createMany({ data: suppliers })
  await prisma.contract.createMany({ data: contracts })
  await prisma.riskAssessment.createMany({ data: riskAssessments })
  await prisma.esgResponse.createMany({ data: esgResponses })
  await prisma.spendRecord.createMany({ data: spendRecords })

  console.log(
    `Seeded ${suppliers.length} suppliers, ${contracts.length} contracts, ` +
      `${riskAssessments.length} risk assessments, ${esgResponses.length} ESG responses, ` +
      `${spendRecords.length} spend records`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
