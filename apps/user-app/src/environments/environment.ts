export const environment = {
  production: false,
  // In dev, API calls go through the Angular dev-server proxy (proxy.conf.json)
  // so base URLs are empty — routes like /auth/v1/login resolve via proxy.
  authApiUrl: '',
  apiUrl: '',
  wsUrl: 'ws://localhost:3002',
};
