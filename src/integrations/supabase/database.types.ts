export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      frame_types: {
        Row: {
          id: string
          label: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          label: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          label?: string
          created_at?: string
          updated_at?: string
        }
      }
      series: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      series_profiles: {
        Row: {
          id: string
          series_id: string
          profile_id: string
          cost_per_meter: number
          bar_length: number
          scrap_percentage: number
          min_reusable_length: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          series_id: string
          profile_id: string
          cost_per_meter: number
          bar_length: number
          scrap_percentage: number
          min_reusable_length: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          series_id?: string
          profile_id?: string
          cost_per_meter?: number
          bar_length?: number
          scrap_percentage?: number
          min_reusable_length?: number
          created_at?: string
          updated_at?: string
        }
      }
      series_frame_types: {
        Row: {
          id: string
          series_id: string
          frame_type_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          series_id: string
          frame_type_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          series_id?: string
          frame_type_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      frame_type_profile_rules: {
        Row: {
          id: string
          frame_type_id: string
          profile_id: string
          height_multiplier: number
          width_multiplier: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          frame_type_id: string
          profile_id: string
          height_multiplier?: number
          width_multiplier?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          frame_type_id?: string
          profile_id?: string
          height_multiplier?: number
          width_multiplier?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
