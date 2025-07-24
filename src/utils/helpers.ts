// Removed automatic ID generation function - IDs should be generated explicitly when needed

import { SupabaseService } from '../services/supabaseService';

/**
 * Safely get a value from Supabase with fallback
 * @param key - Supabase key
 * @param fallback - fallback value if key doesn't exist or parsing fails
 * @param parser - optional parser function (e.g., parseInt, JSON.parse)
 * @returns parsed value or fallback
 */
export const getFromSupabase = async <T>(
  key: string,
  fallback: T,
  parser?: (value: any) => T
): Promise<T> => {
  try {
    const stored = await SupabaseService.getMiscData(key);
    if (stored === null || stored === undefined) return fallback;

    if (parser) {
      return parser(stored);
    }

    return stored as T;
  } catch (error) {
    return fallback;
  }
};

/**
 * Safely set a value in Supabase
 * @param key - Supabase key
 * @param value - value to store
 * @param serializer - optional serializer function (e.g., JSON.stringify)
 * @returns success boolean
 */
export const setToSupabase = async <T>(
  key: string,
  value: T,
  serializer?: (value: T) => any
): Promise<boolean> => {
  try {
    const valueToStore = serializer ? serializer(value) : value;
    return await SupabaseService.saveMiscData(key, valueToStore);
  } catch (error) {
    return false;
  }
};

// Legacy localStorage functions removed - app is now purely cloud-based
