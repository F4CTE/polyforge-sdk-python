import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'services/api-service/dist/swagger.json',
  output: 'packages/api-client/src/generated/user',
  plugins: [
    { name: '@hey-api/typescript', enums: 'javascript' },
    { name: '@hey-api/sdk' },
    { name: '@hey-api/client-fetch' },
  ],
});
