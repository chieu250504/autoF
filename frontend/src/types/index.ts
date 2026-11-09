export interface GroupConfig {
  url: string;
  name: string;
  enabled?: boolean;
  scrollSteps?: number;
  reloadMinutes?: number;
}

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
}

export interface RadarConfig {
  account_id?: string;
  id?: string;
  enabled: boolean;
  keywords: string[];
  groups: GroupConfig[];
  reload_minutes: number;
  jitter_percent: number;
  scroll_speed: string;
  max_scroll_steps: number;
  runner_status?: string;
  current_running_group?: string;
  last_heartbeat?: string;
  updated_at?: string;
}

export interface RadarPost {
  id: string;
  group_title: string;
  group_url?: string;
  matched_keyword: string;
  post_text: string;
  post_link: string;
  post_time?: string;
  post_timestamp: number;
  detected_at: string;
  account_ids?: string[];
  matched_details?: Record<string, string>;
}
