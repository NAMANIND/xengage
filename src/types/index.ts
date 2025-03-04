export interface TwitterUser {
  id: string;
  rest_id: string;
  name: string;
  screen_name: string;
  following?: boolean;
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
        };
      };
    };
  };
}
