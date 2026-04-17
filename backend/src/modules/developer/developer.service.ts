import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../../infra/database/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { env } from "../../config/env.js";
import { CreateApiKeyInput } from "./developer.schemas.js";

function hashApiKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function maskPrefix(prefix: string) {
  return `${prefix.slice(0, 8)}...`;
}

export class DeveloperService {
  async listApiKeys(userId: string) {
    const keys = await prisma.aPIKey.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return keys.map((key) => ({
      ...key,
      maskedPrefix: maskPrefix(key.keyPrefix),
    }));
  }

  async createApiKey(userId: string, payload: CreateApiKeyInput) {
    const rawApiKey = `vox_${randomBytes(18).toString("hex")}`;
    const keyPrefix = rawApiKey.slice(0, 12);

    const created = await prisma.aPIKey.create({
      data: {
        id: randomUUID(),
        userId,
        name: payload.name,
        keyPrefix,
        keyHash: hashApiKey(rawApiKey),
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        isActive: true,
      },
    });

    return {
      key: {
        ...created,
        maskedPrefix: maskPrefix(created.keyPrefix),
      },
      plainTextKey: rawApiKey,
    };
  }

  async deactivateApiKey(userId: string, id: string) {
    const existing = await prisma.aPIKey.findFirst({
      where: {
        id,
        userId,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(404, "API_KEY_NOT_FOUND", "API key not found");
    }

    await prisma.aPIKey.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  getSdkSnippets() {
    const restBaseUrl = `${env.APP_ORIGIN}/api`;
    const wsBaseUrl = `${env.APP_ORIGIN.replace(/^http/, "ws")}/ws/conversations/{conversationId}`;

    return {
      restExample: `curl -X POST ${restBaseUrl}/embed/chat \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "embedKey": "YOUR_EMBED_KEY",\n    "message": "Hello from API"\n  }'`,
      websocketExample: `const socket = new WebSocket("${wsBaseUrl}");\n\nsocket.addEventListener("open", () => {\n  socket.send(JSON.stringify({\n    type: "auth",\n    data: "authenticate",\n    token: "YOUR_JWT"\n  }));\n});`,
      javascriptExample: `const response = await fetch("${restBaseUrl}/embed/chat", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    "x-api-key": process.env.VOX_API_KEY\n  },\n  body: JSON.stringify({\n    embedKey: "YOUR_EMBED_KEY",\n    message: "Can you help with billing?"\n  })\n});\n\nconst data = await response.json();\nconsole.log(data);`,
      pythonExample: `import os\nimport requests\n\nresp = requests.post(\n    "${restBaseUrl}/embed/chat",\n    headers={\n        "x-api-key": os.getenv("VOX_API_KEY"),\n        "Content-Type": "application/json"\n    },\n    json={\n        "embedKey": "YOUR_EMBED_KEY",\n        "message": "Hello from Python"\n    }\n)\n\nprint(resp.json())`,
    };
  }
}
