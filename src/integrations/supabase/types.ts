export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      btm_blocks: {
        Row: {
          activity: string
          day: string
          end_time: string
          id: string
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity?: string
          day: string
          end_time: string
          id?: string
          start_time: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          activity?: string
          day?: string
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      btm_days: {
        Row: {
          day: string
          follow_up: string
          updated_at: string
          user_id: string
        }
        Insert: {
          day: string
          follow_up?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          day?: string
          follow_up?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      btm_priorities: {
        Row: {
          done: boolean
          minutes: number | null
          position: number
          ref_date: string
          scope: string
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          done?: boolean
          minutes?: number | null
          position: number
          ref_date: string
          scope: string
          text?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          done?: boolean
          minutes?: number | null
          position?: number
          ref_date?: string
          scope?: string
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goal_comments: {
        Row: {
          body: string
          created_at: string
          goal_id: string
          id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          goal_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          goal_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_comments_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          assignee_id: string | null
          company: Database["public"]["Enums"]["goal_company"]
          done: boolean
          id: string
          level: Database["public"]["Enums"]["goal_level"]
          position: number
          snapshot_id: string
          text: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          company: Database["public"]["Enums"]["goal_company"]
          done?: boolean
          id?: string
          level: Database["public"]["Enums"]["goal_level"]
          position: number
          snapshot_id: string
          text?: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          company?: Database["public"]["Enums"]["goal_company"]
          done?: boolean
          id?: string
          level?: Database["public"]["Enums"]["goal_level"]
          position?: number
          snapshot_id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          active: boolean
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          core_values: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          core_values?: string
          id: string
          name?: string
          updated_at?: string
        }
        Update: {
          core_values?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      snapshots: {
        Row: {
          annual_label: string
          created_at: string
          id: string
          is_current: boolean
          label: string
          month_label: string
          snapshot_date: string
          updated_at: string
          user_id: string
          week_end: string | null
          week_label: string
          week_number: number | null
          week_start: string | null
          year: number | null
        }
        Insert: {
          annual_label?: string
          created_at?: string
          id?: string
          is_current?: boolean
          label: string
          month_label?: string
          snapshot_date?: string
          updated_at?: string
          user_id?: string
          week_end?: string | null
          week_label?: string
          week_number?: number | null
          week_start?: string | null
          year?: number | null
        }
        Update: {
          annual_label?: string
          created_at?: string
          id?: string
          is_current?: boolean
          label?: string
          month_label?: string
          snapshot_date?: string
          updated_at?: string
          user_id?: string
          week_end?: string | null
          week_label?: string
          week_number?: number | null
          week_start?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_goal: {
        Args: {
          _company: Database["public"]["Enums"]["goal_company"]
          _level: Database["public"]["Enums"]["goal_level"]
          _snapshot_id: string
        }
        Returns: {
          assignee_id: string | null
          company: Database["public"]["Enums"]["goal_company"]
          done: boolean
          id: string
          level: Database["public"]["Enums"]["goal_level"]
          position: number
          snapshot_id: string
          text: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_new_week:
        | {
            Args: { _label: string; _month_label: string; _week_label: string }
            Returns: string
          }
        | {
            Args: {
              _label: string
              _month_label: string
              _week_end: string
              _week_label: string
              _week_number: number
              _week_start: string
              _year: number
            }
            Returns: string
          }
      delete_goal: { Args: { _id: string }; Returns: undefined }
      has_any_user: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      make_current: { Args: { _id: string }; Returns: undefined }
      seed_if_empty: { Args: never; Returns: undefined }
    }
    Enums: {
      goal_company: "personal" | "e4cc" | "e4kids"
      goal_level: "annual" | "monthly" | "weekly"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      goal_company: ["personal", "e4cc", "e4kids"],
      goal_level: ["annual", "monthly", "weekly"],
    },
  },
} as const
