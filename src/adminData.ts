// ─── ADMIN SEED DATA ──────────────────────────────────────────────────────────
// Default tenants and users for the demo. In production, replace with API calls.

import { gId, td } from './utils';
import { Tenant } from './types';

export const ADMIN_USERS = ['stratadmin', 'raviboorla'];

export function isAdminUser(username: string): boolean {
  return ADMIN_USERS.includes(username.toLowerCase().trim());
}

const mkFeatures = (overrides = {}) => ({
  kanban: true, workitems: true, create: true, bot: true, reports: true,
  ...overrides,
});

export const DEFAULT_TENANTS: Tenant[] = [
  {
    id: 'tenant-001',
    name: 'Acme Corporation',
    slug: 'acme',
    plan: 'enterprise',
    active: true,
    createdAt: '2026-01-10',
    features: mkFeatures(),
    users: [
      { id: 'u-001', username: 'raviboorla', fullName: 'Ravi Boorla',    email: 'ravi@acme.com',    role: 'admin',  active: true,  createdAt: '2026-01-10' },
      { id: 'u-002', username: 'sarah.m',   fullName: 'Sarah Mitchell', email: 'sarah@acme.com',   role: 'editor', active: true,  createdAt: '2026-01-15' },
      { id: 'u-003', username: 'tom.h',     fullName: 'Tom Harrison',   email: 'tom@acme.com',     role: 'viewer', active: true,  createdAt: '2026-02-01' },
      { id: 'u-004', username: 'priya.k',   fullName: 'Priya Kumar',    email: 'priya@acme.com',   role: 'editor', active: false, createdAt: '2026-02-14' },
    ],
  },
  {
    id: 'tenant-002',
    name: 'Beta Dynamics',
    slug: 'betadyn',
    plan: 'pro',
    active: true,
    createdAt: '2026-02-03',
    features: mkFeatures({ bot: false, reports: false }),
    users: [
      { id: 'u-010', username: 'james.w',  fullName: 'James Wilson',  email: 'james@betadyn.com',  role: 'admin',  active: true, createdAt: '2026-02-03' },
      { id: 'u-011', username: 'lisa.t',   fullName: 'Lisa Thompson', email: 'lisa@betadyn.com',   role: 'editor', active: true, createdAt: '2026-02-10' },
    ],
  },
  {
    id: 'tenant-003',
    name: 'Gamma Solutions',
    slug: 'gamma',
    plan: 'starter',
    active: false,
    createdAt: '2026-03-01',
    features: mkFeatures({ kanban: false, bot: false, reports: false }),
    users: [
      { id: 'u-020', username: 'anna.s', fullName: 'Anna Stephens', email: 'anna@gamma.com', role: 'admin', active: true, createdAt: '2026-03-01' },
    ],
  },
];
