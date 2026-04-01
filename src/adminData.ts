// ─── ADMIN SEED DATA ──────────────────────────────────────────────────────────
import { Tenant, Subscription } from './types';

export const ADMIN_USERS = ['stratadmin'];

export function isAdminUser(username: string): boolean {
  return ADMIN_USERS.includes(username.toLowerCase().trim());
}

// Plan limits
export const PLAN_LIMITS = {
  starter:    { items: 100,  users: 5,  aiCalls: 0    },
  pro:        { items: 1000, users: 25, aiCalls: 500  },
  enterprise: { items: 9999, users: 999,aiCalls: 9999 },
};

// Monthly price in GBP pence
export const PLAN_PRICE = { starter: 4900, pro: 14900, enterprise: 49900 };

const mkFeatures = (overrides = {}) => ({
  kanban: true, workitems: true, create: true, bot: true, reports: true,
  ...overrides,
});

const mkSub = (plan: Tenant['plan'], overrides: Partial<Subscription> = {}): Subscription => {
  const lim = PLAN_LIMITS[plan];
  return {
    status: 'active',
    currentPeriodStart: '2026-03-01',
    currentPeriodEnd:   '2026-03-31',
    autoRenew: true,
    billingEmail: '',
    billingName:  '',
    cardLast4: '4242',
    cardExpiry: '08/27',
    itemCount:   0,
    itemLimit:   lim.items,
    userCount:   0,
    userLimit:   lim.users,
    aiCalls:     0,
    aiCallLimit: lim.aiCalls,
    invoices: [],
    ...overrides,
  };
};

export const DEFAULT_TENANTS: Tenant[] = [
  {
    id: 'tenant-001',
    name: 'Acme Corporation',
    slug: 'acme',
    plan: 'enterprise',
    active: true,
    createdAt: '2026-01-10',
    features: mkFeatures(),
    subscription: mkSub('enterprise', {
      billingEmail: 'finance@acme.com',
      billingName:  'Acme Corp Finance',
      vatId: 'GB123456789',
      cardLast4: '9182',
      cardExpiry: '03/28',
      itemCount: 847,
      userCount: 4,
      aiCalls: 1243,
      invoices: [
        { id:'inv-001', date:'2026-03-01', amount:49900, status:'paid',   period:'Mar 2026' },
        { id:'inv-002', date:'2026-02-01', amount:49900, status:'paid',   period:'Feb 2026' },
        { id:'inv-003', date:'2026-01-01', amount:49900, status:'paid',   period:'Jan 2026' },
      ],
    }),
    users: [
      { id:'u-001', username:'raviboorla', fullName:'Ravi Boorla',    email:'ravi@acme.com',    role:'admin',  active:true,  createdAt:'2026-01-10', lastLogin:'01 Apr 2026 09:14', lastLoginIp:'82.34.12.1',  loginHistory:[{ts:'01 Apr 2026 09:14',ip:'82.34.12.1',device:'Chrome / macOS'},{ts:'31 Mar 2026 17:42',ip:'82.34.12.1',device:'Chrome / macOS'},{ts:'30 Mar 2026 08:55',ip:'82.34.12.1',device:'Safari / iOS'}] },
      { id:'u-002', username:'sarah.m',    fullName:'Sarah Mitchell', email:'sarah@acme.com',   role:'editor', active:true,  createdAt:'2026-01-15', lastLogin:'01 Apr 2026 08:31', lastLoginIp:'195.60.4.22', loginHistory:[{ts:'01 Apr 2026 08:31',ip:'195.60.4.22',device:'Firefox / Windows'},{ts:'29 Mar 2026 14:12',ip:'195.60.4.22',device:'Firefox / Windows'}] },
      { id:'u-003', username:'tom.h',      fullName:'Tom Harrison',   email:'tom@acme.com',     role:'viewer', active:true,  createdAt:'2026-02-01', lastLogin:'28 Mar 2026 11:02', lastLoginIp:'10.0.0.5',   loginHistory:[{ts:'28 Mar 2026 11:02',ip:'10.0.0.5',device:'Chrome / Windows'}] },
      { id:'u-004', username:'priya.k',    fullName:'Priya Kumar',    email:'priya@acme.com',   role:'editor', active:false, createdAt:'2026-02-14' },
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
    subscription: mkSub('pro', {
      billingEmail: 'ops@betadyn.com',
      billingName:  'Beta Dynamics Ltd',
      cardLast4: '1234',
      cardExpiry: '11/26',
      itemCount: 312,
      userCount: 2,
      aiCalls: 0,
      invoices: [
        { id:'inv-010', date:'2026-03-01', amount:14900, status:'paid',   period:'Mar 2026' },
        { id:'inv-011', date:'2026-02-01', amount:14900, status:'paid',   period:'Feb 2026' },
        { id:'inv-012', date:'2026-01-01', amount:14900, status:'overdue',period:'Jan 2026' },
      ],
    }),
    users: [
      { id:'u-010', username:'james.w', fullName:'James Wilson',  email:'james@betadyn.com', role:'admin',  active:true, createdAt:'2026-02-03', lastLogin:'31 Mar 2026 16:45', lastLoginIp:'88.21.4.100', loginHistory:[{ts:'31 Mar 2026 16:45',ip:'88.21.4.100',device:'Chrome / macOS'}] },
      { id:'u-011', username:'lisa.t',  fullName:'Lisa Thompson', email:'lisa@betadyn.com',  role:'editor', active:true, createdAt:'2026-02-10', lastLogin:'30 Mar 2026 10:20', lastLoginIp:'88.21.4.101', loginHistory:[{ts:'30 Mar 2026 10:20',ip:'88.21.4.101',device:'Safari / macOS'}] },
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
    subscription: mkSub('starter', {
      status: 'trialling',
      trialStart: '2026-03-01',
      trialEnd:   '2026-03-31',
      billingEmail: 'admin@gamma.com',
      billingName:  'Gamma Solutions',
      itemCount: 14,
      userCount: 1,
      aiCalls: 0,
      invoices: [],
    }),
    users: [
      { id:'u-020', username:'anna.s', fullName:'Anna Stephens', email:'anna@gamma.com', role:'admin', active:true, createdAt:'2026-03-01', lastLogin:'25 Mar 2026 14:30', lastLoginIp:'77.90.2.5', loginHistory:[{ts:'25 Mar 2026 14:30',ip:'77.90.2.5',device:'Chrome / Windows'}] },
    ],
  },
];
