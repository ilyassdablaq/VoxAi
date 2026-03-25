import { AppError } from "../../common/errors/app-error.js";
import { UserRepository } from "./user.repository.js";

interface ProfileResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fullName: string;
  role: "USER" | "ADMIN";
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const normalized = fullName.trim();
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const parts = normalized.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export class UserService {
  constructor(private readonly repository: UserRepository) {}

  async getProfile(userId: string): Promise<ProfileResponse> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const { firstName, lastName } = splitName(user.fullName);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      firstName,
      lastName,
      role: user.role,
    };
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    await this.repository.deleteUserById(userId);
  }
}
