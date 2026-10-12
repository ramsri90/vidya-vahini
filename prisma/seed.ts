import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Missing environment variables: SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required to run the seed script."
    );
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email },
  });

  if (existingAdmin) {
    console.log(`Super Admin (${email}) already exists. Skipping.`);
    return;
  }

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const superAdmin = await prisma.user.create({
    data: {
      name: "Super Admin",
      email,
      role: Role.super_admin,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
    },
  });

  console.log(`Super Admin (${superAdmin.email}) created successfully.`);
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
