import { AppError } from "../errors/app-error.js";

export function assertTenantAccess(resourceOwnerId: string, actorUserId: string, resourceName: string): void {
  if (resourceOwnerId !== actorUserId) {
    throw new AppError(403, "FORBIDDEN", `You cannot access this ${resourceName}`);
  }
}
