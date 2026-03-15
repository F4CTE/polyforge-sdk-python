import { defineConfig } from '@hey-api/openapi-ts';

/**
 * Generates the Angular HTTP client for apps/user-app.
 *
 * Source: services/api-service/dist/swagger.json
 * (api-service bundles all user-facing endpoints once it exists)
 *
 * Run: pnpm generate:api
 */
export default defineConfig({
    input: 'services/api-service/dist/swagger.json',
    output: {
        path: 'apps/user-app/src/app/api',
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
