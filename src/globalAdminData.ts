// ─── ADMIN CONSTANTS ─────────────────────────────────────────────────────────
// Seed data (DEFAULT_TENANTS) has been removed — all tenant data is now
// loaded live from Supabase via src/lib/adminapi.ts fetchTenants().

import { Tenant } from './types';

// Only stratadmin has access to the admin console
export const GLOBAL_ADMIN_USERS = ['raviboorla'];

export function isGlobalAdminUser(username: string): boolean {
  return GLOBAL_ADMIN_USERS.includes(username.toLowerCase().trim());
}

// Plan limits — mirrors what is enforced in the DB and displayed in admin UI
export const PLAN_LIMITS = {
  Lite:       { items: 100,   users: 5,   aiCalls: 0    },
  Starter:    { items: 300,   users: 7,   aiCalls: 0    },
  Pro:        { items: 1000,  users: 25,  aiCalls: 999  },
  Enterprise: { items: 9999,  users: 100, aiCalls: 4999 },
};

// Monthly price in GBP pence
export const PLAN_PRICE: Record<string, number> = {
  Lite:       0
  Starter:    9,
  Pro:        15,
  Enterprise: 18,
};

// Satisfy TypeScript imports that reference Tenant type from this file
export type { Tenant };
