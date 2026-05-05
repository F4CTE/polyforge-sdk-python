const ADMIN_ONLY_USER_SDK_OPERATION_EXCLUDES = [
  'POST /api/v1/arbitrage/matches',
  'POST /api/v1/arbitrage/matches/{matchId}/verify',
  'DELETE /api/v1/arbitrage/matches/{matchId}',
  'POST /api/v1/arbitrage/matches/sync',
] as const;

const config = {
  input: 'services/api-service/dist/swagger.json',
  output: 'packages/api-client/src/generated/user',
  parser: {
    filters: {
      operations: {
        exclude: [...ADMIN_ONLY_USER_SDK_OPERATION_EXCLUDES],
      },
    },
  },
  plugins: [
    { name: '@hey-api/typescript', enums: 'javascript' },
    { name: '@hey-api/sdk' },
    { name: '@hey-api/client-fetch' },
  ],
} satisfies import('@hey-api/openapi-ts').UserConfig;

export default config;
