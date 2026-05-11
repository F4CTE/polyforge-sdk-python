# Polyforge — OpenAPI Code Generation Pipeline

> How React API clients are generated from NestJS controllers.
> React apps must use the generated client instead of hand-written HTTP calls.

---

## 1. Overview

```
NestJS controllers + DTOs
  (@nestjs/swagger decorators)
          ↓
OpenAPI JSON inputs
  services/api-service/dist/swagger.json
  services/admin-api-service/dist/swagger-admin.json
          ↓
@hey-api/openapi-ts with bundled @hey-api/client-fetch plugin
          ↓
packages/api-client/src/generated/
  user/ and admin/ typed clients
          ↓
apps/user-app and apps/admin-app
```

Generated files are committed. Current CI typechecks and builds the committed
client output, but it does not regenerate clients or diff generated files.

---

## 2. Tooling

| Package | Role |
|---|---|
| `@nestjs/swagger` | Annotates controllers and DTOs; generates OpenAPI JSON at build time |
| `@hey-api/openapi-ts` | Reads OpenAPI JSON and generates TypeScript types/SDK functions |
| `@hey-api/client-fetch` (plugin) | Generates the runtime fetch client (bundled since `@hey-api/openapi-ts` v0.73) |

Pin exact versions of `@hey-api/openapi-ts` and `@hey-api/client-fetch`; do not
use `^` or `~` for these packages. The `@hey-api/client-fetch` plugin is bundled
with `@hey-api/openapi-ts` since v0.73, but the runtime package is still declared
as a dependency of `packages/api-client`.

---

## 3. Config Files

The root configs generate into the shared `packages/api-client` package:

| Config | Input | Output |
|---|---|---|
| `openapi-ts.config.ts` | `services/api-service/dist/swagger.json` | `packages/api-client/src/generated/user` |
| `openapi-ts.admin.config.ts` | `services/admin-api-service/dist/swagger-admin.json` | `packages/api-client/src/generated/admin` |

Each output contains:

```
types.gen.ts
sdk.gen.ts
client.gen.ts
```

---

## 4. Generation Pipeline

1. Ensure the OpenAPI JSON inputs exist at the paths listed in section 3.

The root client generator reads `services/api-service/dist/swagger.json` and
`services/admin-api-service/dist/swagger-admin.json`. The `api-service` and
`admin-api-service` packages do not currently define a `build:swagger` script;
do not use package-filtered `build:swagger` commands for these two services.

2. Generate clients from those inputs:

```bash
pnpm generate:api
```

The root script runs:

```json
{
  "generate:api": "openapi-ts --file openapi-ts.config.ts && openapi-ts --file openapi-ts.admin.config.ts"
}
```

3. Build consumers:

```bash
pnpm --filter @polyforge/api-client build
pnpm --filter @polyforge/user-app build
pnpm --filter @polyforge/admin-app build
```

---

## 5. Turborepo Wiring

`generate:api` is wired as an uncached Turborepo task for explicit client
generation runs. The normal `build` task does not depend on `generate:api`, so
API clients must be regenerated manually when controller or DTO contracts
change.

```json
{
  "tasks": {
    "build:swagger": {
      "dependsOn": ["^build"],
      "outputs": ["dist/swagger.json", "dist/swagger-admin.json"],
      "cache": false
    },
    "generate:api": {
      "dependsOn": ["build:swagger"],
      "inputs": [
        "services/api-service/dist/swagger.json",
        "services/admin-api-service/dist/swagger-admin.json",
        "openapi-ts.config.ts",
        "openapi-ts.admin.config.ts"
      ],
      "outputs": ["packages/api-client/src/generated/**"],
      "cache": false
    }
  }
}
```

---

## 6. Using Generated Clients

SDK functions return Promises:

```typescript
import { getMarkets } from "@polyforge/api-client/user";

const response = await getMarkets({ query: { page: 1, limit: 20 } });
const markets = response.data;
```

Configure base URLs and credentials once in the app bootstrap/client wrapper.
Browser auth uses HttpOnly cookies, so calls that need user auth must include
credentials.

---

## 7. Endpoint Change Workflow

1. Edit the NestJS controller or DTO.
2. Add or update `@ApiOperation`, `@ApiResponse`, `@ApiBody`, and DTO decorators.
3. Run `pnpm generate:api`.
4. Update React code that consumes changed types or SDK functions.
5. Run focused service/app tests.
6. Commit the controller/DTO changes and generated client changes together.

---

## 8. Troubleshooting

### `swagger.json` missing

Check that the configured input file exists before running code generation:

```bash
test -f services/api-service/dist/swagger.json
test -f services/admin-api-service/dist/swagger-admin.json
```

### Generated client changed locally

Run `pnpm generate:api`, review the generated diff, and commit it with the API
change.

### React app fails after generation

The API contract changed. Fix the TypeScript errors in `apps/user-app`,
`apps/admin-app`, or shared `packages/api-client` consumers.

---

*Previous: [Codebase Guide](./02-codebase-guide.md) | Next: [Database & Redis](./04-database-and-redis.md)*
