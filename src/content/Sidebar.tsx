import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Avatar,
  Paper,
  Tabs,
  Tab,
  Chip,
} from "@mui/material";
import { TwitterUser, TwitterApiResponse, CreateTweetPayload } from "../types";
import EditIcon from "@mui/icons-material/Edit";
import SendIcon from "@mui/icons-material/Send";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import RefreshIcon from "@mui/icons-material/Refresh";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CommentIcon from "@mui/icons-material/Comment";
import { alpha, ThemeProvider } from "@mui/material/styles";
import { formatDistanceToNow } from "date-fns";
import TaskManager from "./TaskManager";
import { theme } from "../theme";
import Onboarding from "../components/Onboarding";
import TaskIcon from "@mui/icons-material/Task";
import TwitterIcon from "@mui/icons-material/Twitter";

interface Tweet {
  id: string;
  text: string;
  author: string;
  authorId: string;
  isLiked: boolean;
  hasCommented: boolean;
  created_at: string;
}

interface TwitterAuthTokens {
  bearerToken: string;
  csrfToken: string;
}

const Sidebar: React.FC = () => {
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
  const [likingTweets, setLikingTweets] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [commentingTweets, setCommentingTweets] = useState<{
    [key: string]: boolean;
  }>({});
  const [addingUser, setAddingUser] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMoreTweets, setHasMoreTweets] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeView, setActiveView] = useState<"interactions" | "tasks">(
    "interactions"
  );

  const loadSavedUsers = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_SAVED_USERS",
      });

      console.log("Load saved users response:", response); // Debug log

      if (!response) {
        throw new Error("No response received");
      }

      // Make sure we're setting an array
      const users = Array.isArray(response.users) ? response.users : [];
      console.log("Setting users:", users); // Debug log

      setSavedUsers(users);

      // Reset selected user if it's not in the new user list
      if (
        selectedUser &&
        !users.find((u: TwitterUser) => u.rest_id === selectedUser.rest_id)
      ) {
        setSelectedUser(null);
      }
    } catch (error) {
      console.error("Error loading saved users:", error);
      setSavedUsers([]); // Reset to empty array on error
      setSelectedUser(null);
      alert("Failed to load saved users");
    }
  };
  useEffect(() => {
    loadSavedUsers();
  }, []);

  useEffect(() => {
    // Check if onboarding is completed when component mounts
    chrome.storage.local.get(["onboardingComplete"], (result) => {
      if (!result.onboardingComplete) {
        setShowOnboarding(true);
      }
    });
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    loadSavedUsers();
  };

  const handleAddUser = async () => {
    if (!username) return;

    setAddingUser(true);

    try {
      const tokens = await fetchAuthTokens();
      if (!tokens?.bearerToken || !tokens?.csrfToken) {
        throw new Error("Authentication tokens not found");
      }

      const user = await (async function fetchUserByUsername() {
        const url = `https://x.com/i/api/graphql/32pL5BWe9WKeSK1MoPvFQQ/UserByScreenName?variables=%7B%22screen_name%22%3A%22${username}%22%7D&features=%7B%22hidden_profile_subscriptions_enabled%22%3Atrue%2C%22profile_label_improvements_pcf_label_in_post_enabled%22%3Atrue%2C%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Atrue%2C%22subscriptions_verification_info_is_identity_verified_enabled%22%3Atrue%2C%22subscriptions_verification_info_verified_since_enabled%22%3Atrue%2C%22highlights_tweets_tab_ui_enabled%22%3Atrue%2C%22responsive_web_twitter_article_notes_tab_enabled%22%3Atrue%2C%22subscriptions_feature_can_gift_premium%22%3Atrue%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%7D&fieldToggles=%7B%22withAuxiliaryUserLabels%22%3Afalse%7D`;

        const response = await fetch(`${url}`, {
          headers: {
            authorization: tokens.bearerToken,
            "x-csrf-token": tokens.csrfToken,
            "content-type": "application/json",
          },
        });

        console.log("Response:", response);

        if (!response.ok) {
          throw new Error("Failed to fetch user data");
        }

        const data = await response.json();
        if (!data.data?.user?.result) {
          throw new Error("User not found");
        }

        const userData = data.data.user.result;
        return {
          id: userData.rest_id,
          rest_id: userData.rest_id,
          name: userData.legacy.name,
          screen_name: userData.legacy.screen_name,
          following: userData.legacy.following,
          profile_image_url: userData.legacy.profile_image_url_https,
        };
      })();

      if (user) {
        await chrome.runtime.sendMessage({
          type: "SAVE_USER",
          user,
        });

        // Update local state
        setSavedUsers((prev) => [...prev, user]);
        setUsername(""); // Clear input

        // Optionally select the newly added user
        // setSelectedUser(user);
      }
    } catch (error) {
      console.error("Error fetching user by username:", error);
      alert("Failed to add user");
    } finally {
      setAddingUser(false);
    }
  };

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

  const checkIfUserReplied = async (tweetId: string): Promise<boolean> => {
    try {
      const tokens = await fetchAuthTokens();
      if (!tokens?.bearerToken || !tokens?.csrfToken) {
        throw new Error("Authentication tokens not found");
      }

      // Get current user's screen name
      const currentUserScreenName = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: "GET_CURRENT_USER_SCREEN_NAME",
          },
          (response) => {
            resolve(response.screen_name);
          }
        );
      });

      if (!currentUserScreenName) {
        throw new Error("Could not get current user info");
      }

      const variables = {
        focalTweetId: tweetId,
        referrer: "profile",
        with_rux_injections: false,
        includePromotedContent: true,
        withCommunity: true,
        withQuickPromoteEligibilityTweetFields: true,
        withBirdwatchNotes: true,
        withVoice: true,
      };

      const response = await fetch(
        `https://x.com/i/api/graphql/Ez6kRPyXbqNlhBwcNMpU-Q/TweetDetail?variables=${encodeURIComponent(
          JSON.stringify(variables)
        )}&features=${encodeURIComponent(
          JSON.stringify(FEATURES)
        )}&fieldToggles=${encodeURIComponent(JSON.stringify(FIELD_TOGGLES))}`,
        {
          headers: {
            authorization: tokens.bearerToken,
            "x-csrf-token": tokens.csrfToken,
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-active-user": "yes",
          },
          credentials: "include",
        }
      );

      const data = await response.json();
      const instructions =
        data?.data?.threaded_conversation_with_injections_v2?.instructions ||
        [];
      const entries =
        instructions.find((i: any) => i.type === "TimelineAddEntries")
          ?.entries || [];
      const conversationEntry = entries.find((entry: any) =>
        entry.entryId.includes("conversationthread")
      );

      if (!conversationEntry) return false;

      const firstReply =
        conversationEntry.content?.items?.[0]?.item?.itemContent?.tweet_results
          ?.result;
      if (!firstReply) return false;

      return (
        firstReply.legacy?.in_reply_to_status_id_str === tweetId &&
        firstReply.core?.user_results?.result?.legacy?.screen_name ===
          currentUserScreenName
      );
    } catch (error) {
      console.error("Error checking for user replies:", error);
      return false;
    }
  };

  const fetchTweets = async (userId?: string, nextCursor?: string | null) => {
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

      // Build variables object with cursor if it exists
      const variables = {
        userId: targetUserId,
        count: 20,
        includePromotedContent: true,
        withQuickPromoteEligibilityTweetFields: true,
        withVoice: true,
        withV2Timeline: true,
        ...(nextCursor && { cursor: nextCursor }),
      };

      // Create the request
      const response = await new Promise<TwitterApiResponse>(
        (resolve, reject) => {
          const requestId = Date.now();

          const handleResponse = (event: MessageEvent) => {
            if (
              event.data.type === "TWITTER_API_RESPONSE" &&
              event.data.requestId === requestId
            ) {
              window.removeEventListener("message", handleResponse);
              resolve(event.data);
            }
          };
          window.addEventListener("message", handleResponse);

          window.postMessage(
            {
              type: "TWITTER_API_REQUEST",
              requestId,
              payload: {
                url: `https://x.com/i/api/graphql/Y9WM4Id6UcGFE8Z-hbnixw/UserTweets?variables=${encodeURIComponent(
                  JSON.stringify(variables)
                )}&features=${encodeURIComponent(
                  JSON.stringify(FEATURES)
                )}&fieldToggles=${encodeURIComponent(
                  JSON.stringify(FIELD_TOGGLES)
                )}`,
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
            "*"
          );

          setTimeout(() => reject(new Error("Request timed out")), 10000);
        }
      );

      if (!response.success) {
        throw new Error(response.error || "Failed to fetch tweets");
      }

      const data = response.data;

      // Get the entries and cursor from the timeline
      const instructions =
        data.data?.user?.result?.timeline_v2?.timeline?.instructions || [];
      const entries =
        instructions.find(
          (instruction: any) => instruction.type === "TimelineAddEntries"
        )?.entries || [];

      // Find the next cursor
      const nextCursorEntry = entries.find(
        (entry: any) => entry.content?.cursorType === "Bottom"
      );
      const newCursor = nextCursorEntry?.content?.value;
      setCursor(newCursor);
      setHasMoreTweets(!!newCursor);

      // Transform tweets
      const transformedTweets = await Promise.all(
        entries
          .filter((entry: any) => {
            const tweet = entry.content?.itemContent?.tweet_results?.result;
            return (
              tweet &&
              !tweet.tombstone &&
              entry.content?.cursorType !== "Bottom"
            );
          })
          .map(async (entry: any) => {
            const tweet = entry.content.itemContent.tweet_results.result;
            const legacy = tweet.legacy || tweet;

            // Check if the tweet has been replied to
            // const hasReplied = await checkIfUserReplied(legacy.id_str);
            const hasReplied = false;

            return {
              id: legacy.id_str,
              text: legacy.full_text || legacy.text,
              author: selectedUser?.screen_name || "Unknown",
              authorId: selectedUser?.rest_id || "Unknown",
              isLiked: legacy.favorited || false,
              hasCommented: hasReplied,
              created_at: legacy.created_at,
            };
          })
      );

      // Update tweets state - append if loading more, replace if fresh fetch
      setTweets((prev) =>
        nextCursor ? [...prev, ...transformedTweets] : transformedTweets
      );
    } catch (err) {
      console.error("Error fetching tweets:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch tweets");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateComment = async (tweetId: string, tweetText: string) => {
    console.log("Generating comment for tweet:", tweetText);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyBmCj6xENfje_hSUC_rBkcsZB6omMfQejQ`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: tweetText }],
                role: "user",
              },
              {
                parts: [
                  {
                    text: "Generate a short (one or two liner) insightful comment for this tweet don't use hashtags",
                  },
                ],
                role: "user",
              },
            ],
          }),
        }
      );

      const data = await response.json();

      // Updated to handle the new response format
      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const generatedComment = data.candidates[0].content.parts[0].text;
        setGeneratedComments((prev) => ({
          ...prev,
          [tweetId]: generatedComment,
        }));
        // Automatically enable edit mode after generation
        setEditingComments((prev) => ({
          ...prev,
          [tweetId]: true,
        }));
      } else {
        throw new Error("Invalid response format from Gemini API");
      }
    } catch (error) {
      console.error("Error generating comment:", error);
      alert("Failed to generate comment");
    }
  };

  const handleEditComment = (tweetId: string) => {
    setEditingComments((prev) => ({
      ...prev,
      [tweetId]: true,
    }));
  };

  const createTweet = async (text: string, replyToTweetId?: string) => {
    try {
      const tokens = await fetchAuthTokens();
      if (!tokens?.bearerToken || !tokens?.csrfToken) {
        throw new Error("Authentication tokens not found");
      }

      // Add random delay between 1-3 seconds before posting
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 + Math.random() * 2000)
      );

      // Generate a realistic client UUID and transaction ID
      const clientUuid = crypto.randomUUID();
      const transactionId = `tx-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 15)}`;

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
          // Include all required features with their default values
          responsive_web_graphql_skip_user_profile_image_extensions_enabled:
            false,
          longform_notetweets_consumption_enabled: true,
          responsive_web_grok_image_annotation_enabled: false,
          rweb_tipjar_consumption_enabled: true,
          responsive_web_grok_share_attachment_enabled: true,
          c9s_tweet_anatomy_moderator_badge_enabled: true,
          communities_web_enable_tweet_community_results_fetch: true,
          responsive_web_graphql_timeline_navigation_enabled: true,
          longform_notetweets_inline_media_enabled: true,
          responsive_web_graphql_exclude_directive_enabled: true,
          responsive_web_grok_analysis_button_from_backend: true,
          premium_content_api_read_enabled: false,
          tweet_awards_web_tipping_enabled: false,
          profile_label_improvements_pcf_label_in_post_enabled: true,
          responsive_web_twitter_article_tweet_consumption_enabled: false,
          responsive_web_grok_analyze_post_followups_enabled: true,
          longform_notetweets_rich_text_read_enabled: true,
          rweb_video_timestamps_enabled: true,
          articles_preview_enabled: true,
          responsive_web_grok_analyze_button_fetch_trends_enabled: false,
          responsive_web_jetfuel_frame: false,
          creator_subscriptions_quote_tweet_preview_enabled: false,

          // Keep existing features
          freedom_of_speech_not_reach_fetch_enabled: true,
          graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
          responsive_web_edit_tweet_api_enabled: true,
          responsive_web_enhance_cards_enabled: false,
          standardized_nudges_misinfo: true,
          tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:
            true,
          verified_phone_label_enabled: false,
          view_counts_everywhere_api_enabled: true,
        },
        queryId: "UYy4T67XpYXgWKOafKXB_A",
      };

      if (replyToTweetId) {
        payload.variables.reply = {
          in_reply_to_tweet_id: replyToTweetId,
          exclude_reply_user_ids: [],
        };
      }

      // Add more realistic headers that match browser behavior
      const response = await fetch(
        "https://x.com/i/api/graphql/UYy4T67XpYXgWKOafKXB_A/CreateTweet",
        {
          method: "POST",
          headers: {
            accept: "*/*",
            "accept-language": "en-US,en;q=0.9",
            authorization: tokens.bearerToken,
            "content-type": "application/json",
            "x-csrf-token": tokens.csrfToken,
            "x-twitter-active-user": "yes",
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-client-language": "en",
            "sec-ch-ua": `"Not_A Brand";v="8", "Chromium";v="${Math.floor(
              Math.random() * 10 + 110
            )}"`,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-client-transaction-id": transactionId,
            "x-client-uuid": clientUuid,
            Referer: `https://x.com/${selectedUser?.screen_name}/status/${replyToTweetId}`,
            "Referrer-Policy": "strict-origin-when-cross-origin",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (data.errors) {
        // Add retry logic for rate limiting
        if (data.errors[0]?.code === 226) {
          // Wait 5-10 seconds and try again
          await new Promise((resolve) =>
            setTimeout(resolve, 5000 + Math.random() * 5000)
          );
          throw new Error("Rate limited - please try again");
        }
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
    if (!comment || comment.trim().length === 0) {
      alert("Comment cannot be empty");
      return;
    }

    setCommentingTweets((prev) => ({ ...prev, [tweetId]: true }));

    try {
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          await createTweet(comment, tweetId);
          break;
        } catch (error) {
          retries++;
          if (retries === maxRetries) throw error;
          // Wait between retries
          await new Promise((resolve) => setTimeout(resolve, 3000 * retries));
        }
      }

      // Update UI state
      setTweets((prev) =>
        prev.map((tweet) =>
          tweet.id === tweetId ? { ...tweet, hasCommented: true } : tweet
        )
      );

      // Clear the generated comment
      setGeneratedComments((prev) => {
        const newComments = { ...prev };
        delete newComments[tweetId];
        return newComments;
      });

      setEditingComments((prev) => {
        const newEditing = { ...prev };
        delete newEditing[tweetId];
        return newEditing;
      });
    } catch (error) {
      console.error("Error posting comment:", error);
      alert("Failed to post comment. Please try again later.");
    } finally {
      setCommentingTweets((prev) => ({ ...prev, [tweetId]: false }));
    }
  };

  const handleLikeTweet = async (tweetId: string) => {
    setLikingTweets((prev) => ({ ...prev, [tweetId]: true }));

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

      if (data.errors) {
        throw new Error(data.errors[0]?.message || "Failed to like tweet");
      }

      // Update tweets state to reflect the like
      setTweets((prev) =>
        prev.map((tweet) =>
          tweet.id === tweetId ? { ...tweet, isLiked: true } : tweet
        )
      );
    } catch (error) {
      console.error("Error liking tweet:", error);
      throw error;
    } finally {
      setLikingTweets((prev) => ({ ...prev, [tweetId]: false }));
    }
  };

  const renderTweet = (tweet: Tweet) => {
    return (
      <motion.div
        key={tweet.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all p-6 space-y-4"
      >
        <div className="flex flex-col space-y-2">
          <p className="text-gray-900 text-base leading-relaxed">
            {tweet.text}
          </p>
          <span className="text-gray-500 text-sm">
            {formatDistanceToNow(new Date(tweet.created_at), {
              addSuffix: true,
            })}
          </span>
        </div>

        <div className="flex flex-col items-center space-y-3">
          {tweet.hasCommented && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-50 text-green-600 border border-green-200"
            >
              <CommentIcon className="w-4 h-4 mr-1" />
              Commented
            </motion.div>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleLikeTweet(tweet.id)}
            disabled={likingTweets[tweet.id]}
            className={`p-2 rounded-full transition-colors ${
              tweet.isLiked
                ? "bg-red-50 text-red-500"
                : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            {likingTweets[tweet.id] ? (
              <div className="w-5 h-5 border-2 border-current rounded-full animate-spin border-t-transparent" />
            ) : (
              <FavoriteIcon className="w-5 h-5" />
            )}
          </motion.button>

          {generatedComments[tweet.id] ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-gray-50 rounded-xl p-4"
            >
              {editingComments[tweet.id] ? (
                <textarea
                  value={generatedComments[tweet.id]}
                  onChange={(e) =>
                    setGeneratedComments((prev) => ({
                      ...prev,
                      [tweet.id]: e.target.value,
                    }))
                  }
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Edit your comment..."
                />
              ) : (
                <p className="text-gray-700 text-sm leading-relaxed">
                  {generatedComments[tweet.id]}
                </p>
              )}

              <div className="flex justify-end space-x-2 mt-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() =>
                    editingComments[tweet.id]
                      ? setEditingComments((prev) => ({
                          ...prev,
                          [tweet.id]: false,
                        }))
                      : handleEditComment(tweet.id)
                  }
                  className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                >
                  {editingComments[tweet.id] ? "Done" : "Edit"}
                  <EditIcon className="w-4 h-4 ml-1" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handlePostComment(tweet.id)}
                  disabled={commentingTweets[tweet.id]}
                  className="inline-flex items-center px-3 py-1.5 text-sm bg-black text-white rounded-full hover:bg-gray-900"
                >
                  {commentingTweets[tweet.id] ? (
                    <div className="w-4 h-4 border-2 border-white rounded-full animate-spin border-t-transparent" />
                  ) : (
                    <>
                      Send
                      <SendIcon className="w-4 h-4 ml-1" />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleGenerateComment(tweet.id, tweet.text)}
              className="inline-flex items-center px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
            >
              <RefreshIcon className="w-4 h-4 mr-1" />
              Generate Comment
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  };

  const loadMoreTweets = () => {
    if (cursor && selectedUser) {
      fetchTweets(selectedUser.rest_id, cursor);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      {showOnboarding ? (
        <Onboarding onComplete={handleOnboardingComplete} />
      ) : (
        <div className="min-h-screen bg-gray-50">
          <div className="h-screen overflow-hidden">
            <div className="p-6 h-full overflow-auto">
              {activeView === "interactions" ? (
                <>
                  <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl font-bold text-gray-900 mb-6"
                  >
                    Twitter Interaction Manager
                  </motion.h1>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl shadow-md p-6 mb-6"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Enter Twitter username"
                          className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:ring-2 focus:ring-black focus:border-transparent"
                        />
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleAddUser}
                          disabled={addingUser || !username}
                          className="p-2 bg-black text-white rounded-full hover:bg-gray-900 disabled:opacity-50"
                        >
                          {addingUser ? (
                            <div className="w-6 h-6 border-2 border-white rounded-full animate-spin border-t-transparent" />
                          ) : (
                            <PersonAddIcon className="w-6 h-6" />
                          )}
                        </motion.button>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Select User
                        </label>
                        <select
                          value={selectedUser?.rest_id || ""}
                          onChange={(e) => {
                            const user = savedUsers.find(
                              (u) => u.rest_id === e.target.value
                            );
                            setSelectedUser(user || null);
                            if (user) fetchTweets(user.rest_id);
                          }}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                        >
                          <option value="">
                            {savedUsers.length === 0
                              ? "No users added yet"
                              : "Select a user"}
                          </option>
                          {savedUsers.map((user) => (
                            <option key={user.rest_id} value={user.rest_id}>
                              {user.name} (@{user.screen_name})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </motion.div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => fetchTweets()}
                    disabled={isLoading}
                    className="w-full mb-6 px-6 py-3 bg-black text-white rounded-full hover:bg-gray-900 disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white rounded-full animate-spin border-t-transparent" />
                        <span>Fetching Tweets...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <RefreshIcon className="w-5 h-5" />
                        <span>Fetch Latest Tweets</span>
                      </div>
                    )}
                  </motion.button>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-red-600"
                    >
                      {error}
                    </motion.div>
                  )}

                  <AnimatePresence mode="popLayout">
                    <div className="space-y-4">
                      {tweets.map((tweet) => renderTweet(tweet))}
                    </div>
                  </AnimatePresence>

                  {hasMoreTweets && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={loadMoreTweets}
                      disabled={isLoading}
                      className="w-full mt-6 px-6 py-3 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 disabled:opacity-50"
                    >
                      {isLoading ? "Loading..." : "Load More Tweets"}
                    </motion.button>
                  )}
                </>
              ) : (
                <TaskManager onViewChange={setActiveView} />
              )}

              {/* Navigation */}
              <div className="fixed bottom-6 right-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() =>
                    setActiveView(
                      activeView === "interactions" ? "tasks" : "interactions"
                    )
                  }
                  className="p-4 bg-black text-white rounded-full shadow-lg hover:bg-gray-900"
                >
                  {activeView === "interactions" ? (
                    <TaskIcon className="w-6 h-6" />
                  ) : (
                    <TwitterIcon className="w-6 h-6" />
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ThemeProvider>
  );
};

// Constants for the API request
const FEATURES = {
  profile_label_improvements_pcf_label_in_post_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: false,
  responsive_web_grok_share_attachment_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_analysis_button_from_backend: true,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: false,
  responsive_web_enhance_cards_enabled: false,
};

const FIELD_TOGGLES = {
  withArticlePlainText: false,
};

export default Sidebar;
