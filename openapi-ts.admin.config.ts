import { defineConfig } from '@hey-api/openapi-ts';

/**
 * Generates the Angular HTTP client for apps/admin-app.
 *
 * Source: services/admin-api-service/dist/swagger-admin.json
 * (admin-api-service bundles all admin-facing endpoints once it exists)
 *
 * Run: pnpm generate:api
 */
export default defineConfig({
    input: 'services/admin-api-service/dist/swagger-admin.json',
    output: {
        path: 'apps/admin-app/src/app/api',
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
