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
    const apiBase = (env.PUBLIC_API_BASE_URL ?? env.APP_ORIGIN).replace(/\/+$/, "");
    const restBaseUrl = `${apiBase}/api`;
    const wsBaseUrl = `${apiBase.replace(/^http/, "ws")}/ws/conversations/{conversationId}`;

    return {
      restExample: `curl -X POST ${restBaseUrl}/v1/chat \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: YOUR_API_KEY" \\\n  -d '{ "message": "Hello from the API" }'`,
      websocketExample: `// First create a conversation via POST ${restBaseUrl}/v1/chat to get a\n// conversationId, then stream further turns over the socket:\nconst socket = new WebSocket("${wsBaseUrl}?apiKey=YOUR_API_KEY");\n\nsocket.addEventListener("open", () => {\n  socket.send(JSON.stringify({ type: "text_message", data: "Hello", language: "en" }));\n});\n\nsocket.addEventListener("message", (event) => {\n  const evt = JSON.parse(event.data);\n  if (evt.type === "assistant_delta") process.stdout.write(evt.data.token);\n  if (evt.type === "assistant_response") console.log("\\n", evt.data.text);\n});`,
      javascriptExample: `const response = await fetch("${restBaseUrl}/v1/chat", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    "x-api-key": process.env.VOX_API_KEY\n  },\n  body: JSON.stringify({\n    message: "Can you help with billing?"\n    // conversationId: "..." // optional: continue an existing conversation\n  })\n});\n\nconst data = await response.json();\nconsole.log(data.message.content);`,
      pythonExample: `import os\nimport requests\n\nresp = requests.post(\n    "${restBaseUrl}/v1/chat",\n    headers={\n        "x-api-key": os.getenv("VOX_API_KEY"),\n        "Content-Type": "application/json"\n    },\n    json={ "message": "Hello from Python" }\n)\n\nprint(resp.json()["message"]["content"])`,
    };
  }
}
