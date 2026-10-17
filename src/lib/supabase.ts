import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Public shop names for a set of seller ids -> { [sellerId]: shopName }.
 * Goes through the public_shop_names() database function (migration 020):
 * seller_profiles itself is private (it holds NID numbers, phone, address).
 */
export async function fetchShopNames(sellerIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(sellerIds)];
  if (ids.length === 0) return {};
  const { data } = await supabase.rpc('public_shop_names', { p_ids: ids });
  const map: Record<string, string> = {};
  ((data as { id: string; shop_name: string }[] | null) ?? []).forEach((s) => {
    map[s.id] = s.shop_name;
  });
  return map;
}

export type Creator = { username: string | null; shopName: string | null };

/**
 * Public names for a set of uploader ids -> { [id]: { username, shopName } }.
 * Goes through public_creator_names() (migration 022): profiles is private, and this
 * returns only the public handle and shop name of active (not blocked) users.
 */
export async function fetchCreators(ids: string[]): Promise<Record<string, Creator>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};
  const { data } = await supabase.rpc('public_creator_names', { p_ids: unique });
  const map: Record<string, Creator> = {};
  ((data as { id: string; username: string | null; shop_name: string | null }[] | null) ?? []).forEach((c) => {
    map[c.id] = { username: c.username, shopName: c.shop_name };
  });
  return map;
}

/**
 * Base types for the Multi-Vendor Platform.
 * More fields/types (Product, Order, Reel, Settings, etc.) will be added
 * as the corresponding database-schema phases (Phase 1-3) are completed.
 */
export type UserRole = 'admin' | 'seller' | 'customer';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  mobile_number: string | null;
  is_active: boolean;
  /** Public handle used in /u/:username; null until the user picks one (migration 022). */
  username: string | null;
  created_at: string;
};

export type KycStatus = 'pending' | 'approved' | 'rejected';

export type SellerProfile = {
  id: string;
  shop_name: string;
  shop_slug: string;
  shop_description: string | null;
  contact_phone: string | null;
  address: string | null;
  created_at: string;
  nid_number: string | null;
  nid_name: string | null;
  nid_front_url: string | null;
  nid_back_url: string | null;
  kyc_status: KycStatus;
  kyc_rejection_reason: string | null;
};

export type ProductStatus = 'pending' | 'approved' | 'rejected';

export type Product = {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  price: number;
  stock: number;
  unit: string;
  image_url: string | null;
  status: ProductStatus;
  rejection_reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CommissionType = 'percentage' | 'fixed';

export type CommissionSettings = {
  id: true;
  commission_type: CommissionType;
  commission_value: number;
  updated_at: string;
};

export type DeliveryZone = {
  id: string;
  zilla: string;
  thana: string;
  delivery_charge: number;
  created_at: string;
  updated_at: string;
};

export type ReelKind = 'product' | 'content';

export type Reel = {
  id: string;
  /** The uploader's profile id (a seller for product reels, any user for content reels). */
  seller_id: string;
  /** null for content reels. */
  product_id: string | null;
  kind: ReelKind;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  hashtags: string[];
  is_active: boolean;
  hidden_by_admin: boolean;
  hidden_reason: string | null;
  like_count: number;
  created_at: string;
  updated_at: string;
};

export type ReelWithProduct = Reel & { product: Product | null };

export type PaymentMethod = 'cod' | 'online';
export type PaymentStatus = 'unpaid' | 'pending_verification' | 'paid';

/** A manual payment account configured by admin (Phase 17). */
export type PaymentMethodConfig = {
  id: string;
  code: string;
  name: string;
  kind: 'mobile' | 'bank';
  account_name: string | null;
  account_number: string;
  extra: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
};
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';

export type Order = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  zilla: string;
  thana: string;
  delivery_charge: number;
  subtotal: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_provider: string | null;
  payment_trx_id: string | null;
  payment_sender: string | null;
  payment_note: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  seller_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  commission_amount: number;
  seller_net_amount: number;
  created_at: string;
  product?: Product;
};

/**
 * Calls the register_seller() Postgres function: turns the current
 * 'customer' into a 'seller' and creates their seller_profiles row,
 * atomically. Throws if the user isn't a customer or the slug is taken.
 */
export async function registerSeller(params: {
  shopName: string;
  shopSlug: string;
  /** NID number as printed on the card */
  nidNumber: string;
  /** Name as printed on the NID (may differ from the account's full name) */
  nidName: string;
  /** Storage PATH (not a URL) inside the private `seller-kyc` bucket, e.g. `${uid}/front-123.jpg` */
  nidFrontPath: string;
  /** Storage PATH (not a URL) inside the private `seller-kyc` bucket */
  nidBackPath: string;
  shopDescription?: string;
  contactPhone?: string;
  address?: string;
}) {
  const { error } = await supabase.rpc('register_seller', {
    p_shop_name: params.shopName,
    p_shop_slug: params.shopSlug,
    p_nid_number: params.nidNumber,
    p_nid_name: params.nidName,
    p_nid_front_url: params.nidFrontPath,
    p_nid_back_url: params.nidBackPath,
    p_shop_description: params.shopDescription ?? null,
    p_contact_phone: params.contactPhone ?? null,
    p_address: params.address ?? null,
  });
  if (error) throw error;
}

/**
 * Creates a short-lived signed URL for a private seller-kyc object (front
 * or back NID photo). Only the owning seller or an admin can succeed here
 * — enforced by the bucket's RLS, not by this function.
 */
export async function getSellerKycSignedUrl(path: string, expiresInSeconds = 300) {
  const { data, error } = await supabase.storage.from('seller-kyc').createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export type PayoutAccount = {
  seller_id: string;
  method: 'bkash' | 'nagad' | 'rocket' | 'bank';
  account_number: string;
  account_name: string | null;
  bank_details: string | null;
};

/** One row of payout_summary() (Phase 17b). */
export type PayoutSummary = {
  seller_id: string;
  shop_name: string;
  payable: number;
  pending: number;
  paid_out: number;
  balance: number;
};

export type SellerPayout = {
  id: string;
  seller_id: string;
  amount: number;
  method: string;
  reference: string | null;
  note: string | null;
  paid_at: string;
};
