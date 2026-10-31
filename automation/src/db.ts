import { PrismaClient } from "@prisma/client";

const scope = globalThis as unknown as { litixWarriorDb?: PrismaClient };
export const db = scope.litixWarriorDb ?? new PrismaClient({
  log: ["error"],
});
if (process.env.NODE_ENV !== "production") scope.litixWarriorDb = db;
