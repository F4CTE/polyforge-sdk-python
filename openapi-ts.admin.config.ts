const config = {
  input: 'services/admin-api-service/dist/swagger-admin.json',
  output: 'packages/api-client/src/generated/admin',
  plugins: [
    { name: '@hey-api/typescript', enums: 'javascript' },
    { name: '@hey-api/sdk' },
    { name: '@hey-api/client-fetch' },
  ],
} satisfies import('@hey-api/openapi-ts').UserConfig;

export default config;
