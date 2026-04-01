import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string | Buffer;
    user?: {
      sub: string;
      email?: string;
      role?: "USER" | "ADMIN";
      type?: string;
      apiKeyId?: string;
    };
  }
}
