export interface TwitterUser {
  id: string;
  rest_id: string;
  name: string;
  screen_name: string;
  following?: boolean;
  profile_image_url?: string;
}

export interface UserResponse {
  data: {
    user_result_by_screen_name: {
      result: {
        rest_id: string;
        legacy: {
          name: string;
          screen_name: string;
          following: boolean;
          profile_image_url_https: string;
        };
      };
    };
  };
}

export interface TwitterApiRequest {
  type: "TWITTER_API_REQUEST";
  payload: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
  };
}

export interface TwitterApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface CreateTweetPayload {
  variables: {
    tweet_text: string;
    reply?: {
      in_reply_to_tweet_id: string;
      exclude_reply_user_ids: string[];
    };
    dark_request: boolean;
    media: {
      media_entities: any[];
      possibly_sensitive: boolean;
    };
    semantic_annotation_ids: any[];
    disallowed_reply_options: null;
  };
  features: {
    [key: string]: boolean;
  };
  queryId: string;
}

export interface Connection extends TwitterUser {
  notes: string;
  category: ConnectionCategory;
  lastInteraction?: string;
}

export type ConnectionCategory =
  | "lead"
  | "recruiter"
  | "friend"
  | "colleague"
  | "mentor"
  | "other";
