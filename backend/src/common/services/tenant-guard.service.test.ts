import { describe, expect, it } from "vitest";
import { AppError } from "../errors/app-error";
import { assertTenantAccess } from "./tenant-guard.service";

describe("assertTenantAccess", () => {
  it("allows access when actor owns resource", () => {
    expect(() => assertTenantAccess("user-1", "user-1", "conversation")).not.toThrow();
  });

  it("denies access when actor does not own resource", () => {
    expect(() => assertTenantAccess("user-1", "user-2", "conversation")).toThrow(
      expect.objectContaining({
        statusCode: 403,
        code: "FORBIDDEN",
      }) as Partial<AppError>,
    );
  });

  it("applies the same rule across resource types", () => {
    const resources = ["workflow", "knowledge document", "analytics dashboard"];

    for (const resource of resources) {
      expect(() => assertTenantAccess("owner", "attacker", resource)).toThrow(
        expect.objectContaining({
          statusCode: 403,
          code: "FORBIDDEN",
        }) as Partial<AppError>,
      );
    }
  });
});
