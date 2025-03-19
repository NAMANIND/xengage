/// <reference types="chrome"/>

import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Tab,
  Tabs,
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Avatar,
  Divider,
} from "@mui/material";
import { TwitterUser } from "../types";
import { SelectChangeEvent } from "@mui/material/Select";
import EditIcon from "@mui/icons-material/Edit";
import SendIcon from "@mui/icons-material/Send";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import RefreshIcon from "@mui/icons-material/Refresh";
import LinkIcon from "@mui/icons-material/Link";
import FavoriteIcon from "@mui/icons-material/Favorite";
import { alpha } from "@mui/material/styles";
import { ThemeProvider, createTheme } from "@mui/material/styles";

interface UserPersona {
  personality: string;
  commonPhrases: string;
  interests: string;
}

interface Tweet {
  id: string;
  text: string;
  author: string;
  authorId: string;
}

interface TwitterAuthTokens {
  bearerToken: string;
  csrfToken: string;
}

interface CreateTweetPayload {
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

interface TwitterApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

const theme = createTheme({
  palette: {
    primary: {
      main: "#1DA1F2", // Twitter blue
    },
    background: {
      default: "#f7f9fa",
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 20,
        },
      },
    },
  },
});

const Popup: React.FC = () => {
  console.log("Popup component rendering");

  const [tabValue, setTabValue] = useState(0);
  const [persona, setPersona] = useState<UserPersona>({
    personality: "",
    commonPhrases: "",
    interests: "",
  });
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [generatedComments, setGeneratedComments] = useState<{
    [key: string]: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [selectedUser, setSelectedUser] = useState<TwitterUser | null>(null);
  const [savedUsers, setSavedUsers] = useState<TwitterUser[]>([]);
  const [editingComments, setEditingComments] = useState<{
    [key: string]: boolean;
  }>({});

  useEffect(() => {
    console.log("Loading persona from storage");
    chrome.storage.sync.get(["persona"], (result) => {
      if (result.persona) {
        setPersona(result.persona);
        console.log("Loaded persona:", result.persona);
      }
    });
  }, []);

  useEffect(() => {
    // Load saved users on component mount
    chrome.runtime.sendMessage({ type: "GET_SAVED_USERS" }, (response) => {
      if (response.users) {
        setSavedUsers(response.users);
      }
    });
  }, []);

  const fetchAuthTokens = async (): Promise<TwitterAuthTokens | null> => {
    try {
      // First try to get tokens from localStorage
      const storedTokens = localStorage.getItem("twitterAuthTokens");
      if (storedTokens) {
        const tokens = JSON.parse(storedTokens);
        // Check if tokens are still valid by making a test request
        const testResponse = await fetch(
          "https://x.com/i/api/2/notifications/all.json",
          {
            headers: {
              authorization: tokens.bearerToken,
              "x-csrf-token": tokens.csrfToken,
            },
            credentials: "include",
          }
        );

        if (testResponse.ok) {
          return tokens;
        }
      }

      // If no stored tokens or they're invalid, request new ones
      const tokens = await new Promise<TwitterAuthTokens>((resolve) => {
        chrome.runtime.sendMessage({ type: "GET_AUTH_TOKENS" }, resolve);
      });

      if (tokens?.bearerToken && tokens?.csrfToken) {
        // Save valid tokens to localStorage
        localStorage.setItem("twitterAuthTokens", JSON.stringify(tokens));
        return tokens;
      }

      return null;
    } catch (error) {
      console.error("Error fetching auth tokens:", error);
      return null;
    }
  };

  const fetchTweets = async (userId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const tokens = await fetchAuthTokens();
      if (!tokens?.bearerToken || !tokens?.csrfToken) {
        throw new Error(
          "Please visit Twitter first to capture authentication tokens"
        );
      }

      const targetUserId = userId || "44196397";

      // Send request through content script
      const response = await new Promise<TwitterApiResponse>((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(
            tabs[0].id!,
            {
              type: "TWITTER_API_REQUEST",
              payload: {
                url: `https://x.com/i/api/graphql/Y9WM4Id6UcGFE8Z-hbnixw/UserTweets?variables=%7B%22userId%22%3A%22${targetUserId}%22%2C%22count%22%3A20%2C%22includePromotedContent%22%3Atrue%2C%22withQuickPromoteEligibilityTweetFields%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D&features=%7B%22profile_label_improvements_pcf_label_in_post_enabled%22%3Atrue%2C%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Atrue%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22premium_content_api_read_enabled%22%3Afalse%2C%22communities_web_enable_tweet_community_results_fetch%22%3Atrue%2C%22c9s_tweet_anatomy_moderator_badge_enabled%22%3Atrue%2C%22responsive_web_grok_analyze_button_fetch_trends_enabled%22%3Afalse%2C%22responsive_web_grok_analyze_post_followups_enabled%22%3Atrue%2C%22responsive_web_jetfuel_frame%22%3Afalse%2C%22responsive_web_grok_share_attachment_enabled%22%3Atrue%2C%22articles_preview_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22responsive_web_grok_analysis_button_from_backend%22%3Atrue%2C%22creator_subscriptions_quote_tweet_preview_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22rweb_video_timestamps_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_grok_image_annotation_enabled%22%3Afalse%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D&fieldToggles=%7B%22withArticlePlainText%22%3Afalse%7D`,
                method: "GET",
                headers: {
                  authorization: tokens.bearerToken,
                  "content-type": "application/json",
                  "x-csrf-token": tokens.csrfToken,
                  "x-twitter-auth-type": "OAuth2Session",
                  "x-twitter-active-user": "yes",
                },
              },
            },
            resolve
          );
        });
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to fetch tweets");
      }

      // Rest of the existing code to process tweets...
      const data = response.data;
      console.log("Fetched tweets:", data);

      // Get the entries from the timeline
      const entries =
        data.data?.user?.result?.timeline_v2?.timeline?.instructions[2]
          ?.entries || [];
      console.log("Entries:", entries);

      // Transform the data into our Tweet interface format
      const transformedTweets = entries
        .filter(
          (entry: any) =>
            entry.content?.itemContent?.tweet_results?.result?.legacy
        )
        .map((entry: any) => {
          const tweet = entry.content.itemContent.tweet_results.result.legacy;
          return {
            id: tweet.id_str || entry.entryId,
            text: tweet.full_text,
            author: selectedUser?.screen_name || "Unknown",
            authorId: selectedUser?.rest_id || "Unknown",
          };
        });

      console.log("Transformed tweets:", transformedTweets);
      setTweets(transformedTweets);
    } catch (err) {
      console.error("Error fetching tweets:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch tweets");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonaSubmit = () => {
    console.log("Saving persona:", persona);
    chrome.storage.sync.set({ persona }, () => {
      alert("Persona saved successfully!");
    });
  };

  const handleGenerateComment = async (tweetId: string) => {
    chrome.runtime.sendMessage(
      { type: "GENERATE_COMMENT", tweetId },
      (response) => {
        if (response && response.comment) {
          setGeneratedComments((prev) => ({
            ...prev,
            [tweetId]: response.comment,
          }));
        }
      }
    );
  };

  const createTweet = async (text: string, replyToTweetId?: string) => {
    try {
      const tokens = await fetchAuthTokens();

      if (!tokens?.bearerToken || !tokens?.csrfToken) {
        throw new Error("Authentication tokens not found");
      }

      const payload: CreateTweetPayload = {
        variables: {
          tweet_text: text,
          dark_request: false,
          media: {
            media_entities: [],
            possibly_sensitive: false,
          },
          semantic_annotation_ids: [],
          disallowed_reply_options: null,
        },
        features: {
          // Required features that can't be null
          responsive_web_grok_image_annotation_enabled: false,
          creator_subscriptions_quote_tweet_preview_enabled: false,
          articles_preview_enabled: true,
          rweb_video_timestamps_enabled: true,
          profile_label_improvements_pcf_label_in_post_enabled: true,
          responsive_web_grok_analyze_post_followups_enabled: true,
          communities_web_enable_tweet_community_results_fetch: true,
          responsive_web_jetfuel_frame: false,
          responsive_web_grok_analysis_button_from_backend: true,
          responsive_web_grok_analyze_button_fetch_trends_enabled: false,
          c9s_tweet_anatomy_moderator_badge_enabled: true,
          premium_content_api_read_enabled: false,
          rweb_tipjar_consumption_enabled: true,
          responsive_web_grok_share_attachment_enabled: true,

          // Existing features
          freedom_of_speech_not_reach_fetch_enabled: true,
          graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
          longform_notetweets_consumption_enabled: true,
          longform_notetweets_inline_media_enabled: true,
          longform_notetweets_rich_text_read_enabled: true,
          responsive_web_edit_tweet_api_enabled: true,
          responsive_web_enhance_cards_enabled: false,
          responsive_web_graphql_exclude_directive_enabled: true,
          responsive_web_graphql_skip_user_profile_image_extensions_enabled:
            false,
          responsive_web_graphql_timeline_navigation_enabled: true,
          standardized_nudges_misinfo: true,
          tweet_awards_web_tipping_enabled: false,
          tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:
            true,
          tweetypie_unmention_optimization_enabled: true,
          verified_phone_label_enabled: false,
          view_counts_everywhere_api_enabled: true,
          responsive_web_twitter_article_tweet_consumption_enabled: false,
        },
        queryId: "UYy4T67XpYXgWKOafKXB_A",
      };

      if (replyToTweetId) {
        payload.variables.reply = {
          in_reply_to_tweet_id: replyToTweetId,
          exclude_reply_user_ids: [],
        };
      }

      const response = await fetch(
        "https://x.com/i/api/graphql/UYy4T67XpYXgWKOafKXB_A/CreateTweet",
        {
          method: "POST",
          headers: {
            accept: "*/*",
            "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
            authorization: tokens.bearerToken,
            "content-type": "application/json",
            "x-csrf-token": tokens.csrfToken,
            "x-twitter-active-user": "yes",
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-client-language": "en",
            origin: "https://x.com",
            referer: "https://x.com/compose/tweet",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-client-transaction-id": `tx-${Date.now()}`,
          },
          credentials: "include",
          body: JSON.stringify(payload),
          mode: "cors",
        }
      );

      const data = await response.json();
      console.log("Tweet response:", data);

      if (data.errors) {
        console.error("Twitter API errors:", data.errors);
        throw new Error(data.errors[0]?.message || "Failed to create tweet");
      }
      return data;
    } catch (error) {
      console.error("Error creating tweet:", error);
      throw error;
    }
  };

  const likeTweet = async (tweetId: string) => {
    try {
      const tokens = await fetchAuthTokens();

      if (!tokens?.bearerToken || !tokens?.csrfToken) {
        throw new Error("Authentication tokens not found");
      }

      const response = await fetch(
        "https://x.com/i/api/graphql/lI07N6Otwv1PhnEgXILM7A/FavoriteTweet",
        {
          method: "POST",
          headers: {
            authorization: tokens.bearerToken,
            "content-type": "application/json",
            "x-csrf-token": tokens.csrfToken,
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-active-user": "yes",
            "x-client-transaction-id":
              "Ax5NvnsPmacMGW/quaVTZFmZsUv/bL5e/kzJ4NqiUZHHNxi01wIfKYnSNNZc4hce+LTudABKNheG9+f8A5764nL8C7rXAA",
            "x-client-uuid": "68038243-8ec1-43f3-8ff1-ee164a28877c",
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "cors",
            "sec-fetch-dest": "empty",
            "x-twitter-client-language": "en",

            origin: "https://x.com",
            referer: `https://x.com/${selectedUser?.screen_name}/status/${tweetId}`,
          },
          credentials: "include",
          body: JSON.stringify({
            variables: {
              tweet_id: tweetId,
            },
            queryId: "lI07N6Otwv1PhnEgXILM7A",
          }),
          mode: "cors",
        }
      );

      const data = await response.json();
      console.log("Like response:", data);

      if (data.errors) {
        throw new Error(data.errors[0]?.message || "Failed to like tweet");
      }
      return data;
    } catch (error) {
      console.error("Error liking tweet:", error);
      throw error;
    }
  };

  const handlePostComment = async (tweetId: string) => {
    const comment = generatedComments[tweetId];
    console.log("Posting comment:", comment, "to tweet:", tweetId);

    if (!comment || comment.trim().length === 0) {
      alert("Comment cannot be empty");
      return;
    }

    if (comment.length > 280) {
      alert("Comment is too long (max 280 characters)");
      return;
    }

    try {
      await createTweet(comment, tweetId);
      alert("Comment posted successfully!");
    } catch (error) {
      console.error("Error posting comment:", error);
      alert("Failed to post comment: " + (error as Error).message);
    }
  };

  const handleAddUser = async () => {
    if (!username) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: "FETCH_USER_ID",
        username: username.replace("@", ""),
      });

      if (response.success && response.user) {
        await chrome.runtime.sendMessage({
          type: "SAVE_USER",
          user: response.user,
        });

        // Refresh user list
        chrome.runtime.sendMessage({ type: "GET_SAVED_USERS" }, (response) => {
          setSavedUsers(response.users);
        });

        setUsername("");
      }
    } catch (error) {
      console.error("Error adding user:", error);
    }
  };

  const handleUserSelect = (event: SelectChangeEvent<string>) => {
    const selectedId = event.target.value;
    const user = savedUsers.find((u) => u.rest_id === selectedId);
    setSelectedUser(user || null);
    if (user) {
      fetchTweets(user.rest_id);
    }
  };

  const handleEditComment = (tweetId: string) => {
    setEditingComments((prev) => ({
      ...prev,
      [tweetId]: true,
    }));
  };

  const getTweetUrl = (authorId: string, tweetId: string) =>
    `https://x.com/${authorId}/status/${tweetId}`;

  return (
    <ThemeProvider theme={theme}>
      <Container
        sx={{
          py: 2,
          bgcolor: "background.default",
          height: "100%",
          maxWidth: "100% !important",
          px: "16px !important",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            borderRadius: 2,
            bgcolor: "white",
            p: 2,
            mb: 3,
            position: "sticky",
            top: 0,
            zIndex: 1,
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          }}
        >
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            variant="fullWidth"
            sx={{
              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: 500,
                minHeight: "48px",
              },
            }}
          >
            <Tab label="Persona Settings" />
            <Tab label="Tweet Manager" />
          </Tabs>
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", pb: 2 }}>
          {tabValue === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Set Your Persona
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                margin="normal"
                label="Personality Description"
                value={persona.personality}
                onChange={(e) =>
                  setPersona((prev) => ({
                    ...prev,
                    personality: e.target.value,
                  }))
                }
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                margin="normal"
                label="Common Phrases"
                value={persona.commonPhrases}
                onChange={(e) =>
                  setPersona((prev) => ({
                    ...prev,
                    commonPhrases: e.target.value,
                  }))
                }
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                margin="normal"
                label="Interests"
                value={persona.interests}
                onChange={(e) =>
                  setPersona((prev) => ({ ...prev, interests: e.target.value }))
                }
              />
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handlePersonaSubmit}
                sx={{ mt: 2 }}
              >
                Save Persona
              </Button>
            </Box>
          )}

          {tabValue === 1 && (
            <Box>
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 2,
                  position: "sticky",
                  top: 80, // Below tabs
                  zIndex: 1,
                  mb: 2,
                  backgroundColor: "white",
                }}
              >
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                      fullWidth
                      label="Twitter Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username"
                      size="small"
                      variant="outlined"
                      InputProps={{
                        startAdornment: "@",
                        sx: { height: "40px" },
                      }}
                    />
                    <IconButton
                      color="primary"
                      onClick={handleAddUser}
                      sx={{
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                        bgcolor: (theme) =>
                          alpha(theme.palette.primary.main, 0.1),
                        "&:hover": {
                          bgcolor: (theme) =>
                            alpha(theme.palette.primary.main, 0.2),
                        },
                      }}
                    >
                      <PersonAddIcon />
                    </IconButton>
                  </Stack>

                  <FormControl fullWidth size="small">
                    <InputLabel id="user-select-label">Select User</InputLabel>
                    <Select
                      labelId="user-select-label"
                      value={selectedUser?.rest_id || ""}
                      onChange={handleUserSelect}
                      sx={{
                        height: "40px",
                        "& .MuiSelect-select": {
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        },
                      }}
                    >
                      {savedUsers.length === 0 ? (
                        <MenuItem disabled>
                          <Typography color="text.secondary">
                            No users added yet
                          </Typography>
                        </MenuItem>
                      ) : (
                        savedUsers.map((user) => (
                          <MenuItem
                            key={user.rest_id}
                            value={user.rest_id}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              borderBottom: "1px solid",
                              borderColor: "divider",
                              "&:last-child": {
                                borderBottom: "none",
                              },
                            }}
                          >
                            <Avatar
                              sx={{
                                width: 28,
                                height: 28,
                                bgcolor: (theme) =>
                                  alpha(theme.palette.primary.main, 0.1),
                                color: "primary.main",
                                fontSize: "0.875rem",
                              }}
                            >
                              {user.name[0].toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 500, color: "text.primary" }}
                              >
                                {user.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "text.secondary",
                                  display: "block",
                                }}
                              >
                                @{user.screen_name}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Stack>
              </Paper>

              <Button
                variant="contained"
                onClick={() => fetchTweets()}
                disabled={isLoading}
                startIcon={
                  isLoading ? <CircularProgress size={20} /> : <RefreshIcon />
                }
                sx={{ borderRadius: 2 }}
              >
                {isLoading ? "Fetching..." : "Fetch Latest Tweets"}
              </Button>
            </Box>
          )}

          {isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : tweets.length === 0 ? (
            <Box
              sx={{
                textAlign: "center",
                py: 4,
                color: "text.secondary",
              }}
            >
              <Typography variant="body1">No tweets loaded yet</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Select a user and click "Fetch Latest Tweets"
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {tweets.map((tweet) => (
                <Paper
                  key={tweet.id}
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    },
                    mb: 2,
                  }}
                >
                  <Stack spacing={2}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar
                          sx={{
                            width: 24,
                            height: 24,
                            bgcolor: (theme) =>
                              alpha(theme.palette.primary.main, 0.1),
                            color: "primary.main",
                            fontSize: "0.875rem",
                          }}
                        >
                          {selectedUser?.name?.[0].toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600 }}
                          >
                            {selectedUser?.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            @{selectedUser?.screen_name}
                          </Typography>
                        </Box>
                      </Stack>
                      <Tooltip title="Open tweet">
                        <IconButton
                          size="small"
                          component="a"
                          href={getTweetUrl(tweet.authorId, tweet.id)}
                          target="_blank"
                          sx={{
                            color: "text.secondary",
                            "&:hover": { color: "primary.main" },
                          }}
                        >
                          <LinkIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                      {tweet.text}
                    </Typography>

                    <Box sx={{ pt: 1, borderTop: 1, borderColor: "divider" }}>
                      {generatedComments[tweet.id] ? (
                        <Stack spacing={2}>
                          {editingComments[tweet.id] ? (
                            <TextField
                              fullWidth
                              multiline
                              rows={2}
                              value={generatedComments[tweet.id]}
                              onChange={(e) =>
                                setGeneratedComments((prev) => ({
                                  ...prev,
                                  [tweet.id]: e.target.value,
                                }))
                              }
                              variant="outlined"
                              size="small"
                              sx={{ bgcolor: "background.paper" }}
                            />
                          ) : (
                            <Typography
                              variant="body2"
                              sx={{
                                color: "text.secondary",
                                bgcolor: (theme) =>
                                  alpha(theme.palette.primary.main, 0.05),
                                p: 1.5,
                                borderRadius: 1,
                              }}
                            >
                              {generatedComments[tweet.id]}
                            </Typography>
                          )}

                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="flex-end"
                          >
                            <Tooltip title="Like Tweet">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  likeTweet(tweet.id)
                                    .then(() => {
                                      alert("Tweet liked successfully!");
                                    })
                                    .catch((error) => {
                                      alert(
                                        "Failed to like tweet: " + error.message
                                      );
                                    });
                                }}
                                sx={{
                                  color: "error.main",
                                  "&:hover": {
                                    bgcolor: (theme) =>
                                      alpha(theme.palette.error.main, 0.1),
                                  },
                                }}
                              >
                                <FavoriteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip
                              title={
                                editingComments[tweet.id] ? "Save" : "Edit"
                              }
                            >
                              <IconButton
                                size="small"
                                onClick={() => {
                                  if (editingComments[tweet.id]) {
                                    setEditingComments((prev) => ({
                                      ...prev,
                                      [tweet.id]: false,
                                    }));
                                  } else {
                                    handleEditComment(tweet.id);
                                  }
                                }}
                                sx={{
                                  color: editingComments[tweet.id]
                                    ? "success.main"
                                    : "action.active",
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Post Comment">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handlePostComment(tweet.id)}
                                sx={{
                                  bgcolor: (theme) =>
                                    alpha(theme.palette.primary.main, 0.1),
                                  "&:hover": {
                                    bgcolor: (theme) =>
                                      alpha(theme.palette.primary.main, 0.2),
                                  },
                                }}
                              >
                                <SendIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                      ) : (
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => handleGenerateComment(tweet.id)}
                          startIcon={<RefreshIcon />}
                          sx={{ color: "text.secondary" }}
                        >
                          Generate Comment
                        </Button>
                      )}
                    </Box>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
};

export default Popup;
