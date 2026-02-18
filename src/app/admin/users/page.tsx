import { prisma } from "@/lib/prisma";
import { UsersClient } from "./users-client";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      displayName: true,
      email: true,
      createdAt: true,
    },
  });

  return <UsersClient users={users} />;
}
