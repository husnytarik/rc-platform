import type { AppRouter } from '@rc/api/app-router';
import { createTRPCReact } from '@trpc/react-query';

/** React Query'ye bağlı tRPC hook'ları — bileşenler bunu kullanır. */
export const trpc = createTRPCReact<AppRouter>();

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

export function trpcUrl(): string {
  return `${apiBaseUrl()}/trpc`;
}
