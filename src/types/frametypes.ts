import type { Database } from "@/integrations/supabase/database.types";

type Tables = Database['public']['Tables']

type DbFrameType = Tables['frame_types']['Row'];
type DbProfile = Tables['profiles']['Row'];
type DbFrameTypeProfileRule = Tables['frame_type_profile_rules']['Row'];

export interface SupabaseProfile {
  id: string;
  name: string;
}

export interface SupabaseRule {
  id: string;
  profile_id: string;
  height_multiplier: number;
  width_multiplier: number;
  profiles: {
    id: string;
    name: string;
  };
}

export interface FrameTypeWithRules extends DbFrameType {
  frame_type_profile_rules: Array<
    DbFrameTypeProfileRule & {
      profiles: DbProfile;
    }
  >;
}

export interface SupabaseProfileWithCount {
  id: string;
  name: string;
  frame_type_profile_rules: Array<{
    count: number;
  }>;
}

export interface Profile {
  id: string;
  name: string;
  usageCount: number;
}

export interface FrameType {
  id: string;
  label: string;
  profiles: ProfileAssignment[];
}

export interface ProfileAssignment {
  profileId: string;
  profileName: string;
  heightMultiplier: number;
  widthMultiplier: number;
  isDirty?: boolean;
} 