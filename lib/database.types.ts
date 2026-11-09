export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      notifications: {
        Row: {
          actor_name: string;
          attempts: number;
          claimed_at: string | null;
          created_at: string;
          id: number;
          kind: Database["public"]["Enums"]["notification_kind"];
          last_error: string | null;
          next_attempt_at: string;
          payload: NonNullable<Json>;
          recipient_id: string;
          ride_id: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["notification_status"];
        };
        ComputedFields: never;
        Insert: {
          actor_name: string;
          attempts?: number;
          claimed_at?: string | null;
          created_at?: string;
          id?: never;
          kind: Database["public"]["Enums"]["notification_kind"];
          last_error?: string | null;
          next_attempt_at?: string;
          payload?: NonNullable<Json>;
          recipient_id: string;
          ride_id: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
        };
        Update: {
          actor_name?: string;
          attempts?: number;
          claimed_at?: string | null;
          created_at?: string;
          id?: never;
          kind?: Database["public"]["Enums"]["notification_kind"];
          last_error?: string | null;
          next_attempt_at?: string;
          payload?: NonNullable<Json>;
          recipient_id?: string;
          ride_id?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
        };
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_ride_id_fkey";
            columns: ["ride_id"];
            isOneToOne: false;
            referencedRelation: "rides";
            referencedColumns: ["id"];
          },
        ];
      };
      places: {
        Row: {
          address: string;
          kind: Database["public"]["Enums"]["place_kind"];
          name: string;
          short_name: string;
          slug: string;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          address: string;
          kind: Database["public"]["Enums"]["place_kind"];
          name: string;
          short_name: string;
          slug: string;
          sort: number;
        };
        Update: {
          address?: string;
          kind?: Database["public"]["Enums"]["place_kind"];
          name?: string;
          short_name?: string;
          slug?: string;
          sort?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          first_name: string;
          gender: Database["public"]["Enums"]["gender"] | null;
          id: string;
          last_name: string;
          phone: string;
          updated_at: string;
          venmo: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          first_name: string;
          gender?: Database["public"]["Enums"]["gender"] | null;
          id: string;
          last_name: string;
          phone: string;
          updated_at?: string;
          venmo?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          first_name?: string;
          gender?: Database["public"]["Enums"]["gender"] | null;
          id?: string;
          last_name?: string;
          phone?: string;
          updated_at?: string;
          venmo?: string | null;
        };
        Relationships: [];
      };
      ride_members: {
        Row: {
          joined_at: string;
          ride_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          joined_at?: string;
          ride_id: string;
          user_id: string;
        };
        Update: {
          joined_at?: string;
          ride_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ride_members_ride_id_fkey";
            columns: ["ride_id"];
            isOneToOne: false;
            referencedRelation: "rides";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rides: {
        Row: {
          audience: Database["public"]["Enums"]["ride_audience"];
          created_at: string;
          departs_at: string;
          destination: string;
          id: string;
          notes: string;
          origin: string;
          owner_id: string;
          seats: number;
          status: Database["public"]["Enums"]["ride_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          audience?: Database["public"]["Enums"]["ride_audience"];
          created_at?: string;
          departs_at: string;
          destination: string;
          id?: string;
          notes?: string;
          origin: string;
          owner_id: string;
          seats: number;
          status?: Database["public"]["Enums"]["ride_status"];
          updated_at?: string;
        };
        Update: {
          audience?: Database["public"]["Enums"]["ride_audience"];
          created_at?: string;
          departs_at?: string;
          destination?: string;
          id?: string;
          notes?: string;
          origin?: string;
          owner_id?: string;
          seats?: number;
          status?: Database["public"]["Enums"]["ride_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rides_destination_fkey";
            columns: ["destination"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["slug"];
          },
          {
            foreignKeyName: "rides_origin_fkey";
            columns: ["origin"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["slug"];
          },
          {
            foreignKeyName: "rides_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cancel_ride: { Args: { p_ride_id: string }; Returns: undefined };
      claim_notifications: { Args: { p_limit?: number }; Returns: Json };
      complete_notification: {
        Args: { p_error?: string; p_id: number; p_ok: boolean };
        Returns: undefined;
      };
      create_ride: {
        Args: {
          p_audience: string;
          p_departs_at: string;
          p_destination: string;
          p_notes: string;
          p_origin: string;
          p_seats: number;
        };
        Returns: string;
      };
      delete_my_account: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      find_similar_rides: {
        Args: { p_departs_at: string; p_destination: string; p_origin: string };
        Returns: Json;
      };
      get_my_profile: { Args: Record<PropertyKey, never>; Returns: Json };
      get_ride: { Args: { p_ride_id: string }; Returns: Json };
      hook_before_user_created: { Args: { event: Json }; Returns: Json };
      join_ride: { Args: { p_ride_id: string }; Returns: undefined };
      leave_ride: { Args: { p_ride_id: string }; Returns: undefined };
      list_rides: {
        Args: { p_day?: string; p_direction: string };
        Returns: Json;
      };
      my_rides: { Args: Record<PropertyKey, never>; Returns: Json };
      update_ride: {
        Args: {
          p_audience: string;
          p_departs_at: string;
          p_notes: string;
          p_ride_id: string;
          p_seats: number;
        };
        Returns: undefined;
      };
      upsert_my_profile: {
        Args: {
          p_first_name: string;
          p_gender: string;
          p_last_name: string;
          p_phone: string;
          p_venmo: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      gender: "brother" | "sister";
      notification_kind:
        | "member_joined"
        | "member_left"
        | "ownership_transferred"
        | "ride_cancelled"
        | "time_changed";
      notification_status: "pending" | "sending" | "sent" | "failed";
      place_kind: "campus" | "airport";
      ride_audience: "anyone" | "brothers" | "sisters";
      ride_status: "active" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      gender: ["brother", "sister"],
      notification_kind: [
        "member_joined",
        "member_left",
        "ownership_transferred",
        "ride_cancelled",
        "time_changed",
      ],
      notification_status: ["pending", "sending", "sent", "failed"],
      place_kind: ["campus", "airport"],
      ride_audience: ["anyone", "brothers", "sisters"],
      ride_status: ["active", "cancelled"],
    },
  },
} as const;
