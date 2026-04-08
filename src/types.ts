// ─── SHARED TYPES ─────────────────────────────────────────────────────────────

export type FeatureKey = 'kanban' | 'workitems' | 'create' | 'bot' | 'reports';

export interface TenantFeatures {
  kanban:    boolean;
  workitems: boolean;
  create:    boolean;
  bot:       boolean;
  reports:   boolean;
}

export type UserRole = 'global_admin' | 'local_admin' | 'editor' | 'viewer';

export interface LoginEvent {
  ts:     string;   // ISO datetime
  ip:     string;
  device: string;
}

export interface TenantUser {
  id:              string;
  username:        string;
  fullName:        string;
  email:           string;
  role:            UserRole;
  active:          boolean;
  createdAt:       string;
  authUserId?:     string;   // Supabase auth.users UUID — set on creation
  lastLogin?:      string;   // ISO datetime
  lastLoginIp?:    string;
  loginHistory?:   LoginEvent[];
  tempPassword?:   string;   // set on new user creation or password reset
  sendInvite?:     boolean;  // if true, edge function sends password setup email
  passwordResetAt?: string;
  mustChangePwd?:       boolean;
  passwordChangedAt?:   string;
}

export type SubStatus = 'trialling' | 'active' | 'past_due' | 'cancelled' | 'suspended';

export interface Invoice {
  id:       string;
  date:     string;   // YYYY-MM-DD
  amount:   number;   // GBP pence
  status:   'paid' | 'unpaid' | 'overdue';
  period:   string;   // e.g. "Jan 2026"
}

export interface Subscription {
  status:       SubStatus;
  trialStart?:  string;
  trialEnd?:    string;
  currentPeriodStart: string;
  currentPeriodEnd:   string;
  autoRenew:    boolean;
  billingEmail: string;
  billingName:  string;
  vatId?:       string;
  cardLast4?:   string;
  cardExpiry?:  string;   // MM/YY
  invoices:     Invoice[];
  // usage
  itemCount:    number;
  itemLimit:    number;
  userCount:    number;
  userLimit:    number;
  aiCalls:      number;
  aiCallLimit:  number;
}

export interface Tenant {
  id:             string;
  name:           string;
  slug:           string;
  plan:           'starter' | 'pro' | 'enterprise';
  active:         boolean;
  createdAt:      string;
  features:       TenantFeatures;
  users:          TenantUser[];
  subscription:   Subscription;
  // Company profile
  industry?:      string;
  sector?:        string;
  // Password policy (per-tenant)
  pwdExpiryDays?: number | null;  // null = disabled, 30 | 60 | 90
}
