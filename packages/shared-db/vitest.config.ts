import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  resolve: {
    alias: {
      ".prisma/client": fileURLToPath(
        new URL("./src/__mocks__/prisma-client.ts", import.meta.url),
      ),
      ".prisma/admin-client": fileURLToPath(
        new URL("./src/__mocks__/prisma-client.ts", import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
