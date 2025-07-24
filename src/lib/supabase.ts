import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://pbhevzjyyjkahlwvvfhj.supabase.co'
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiaGV2emp5eWprYWhsd3Z2ZmhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA4MTM3NjksImV4cCI6MjA1NjM4OTc2OX0.xgrPk3cz4Vclry_9WmHaO1NVCi2TOQQI0jsLZvtl6I8'

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // We'll handle this manually
    flowType: 'implicit',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'supabase.auth.token'
  }
})

// Database types based on our schema
export interface Database {
  public: {
    Tables: {
      trades: {
        Row: {
          id: string
          user_id: string
          trade_no: string
          date: string
          name: string
          entry: number
          avg_entry: number
          sl: number
          tsl: number
          buy_sell: 'Buy' | 'Sell'
          cmp: number
          setup: string
          base_duration: string
          initial_qty: number
          pyramid1_price: number
          pyramid1_qty: number
          pyramid1_date: string | null
          pyramid2_price: number
          pyramid2_qty: number
          pyramid2_date: string | null
          position_size: number
          allocation: number
          sl_percent: number
          exit1_price: number
          exit1_qty: number
          exit1_date: string | null
          exit2_price: number
          exit2_qty: number
          exit2_date: string | null
          exit3_price: number
          exit3_qty: number
          exit3_date: string | null
          open_qty: number
          exited_qty: number
          avg_exit_price: number
          stock_move: number
          reward_risk: number
          holding_days: number
          position_status: 'Open' | 'Closed' | 'Partial'
          realised_amount: number
          pl_rs: number
          pf_impact: number
          cumm_pf: number
          plan_followed: boolean
          exit_trigger: string
          proficiency_growth_areas: string
          sector: string
          open_heat: number
          notes: string
          chart_attachments: any
          user_edited_fields: string[]
          cmp_auto_fetched: boolean
          needs_recalculation: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          trade_no: string
          date: string
          name: string
          entry?: number
          avg_entry?: number
          sl?: number
          tsl?: number
          buy_sell?: 'Buy' | 'Sell'
          cmp?: number
          setup?: string
          base_duration?: string
          initial_qty?: number
          pyramid1_price?: number
          pyramid1_qty?: number
          pyramid1_date?: string | null
          pyramid2_price?: number
          pyramid2_qty?: number
          pyramid2_date?: string | null
          position_size?: number
          allocation?: number
          sl_percent?: number
          exit1_price?: number
          exit1_qty?: number
          exit1_date?: string | null
          exit2_price?: number
          exit2_qty?: number
          exit2_date?: string | null
          exit3_price?: number
          exit3_qty?: number
          exit3_date?: string | null
          open_qty?: number
          exited_qty?: number
          avg_exit_price?: number
          stock_move?: number
          reward_risk?: number
          holding_days?: number
          position_status?: 'Open' | 'Closed' | 'Partial'
          realised_amount?: number
          pl_rs?: number
          pf_impact?: number
          cumm_pf?: number
          plan_followed?: boolean
          exit_trigger?: string
          proficiency_growth_areas?: string
          sector?: string
          open_heat?: number
          notes?: string
          chart_attachments?: any
          user_edited_fields?: string[]
          cmp_auto_fetched?: boolean
          needs_recalculation?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          trade_no?: string
          date?: string
          name?: string
          entry?: number
          avg_entry?: number
          sl?: number
          tsl?: number
          buy_sell?: 'Buy' | 'Sell'
          cmp?: number
          setup?: string
          base_duration?: string
          initial_qty?: number
          pyramid1_price?: number
          pyramid1_qty?: number
          pyramid1_date?: string | null
          pyramid2_price?: number
          pyramid2_qty?: number
          pyramid2_date?: string | null
          position_size?: number
          allocation?: number
          sl_percent?: number
          exit1_price?: number
          exit1_qty?: number
          exit1_date?: string | null
          exit2_price?: number
          exit2_qty?: number
          exit2_date?: string | null
          exit3_price?: number
          exit3_qty?: number
          exit3_date?: string | null
          open_qty?: number
          exited_qty?: number
          avg_exit_price?: number
          stock_move?: number
          reward_risk?: number
          holding_days?: number
          position_status?: 'Open' | 'Closed' | 'Partial'
          realised_amount?: number
          pl_rs?: number
          pf_impact?: number
          cumm_pf?: number
          plan_followed?: boolean
          exit_trigger?: string
          proficiency_growth_areas?: string
          sector?: string
          open_heat?: number
          notes?: string
          chart_attachments?: any
          user_edited_fields?: string[]
          cmp_auto_fetched?: boolean
          needs_recalculation?: boolean
        }
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          is_mobile_menu_open: boolean
          is_profile_open: boolean
          user_name: string
          is_full_width_enabled: boolean
          accounting_method: 'cash' | 'accrual'
          theme: 'light' | 'dark' | 'system'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          is_mobile_menu_open?: boolean
          is_profile_open?: boolean
          user_name?: string
          is_full_width_enabled?: boolean
          accounting_method?: 'cash' | 'accrual'
          theme?: 'light' | 'dark' | 'system'
        }
        Update: {
          id?: string
          user_id?: string
          is_mobile_menu_open?: boolean
          is_profile_open?: boolean
          user_name?: string
          is_full_width_enabled?: boolean
          accounting_method?: 'cash' | 'accrual'
          theme?: 'light' | 'dark' | 'system'
        }
      }
      portfolio_data: {
        Row: {
          id: string
          user_id: string
          type: 'yearly_capital' | 'capital_change' | 'monthly_override'
          year: number | null
          month: string | null
          amount: number
          date: string | null
          description: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'yearly_capital' | 'capital_change' | 'monthly_override'
          year?: number | null
          month?: string | null
          amount: number
          date?: string | null
          description?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'yearly_capital' | 'capital_change' | 'monthly_override'
          year?: number | null
          month?: string | null
          amount?: number
          date?: string | null
          description?: string
        }
      }
      chart_image_blobs: {
        Row: {
          id: string
          user_id: string
          trade_id: string
          image_type: 'beforeEntry' | 'afterExit'
          filename: string
          mime_type: string
          size_bytes: number
          data: any
          uploaded_at: string
          compressed: boolean
          original_size: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          trade_id: string
          image_type: 'beforeEntry' | 'afterExit'
          filename: string
          mime_type: string
          size_bytes: number
          data: any
          uploaded_at?: string
          compressed?: boolean
          original_size?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          trade_id?: string
          image_type?: 'beforeEntry' | 'afterExit'
          filename?: string
          mime_type?: string
          size_bytes?: number
          data?: any
          uploaded_at?: string
          compressed?: boolean
          original_size?: number | null
        }
      }
    }
  }
}
