export interface Store {
  id: string;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  is_active?: boolean;
}

export interface Coupon {
  id: string;
  store_id?: string | null;
  title: string;
  description?: string | null;
  code?: string | null;
  discount_label?: string | null;
  max_price_cents?: number | null;
  affiliate_url: string;
  is_active?: boolean;
  stores?: Store | null;
}
