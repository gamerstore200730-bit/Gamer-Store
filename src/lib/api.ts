import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';

export interface Pkg {
  id: string;
  game: 'ml' | 'starlight';
  tab: string;
  sub_section: string | null;
  label: string;
  price: number;
  sort_order: number;
  active: boolean;
}

export interface OtherPkg {
  id: string;
  name: string;
  price: number;
  note: string | null;
  end_date: string | null;
  active: boolean;
  sort_order: number;
}

export interface StoreOrder {
  id: string;
  game: 'ml' | 'starlight';
  package_label: string;
  price: number;
  player_id: string;
  server_id: string;
  status: 'pending' | 'completed';
  created_at: string;
  completed_at: string | null;
}

export interface GameAccount {
  id: string;
  photos: string[];
  game_id: string;
  server_id: string;
  contact_number: string;
  price: number;
  page: 'customers' | 'store';
  sold: boolean;
  published: boolean;
  created_at: string;
}

export interface AccountRequest {
  id: string;
  photos: string[];
  game_id: string;
  server_id: string;
  contact_number: string;
  expected_price: number;
  created_at: string;
}

export async function fetchPackages(game: 'ml' | 'starlight'): Promise<Pkg[]> {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('game', game)
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as Pkg[];
}

export async function fetchAllPackages(): Promise<Pkg[]> {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .order('game')
    .order('tab')
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as Pkg[];
}

export async function fetchActiveOtherPackages(): Promise<OtherPkg[]> {
  const { data, error } = await supabase
    .from('other_packages')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  const now = Date.now();
  return ((data ?? []) as OtherPkg[]).filter(
    (p) => !p.end_date || new Date(p.end_date).getTime() > now
  );
}

export async function fetchAllOtherPackages(): Promise<OtherPkg[]> {
  const { data, error } = await supabase
    .from('other_packages')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as OtherPkg[];
}

export async function fetchAccounts(page: 'customers' | 'store'): Promise<GameAccount[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('page', page)
    .eq('published', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as GameAccount[];
}

export async function fetchAllAccounts(): Promise<GameAccount[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as GameAccount[];
}

export async function fetchAccountRequests(): Promise<AccountRequest[]> {
  const { data, error } = await supabase
    .from('account_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AccountRequest[];
}

export async function fetchOrders(): Promise<StoreOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StoreOrder[];
}

export async function insertOrder(input: {
  game: 'ml' | 'starlight';
  package_label: string;
  price: number;
  player_id: string;
  server_id: string;
}): Promise<StoreOrder | null> {
  const { data, error } = await supabase.rpc('create_order', {
    p_game: input.game,
    p_package_label: input.package_label,
    p_price: input.price,
    p_player_id: input.player_id,
    p_server_id: input.server_id,
  });
  if (error) throw error;
  return (data as StoreOrder) ?? null;
}

export async function fetchOrderById(id: string): Promise<StoreOrder | null> {
  const { data, error } = await supabase.rpc('get_my_order', { p_order_id: id });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as StoreOrder) ?? null;
}

export type { Session };
