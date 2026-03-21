import { createClient } from '@hey-api/client-fetch';

export const userClient = createClient({
  baseUrl: typeof window !== 'undefined'
    ? (window as any).__PF_API_URL__ || ''
    : '',
  credentials: 'include',
});

export const adminClient = createClient({
  baseUrl: typeof window !== 'undefined'
    ? (window as any).__PF_ADMIN_API_URL__ || ''
    : '',
  credentials: 'include',
});
