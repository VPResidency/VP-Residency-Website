import type { Settings } from './lib/defaults';

export type Bindings = {
  DB: D1Database;
  /** Optional R2 bucket for uploads; without it uploads are stored in D1 (see lib/storage.ts). */
  MEDIA?: R2Bucket;
  ASSETS: Fetcher;
  /** One-time key needed to create the first owner account at /admin/setup. */
  ADMIN_SETUP_KEY?: string;
};

export type Role = 'owner' | 'editor';

export type User = {
  id: number;
  email: string;
  name: string;
  role: Role;
  totp_enabled: number;
};

export type Session = {
  id: string;
  user_id: number;
  csrf: string;
  mfa_pending: number;
  expires_at: number;
  last_seen_at: number;
};

export type Vars = {
  nonce: string;
  s: Settings;
  user: User;
  session: Session;
  newEnquiries: number;
};

export type AppEnv = { Bindings: Bindings; Variables: Vars };

export type RoomRow = {
  id: number;
  slug: string;
  name: string;
  status: string;
  featured: number;
  sort: number;
  ac: number;
  price: number;
  max_guests: number;
  data: string;
  created_at: string;
  updated_at: string;
};

export type PostRow = {
  id: number;
  slug: string;
  title: string;
  status: string;
  published_at: string | null;
  tags: string;
  data: string;
  created_at: string;
  updated_at: string;
};

export type PageRow = {
  id: number;
  slug: string;
  title: string;
  status: string;
  sort: number;
  data: string;
  created_at: string;
  updated_at: string;
};
