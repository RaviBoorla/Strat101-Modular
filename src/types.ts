// ─── SHARED TYPES ─────────────────────────────────────────────────────────────
// Central type definitions for the multi-tenant SaaS model

export type FeatureKey = 'kanban' | 'workitems' | 'create' | 'bot' | 'reports';

export interface TenantFeatures {
  kanban:    boolean;
  workitems: boolean;
  create:    boolean;
  bot:       boolean;
  reports:   boolean;
}

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface TenantUser {
  id:        string;
  username:  string;
  fullName:  string;
  email:     string;
  role:      UserRole;
  active:    boolean;
  createdAt: string;
}

export interface Tenant {
  id:          string;
  name:        string;
  slug:        string;
  plan:        'starter' | 'pro' | 'enterprise';
  active:      boolean;
  createdAt:   string;
  features:    TenantFeatures;
  users:       TenantUser[];
}
