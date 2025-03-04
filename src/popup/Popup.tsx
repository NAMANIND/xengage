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
} from "@mui/material";
import { TwitterUser } from "../types";
import { SelectChangeEvent } from "@mui/material/Select";
import EditIcon from "@mui/icons-material/Edit";
import SendIcon from "@mui/icons-material/Send";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import RefreshIcon from "@mui/icons-material/Refresh";

interface UserPersona {
  personality: string;
  commonPhrases: string;
  interests: string;
}

interface Tweet {
  id: string;
  text: string;
  author: string;
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
  const [selectedUser, setSelectedUser] = useState("");
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

  const fetchTweets = async (userId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const tokens = await new Promise<TwitterAuthTokens>((resolve) => {
        chrome.runtime.sendMessage({ type: "GET_AUTH_TOKENS" }, resolve);
      });

      if (!tokens.bearerToken || !tokens.csrfToken) {
        throw new Error(
          "Please visit Twitter first to capture authentication tokens"
        );
      }

      const targetUserId = userId || "44196397";

      const response = await fetch(
        `https://x.com/i/api/graphql/Y9WM4Id6UcGFE8Z-hbnixw/UserTweets?variables=%7B%22userId%22%3A%22${targetUserId}%22%2C%22count%22%3A20%2C%22includePromotedContent%22%3Atrue%2C%22withQuickPromoteEligibilityTweetFields%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D&features=%7B%22profile_label_improvements_pcf_label_in_post_enabled%22%3Atrue%2C%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Atrue%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22premium_content_api_read_enabled%22%3Afalse%2C%22communities_web_enable_tweet_community_results_fetch%22%3Atrue%2C%22c9s_tweet_anatomy_moderator_badge_enabled%22%3Atrue%2C%22responsive_web_grok_analyze_button_fetch_trends_enabled%22%3Afalse%2C%22responsive_web_grok_analyze_post_followups_enabled%22%3Atrue%2C%22responsive_web_jetfuel_frame%22%3Afalse%2C%22responsive_web_grok_share_attachment_enabled%22%3Atrue%2C%22articles_preview_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22responsive_web_grok_analysis_button_from_backend%22%3Atrue%2C%22creator_subscriptions_quote_tweet_preview_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22rweb_video_timestamps_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_grok_image_annotation_enabled%22%3Afalse%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D&fieldToggles=%7B%22withArticlePlainText%22%3Afalse%7D`,
        {
          method: "GET",
          headers: {
            authorization: tokens.bearerToken,
            "content-type": "application/json",
            "x-csrf-token": tokens.csrfToken,
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-active-user": "yes",
          },
          credentials: "include",
          mode: "cors",
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
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
            author: tweet.user_screen_name || "Unknown",
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
      const tokens = await new Promise<TwitterAuthTokens>((resolve) => {
        chrome.runtime.sendMessage({ type: "GET_AUTH_TOKENS" }, resolve);
      });

      if (!tokens.bearerToken || !tokens.csrfToken) {
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
    setSelectedUser(event.target.value);
    // Fetch tweets for selected user
    fetchTweets(event.target.value);
  };

  const handleEditComment = (tweetId: string) => {
    setEditingComments((prev) => ({
      ...prev,
      [tweetId]: true,
    }));
  };

  return (
    <Container>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
        >
          <Tab label="Persona" />
          <Tab label="Tweets" />
        </Tabs>
      </Box>

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
              setPersona((prev) => ({ ...prev, personality: e.target.value }))
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
              setPersona((prev) => ({ ...prev, commonPhrases: e.target.value }))
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
          <Stack spacing={2} sx={{ mb: 3 }}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  fullWidth
                  label="Twitter Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@username"
                  size="small"
                  variant="outlined"
                />
                <Tooltip title="Add User">
                  <IconButton color="primary" onClick={handleAddUser}>
                    <PersonAddIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Paper>

            <FormControl fullWidth>
              <InputLabel>Select User</InputLabel>
              <Select
                value={selectedUser}
                onChange={handleUserSelect}
                size="small"
              >
                {savedUsers.map((user) => (
                  <MenuItem key={user.rest_id} value={user.rest_id}>
                    @{user.screen_name} ({user.name})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              color="primary"
              onClick={() => fetchTweets()}
              disabled={isLoading}
              startIcon={
                isLoading ? <CircularProgress size={20} /> : <RefreshIcon />
              }
            >
              {isLoading ? "Fetching..." : "Fetch Latest Tweets"}
            </Button>
          </Stack>

          {error && (
            <Typography color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}

          {tweets.length === 0 && !isLoading ? (
            <Typography variant="body1" sx={{ textAlign: "center", mt: 2 }}>
              No tweets loaded yet
            </Typography>
          ) : (
            tweets.map((tweet) => (
              <Paper
                key={tweet.id}
                elevation={2}
                sx={{
                  mb: 2,
                  p: 2,
                  borderRadius: 2,
                  background: "rgba(255, 255, 255, 0.9)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <Stack spacing={2}>
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: "bold", mb: 0.5 }}
                    >
                      {tweet.author}
                    </Typography>
                    <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                      {tweet.text}
                    </Typography>
                  </Box>

                  <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}>
                    {generatedComments[tweet.id] ? (
                      <Stack spacing={1}>
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
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {generatedComments[tweet.id]}
                          </Typography>
                        )}

                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                        >
                          <Tooltip
                            title={editingComments[tweet.id] ? "Save" : "Edit"}
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
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Post Comment">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handlePostComment(tweet.id)}
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
                      >
                        Generate Comment
                      </Button>
                    )}
                  </Box>
                </Stack>
              </Paper>
            ))
          )}
        </Box>
      )}
    </Container>
  );
};

export default Popup;
