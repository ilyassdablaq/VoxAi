import { apiClient } from "@/lib/api-client";

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fullName: string;
  role: "USER" | "ADMIN";
}

export const userService = {
  getMyProfile(): Promise<UserProfile> {
    return apiClient.get<UserProfile>("/api/users/me");
  },

  deleteMyAccount(): Promise<void> {
    return apiClient.delete<void>("/api/users/me");
  },
};
