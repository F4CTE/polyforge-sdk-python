# Polyforge — OpenAPI Code Generation Pipeline

> How Angular HTTP clients are generated from NestJS controllers.  
> **Angular apps must never contain hand-written HTTP calls.**

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tool: hey-api/openapi-ts](#2-tool-hey-apiopenapi-ts)
3. [Installation & Configuration](#3-installation--configuration)
4. [Step-by-Step Pipeline](#4-step-by-step-pipeline)
5. [Turborepo Wiring](#5-turborepo-wiring)
6. [Using Generated Services in Angular](#6-using-generated-services-in-angular)
7. [Workflow: When You Add or Change an Endpoint](#7-workflow-when-you-add-or-change-an-endpoint)
8. [CI Enforcement](#8-ci-enforcement)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Overview

The pipeline has four stages:

```
NestJS controllers + DTOs
  (annotated with @nestjs/swagger decorators)
          ↓
  build:swagger task
  (SwaggerModule.createDocument → swagger.json)
          ↓
  @hey-api/openapi-ts
  (Angular HttpClient client)
          ↓
  apps/user-app/src/app/api/
  apps/admin-app/src/app/api/
  (typed services + models, no Java required)
```

The generated files are committed to the repository. CI regenerates them on every push and fails if the output has changed without being committed — ensuring the frontend is always in sync with the backend.

---

## 2. Tool: hey-api/openapi-ts

We use **`@hey-api/openapi-ts`** with the **`@hey-api/client-angular`** client plugin.

| Package | Role |
|---|---|
| `@nestjs/swagger` | Annotate DTOs and controllers; generate `swagger.json` at build time |
| `@hey-api/openapi-ts` | Consume `swagger.json`; produce typed TypeScript services and models |
| `@hey-api/client-angular` | Runtime Angular `HttpClient` adapter used by the generated services |

### Why hey-api over openapi-generator-cli

| | `openapi-generator-cli` | `@hey-api/openapi-ts` |
|---|---|---|
| Runtime requirement | Java 11+ | **Node only** |
| Angular support | `typescript-angular` generator | Native `@hey-api/client-angular` plugin |
| Output quality | Verbose, dated patterns | Modern TypeScript, clean output |
| Config format | YAML | TypeScript (`defineConfig`) |
| Version pinning | `openapitools.json` | Standard `package.json` exact version |

> **Important:** `@hey-api/openapi-ts` is under active development. Always pin an **exact version** — no `^` or `~` prefix. Check the migration notes before upgrading.

### What gets generated

For each app, hey-api produces:

```
src/app/api/
├── types.gen.ts      ← TypeScript interfaces for every DTO
├── sdk.gen.ts        ← Typed SDK functions (one per endpoint)
└── client.gen.ts     ← Angular HttpClient instance configuration
```

---

## 3. Installation & Configuration

### Install

```bash
# Root devDependencies (code generation tool — dev only)
pnpm add -D @hey-api/openapi-ts

# App runtime dependency (Angular HttpClient adapter)
pnpm add @hey-api/client-angular --filter user-app
pnpm add @hey-api/client-angular --filter admin-app
```

### Config files

Create one config file per Angular app at the **monorepo root**:

**`openapi-ts.config.ts`** — for `user-app`:

```typescript
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input:  'services/api-service/dist/swagger.json',
  output: {
    path:   'apps/user-app/src/app/api',
    format: 'prettier',
  },
  plugins: [
    '@hey-api/typescript',
    {
      name:   '@hey-api/sdk',
      // Generates one function per endpoint, fully typed
    },
    {
      name:   '@hey-api/client-angular',
      // Uses Angular HttpClient — no fetch, no axios
    },
  ],
});
```

**`openapi-ts.admin.config.ts`** — for `admin-app`:

```typescript
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input:  'services/admin-api-service/dist/swagger-admin.json',
  output: {
    path:   'apps/admin-app/src/app/api',
    format: 'prettier',
  },
  plugins: [
    '@hey-api/typescript',
    {
      name: '@hey-api/sdk',
    },
    {
      name: '@hey-api/client-angular',
    },
  ],
});
```

### Version lock

Pin the exact version in `package.json` — no `^`:

```json
{
  "devDependencies": {
    "@hey-api/openapi-ts": "0.x.y"
  }
}
```

> Check the current version at `npmjs.com/package/@hey-api/openapi-ts` and paste the exact version. Never use `^0.x.y` — minor versions can have breaking changes.

---

## 4. Step-by-Step Pipeline

### Step 1 — Annotate DTOs with `@ApiProperty`

Every DTO field exposed to the frontend must have `@ApiProperty`:

```typescript
// services/api-service/src/strategies/dto/create-strategy.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsInt, Min, IsOptional } from 'class-validator';

export class CreateStrategyDto {
  @ApiProperty({ example: 'My momentum strategy' })
  @IsString()
  name: string;

  @ApiProperty({ enum: ['EVENT', 'TICK', 'HYBRID'] })
  @IsEnum(['EVENT', 'TICK', 'HYBRID'])
  execMode: 'EVENT' | 'TICK' | 'HYBRID';

  @ApiPropertyOptional({ minimum: 200, description: 'Tick interval in ms (TICK/HYBRID mode only)' })
  @IsInt()
  @Min(200)
  @IsOptional()
  tickMs?: number;
}
```

### Step 2 — Annotate controllers with `@ApiResponse`

```typescript
@Post()
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: 'Create a new strategy' })
@ApiResponse({ status: 201, type: StrategyResponseDto })
@ApiResponse({ status: 400, description: 'Validation error' })
async createStrategy(
  @Body() dto: CreateStrategyDto,
  @CurrentUser() user: JwtPayload,
): Promise<StrategyResponseDto> {
  return this.strategiesService.create(user.sub, dto);
}
```

### Step 3 — Generate `swagger.json`

```bash
# Via turbo (recommended):
pnpm build:swagger

# Or directly inside a service:
cd services/api-service && pnpm build:swagger
```

NestJS setup in `main.ts` — writes spec to disk:

```typescript
// services/api-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFile } from 'fs/promises';

const app = await NestFactory.create(AppModule);

const config = new DocumentBuilder()
  .setTitle('Polyforge User API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);

// Expose Swagger UI in non-production
if (process.env.NODE_ENV !== 'production') {
  SwaggerModule.setup('docs', app, document);
}

// Always write spec to disk for hey-api code generation
await writeFile('./dist/swagger.json', JSON.stringify(document, null, 2));
```

### Step 4 — Generate Angular clients

```bash
# Generate for user-app
pnpm dlx @hey-api/openapi-ts --config openapi-ts.config.ts

# Generate for admin-app
pnpm dlx @hey-api/openapi-ts --config openapi-ts.admin.config.ts

# Or both at once via the root script:
pnpm generate:api
```

Root `package.json` script:

```json
{
  "scripts": {
    "generate:api": "openapi-ts --config openapi-ts.config.ts && openapi-ts --config openapi-ts.admin.config.ts"
  }
}
```

### Step 5 — Configure the Angular client

```typescript
// apps/user-app/src/app/app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { client } from './api/client.gen';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
  ],
};

// Configure the hey-api Angular client (called once at app init)
client.setConfig({
  baseUrl: environment.apiUrl,
});

// Inject the auth token on every request via an Angular HTTP interceptor
// See: apps/user-app/src/app/core/interceptors/auth.interceptor.ts
```

---

## 5. Turborepo Wiring

```json
// turbo.json
{
  "tasks": {
    "build:swagger": {
      "dependsOn": ["^build"],
      "inputs":    ["src/**"],
      "outputs":   ["dist/swagger.json", "dist/swagger-admin.json"],
      "cache":     false
    },
    "generate:api": {
      "dependsOn": ["build:swagger"],
      "inputs": [
        "dist/swagger.json",
        "dist/swagger-admin.json",
        "../../openapi-ts.config.ts",
        "../../openapi-ts.admin.config.ts"
      ],
      "outputs": [
        "apps/user-app/src/app/api/**",
        "apps/admin-app/src/app/api/**"
      ],
      "cache": false
    },
    "build": {
      "dependsOn": ["generate:api", "^build"]
    }
  }
}
```

With this wiring, `pnpm build` automatically regenerates Angular clients when `swagger.json` changes. The `cache: false` on `generate:api` ensures the generation always runs fresh (the output files already act as the cache signal via git diff in CI).

---

## 6. Using Generated Services in Angular

hey-api generates **SDK functions** (not classes), one per endpoint. They use Angular's `HttpClient` under the hood via `@hey-api/client-angular`.

### Basic usage

```typescript
// apps/user-app/src/app/strategies/strategies.component.ts
import { getMyStrategies, startStrategy } from '../api/sdk.gen';
import { StrategyResponse } from '../api/types.gen';

@Component({
  selector: 'app-strategies',
  standalone: true,
  template: `
    @if (strategies$ | async; as strategies) {
      @for (s of strategies.data; track s.id) {
        <div>{{ s.name }}</div>
      }
    }
  `
})
export class StrategiesComponent {
  strategies$ = getMyStrategies();

  onStart(id: string) {
    startStrategy({ path: { id } }).subscribe({
      next: ()    => this.toast.success('Strategy started'),
      error: (err) => this.toast.error(err.error.message),
    });
  }
}
```

### With request body

```typescript
import { placeOrder } from '../api/sdk.gen';
import { PlaceOrderDto } from '../api/types.gen';

const body: PlaceOrderDto = {
  tokenId:   'abc123',
  side:      'BUY',
  size:      '10.000000',
  price:     '0.550000',
  orderType: 'GTC',
};

placeOrder({ body }).subscribe(order => {
  console.log('Placed:', order.data.id);
});
```

### With query parameters

```typescript
import { getPriceHistory } from '../api/sdk.gen';

getPriceHistory({
  path:  { id: tokenId },
  query: { resolution: '1h', limit: 100 },
}).subscribe(res => {
  this.chartData = res.data;
});
```

### Error handling

API errors follow the standard error DTO:

```typescript
// apps/user-app/src/app/core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStore } from '../stores/auth.store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthStore).token();
  if (!token) return next(req);

  return next(req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  }));
};
```

```typescript
// Standard API error shape (matches NestJS error filter)
interface ApiErrorDto {
  statusCode: number;
  code:       string;   // machine-readable, e.g. INVALID_CREDENTIALS
  message:    string;   // human-readable
  field?:     string;   // for validation errors
  requestId:  string;
}
```

---

## 7. Workflow: When You Add or Change an Endpoint

```
1. Update the NestJS DTO / controller
   └─► Add/modify @ApiProperty and @ApiResponse decorators

2. Run pnpm generate:api
   └─► swagger.json is rewritten
   └─► Angular types.gen.ts and sdk.gen.ts are regenerated

3. Check for TypeScript errors in Angular apps
   └─► pnpm typecheck
   └─► Compilation errors = the frontend used a field that no longer exists

4. Fix any Angular code that broke
   └─► The TypeScript compiler tells you exactly what changed

5. Commit swagger.json + generated api/ files alongside your backend change
   └─► CI enforces this via git diff
```

---

## 8. CI Enforcement

```yaml
# .github/workflows/ci.yml
- name: Generate API clients
  run: pnpm generate:api

- name: Check generated files are committed
  run: |
    git diff --exit-code \
      apps/user-app/src/app/api \
      apps/admin-app/src/app/api \
      services/api-service/dist/swagger.json \
      services/admin-api-service/dist/swagger-admin.json
```

If this step fails, a developer changed a DTO or endpoint without running `pnpm generate:api` and committing the result. The fix is always the same: run `pnpm generate:api` locally and commit the generated files.

---

## 9. Troubleshooting

### "Cannot find swagger.json"

`pnpm generate:api` requires `swagger.json` to exist first. Run `pnpm build:swagger` manually if you're not going through Turborepo:

```bash
pnpm build:swagger
pnpm generate:api
```

### "Generated type is `unknown`"

The DTO field is missing `@ApiProperty`. Add it with an explicit type:

```typescript
@ApiProperty({ type: 'string', format: 'uuid' })
id: string;

@ApiProperty({ type: 'number', example: 0.65 })
price: string;  // type annotation is TypeScript; @ApiProperty tells Swagger the wire type
```

### "SDK function not found for my endpoint"

1. Confirm the controller method has `@ApiOperation` — methods without it are excluded from the spec
2. Confirm there is no duplicate `operationId`. NestJS generates `ControllerName_methodName` by default — check for collisions if you have multiple controllers
3. Re-run `pnpm generate:api`

### "Angular app fails to compile after regeneration"

A DTO field was renamed or removed. The TypeScript error message points to the exact file and line. Update the Angular component to use the new field name.

### "CI diff failing on unrelated changes"

The version of `@hey-api/openapi-ts` drifted between local and CI environments. Ensure the version is **pinned exactly** in `package.json` (no `^` prefix) and that `pnpm-lock.yaml` is committed.

---

*Previous: [Codebase Guide](./02-codebase-guide.md) | Next: [Database & Redis](./04-database-and-redis.md)*
