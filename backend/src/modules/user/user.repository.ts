import { prisma } from "../../infra/database/prisma.js";

export class UserRepository {
  async getUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async deleteUserById(userId: string) {
    return prisma.user.delete({
      where: { id: userId },
      select: { id: true },
    });
  }
}
