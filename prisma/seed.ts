import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const managerEmail = process.env.MANAGER_EMAIL ?? "admin@company.com";
  const managerPassword = process.env.MANAGER_PASSWORD ?? "admin123";

  await prisma.user.upsert({
    where: { email: managerEmail },
    create: {
      name: "المدير",
      email: managerEmail,
      passwordHash: await hashPassword(managerPassword),
      role: "manager",
    },
    update: {
      name: "المدير",
      passwordHash: await hashPassword(managerPassword),
      role: "manager",
      isActive: true,
    },
  });

  console.log("Manager account ready:");
  console.log(`  Email: ${managerEmail}`);
  console.log(`  Password: ${managerPassword}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
