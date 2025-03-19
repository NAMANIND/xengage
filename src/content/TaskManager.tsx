import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  CircularProgress,
  IconButton,
  Button,
  Collapse,
  Chip,
  Divider,
  Alert,
  LinearProgress,
  Avatar,
  Tooltip,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CommentIcon from "@mui/icons-material/Comment";
import RefreshIcon from "@mui/icons-material/Refresh";
import SendIcon from "@mui/icons-material/Send";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import BatchIcon from "@mui/icons-material/DynamicFeed";
import { TwitterUser } from "../types";
import { theme } from "../theme";
import { formatDistanceToNow } from "date-fns";
import { alpha } from "@mui/material/styles";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { Separator } from "../components/ui/separator";
import { Checkbox } from "../components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Heart,
  MessageSquare,
  RefreshCw,
  Send,
  Edit,
  Link,
  ChevronDown,
  ChevronUp,
  Wand2,
  ListFilter,
} from "lucide-react";

interface Tweet {
  id: string;
  text: string;
  author: string;
  authorId: string;
  isLiked: boolean;
  hasCommented: boolean;
  created_at: string;
  isHandled: boolean;
}

interface UserTweets {
  user: TwitterUser;
  tweets: Tweet[];
  isExpanded: boolean;
  isLoading: boolean;
  error: string | null;
  retryTimeout?: {
    total: number;
    remaining: number;
  };
}

interface TaskManagerProps {
  onViewChange: (view: "interactions" | "tasks") => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const TaskManager: React.FC<TaskManagerProps> = ({ onViewChange }) => {
  const [userTweets, setUserTweets] = useState<{ [key: string]: UserTweets }>(
    {}
  );
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [generatingComments, setGeneratingComments] = useState<{
    [key: string]: boolean;
  }>({});
  const [generatedComments, setGeneratedComments] = useState<{
    [key: string]: string;
  }>({});
  const [likingTweets, setLikingTweets] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [commentingTweets, setCommentingTweets] = useState<{
    [key: string]: boolean;
  }>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const updateRetryTimeout = (userId: string, total: number) => {
    const startTime = Date.now();
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, total - elapsed);

      setUserTweets((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          retryTimeout: {
            total,
            remaining,
          },
        },
      }));

      if (remaining <= 0) {
        clearInterval(intervalId);
      }
    }, 100);

    return () => clearInterval(intervalId);
  };

  useEffect(() => {
    loadSavedUsersAndTweets();
  }, []);

  const loadSavedUsersAndTweets = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_SAVED_USERS",
      });

      if (!response?.users?.length) {
        setIsInitialLoading(false);
        return;
      }

      const users = response.users;
      const initialUserTweets: { [key: string]: UserTweets } = {};

      users.forEach((user: TwitterUser) => {
        initialUserTweets[user.rest_id] = {
          user,
          tweets: [],
          isExpanded: false,
          isLoading: false,
          error: null,
        };
      });

      setUserTweets(initialUserTweets);
      setIsInitialLoading(false);

      // Fetch tweets for each user sequentially with delay
      for (const user of users) {
        await fetchUserTweets(user);
        // Add a 2-second delay between requests
        await sleep(2000);
      }
    } catch (error) {
      console.error("Error loading saved users:", error);
      setIsInitialLoading(false);
    }
  };

  const fetchUserTweets = async (user: TwitterUser, retryCount = 0) => {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds

    setUserTweets((prev) => ({
      ...prev,
      [user.rest_id]: {
        ...prev[user.rest_id],
        isLoading: true,
        error: null,
        retryTimeout: undefined,
      },
    }));

    try {
      const tokens = await fetchAuthTokens();
      if (!tokens?.bearerToken || !tokens?.csrfToken) {
        throw new Error("Authentication tokens not found");
      }

      const variables = {
        userId: user.rest_id,
        count: 20,
        includePromotedContent: true,
        withQuickPromoteEligibilityTweetFields: true,
        withVoice: true,
        withV2Timeline: true,
      };

      const response = await new Promise<any>((resolve, reject) => {
        const requestId = Date.now();
        let timeoutId: NodeJS.Timeout;

        const handleResponse = (event: MessageEvent) => {
          if (
            event.data.type === "TWITTER_API_RESPONSE" &&
            event.data.requestId === requestId
          ) {
            window.removeEventListener("message", handleResponse);
            clearTimeout(timeoutId);
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

        timeoutId = setTimeout(
          () => reject(new Error("Request timed out")),
          10000
        );
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to fetch tweets");
      }

      const data = response.data;
      const instructions =
        data.data?.user?.result?.timeline_v2?.timeline?.instructions || [];
      const entries =
        instructions.find(
          (instruction: any) => instruction.type === "TimelineAddEntries"
        )?.entries || [];

      const transformedTweets = entries
        .filter((entry: any) => {
          const tweet = entry.content?.itemContent?.tweet_results?.result;
          return (
            tweet &&
            !tweet.tombstone &&
            entry.content?.cursorType !== "Bottom" &&
            // Filter out retweets and quoted tweets
            !tweet.legacy?.retweeted_status_result &&
            !tweet.legacy?.is_quote_status &&
            tweet.legacy?.full_text // Ensure it's a regular tweet with text
          );
        })
        .map(async (entry: any) => {
          const tweet = entry.content.itemContent.tweet_results.result;
          const legacy = tweet.legacy || tweet;

          // Await the Promise here
          const hasReplied = await checkIfUserReplied(legacy.id_str);

          // skip if the tweet has already been replied to

          return {
            id: legacy.id_str,
            text: legacy.full_text || legacy.text,
            author: user.screen_name,
            authorId: user.rest_id,
            isLiked: legacy.favorited || false,
            hasCommented: hasReplied,
            created_at: legacy.created_at,
            isHandled: false,
          };
        });

      // Since we're now using async operations in the map function,
      // we need to wait for all promises to resolve
      const resolvedTweets = await Promise.all(transformedTweets);

      setUserTweets((prev) => ({
        ...prev,
        [user.rest_id]: {
          ...prev[user.rest_id],
          // tweets: resolvedTweets.filter((tweet) => !tweet.hasCommented),
          tweets: resolvedTweets,

          // skip if the tweet has already been replied to
          isLoading: false,
        },
      }));

      console.log(
        "transformedTweets for user",
        user.screen_name,
        resolvedTweets.filter((tweet) => !tweet.hasCommented)
      );
    } catch (error: any) {
      console.error("Error fetching tweets for user:", user.screen_name, error);

      // Check if it's a rate limit error
      const isRateLimit = error.message?.includes?.("Rate limit exceeded");

      if (isRateLimit && retryCount < maxRetries) {
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, retryCount);
        console.log(`Rate limit hit, retrying in ${delay / 1000} seconds...`);

        setUserTweets((prev) => ({
          ...prev,
          [user.rest_id]: {
            ...prev[user.rest_id],
            error: `Rate limit exceeded. Retrying...`,
            retryTimeout: {
              total: delay,
              remaining: delay,
            },
          },
        }));

        // Start the timeout indicator
        const cleanup = updateRetryTimeout(user.rest_id, delay);
        await sleep(delay);
        cleanup();

        return fetchUserTweets(user, retryCount + 1);
      }

      setUserTweets((prev) => ({
        ...prev,
        [user.rest_id]: {
          ...prev[user.rest_id],
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch tweets",
          retryTimeout: undefined,
        },
      }));
    }
  };

  const handleExpandUser = (userId: string) => {
    setUserTweets((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        isExpanded: !prev[userId].isExpanded,
      },
    }));
  };

  const handleMarkTweetHandled = (userId: string, tweetId: string) => {
    setUserTweets((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        tweets: prev[userId].tweets.map((tweet) =>
          tweet.id === tweetId
            ? { ...tweet, isHandled: !tweet.isHandled }
            : tweet
        ),
      },
    }));
  };

  // Add like functionality
  const handleLikeTweet = async (userId: string, tweetId: string) => {
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
          },
          credentials: "include",
          body: JSON.stringify({
            variables: {
              tweet_id: tweetId,
            },
            queryId: "lI07N6Otwv1PhnEgXILM7A",
          }),
        }
      );

      const data = await response.json();
      if (data.errors) {
        throw new Error(data.errors[0]?.message || "Failed to like tweet");
      }

      setUserTweets((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          tweets: prev[userId].tweets.map((t) =>
            t.id === tweetId ? { ...t, isLiked: true } : t
          ),
        },
      }));
    } catch (error) {
      console.error("Error liking tweet:", error);
      alert("Failed to like tweet");
    } finally {
      setLikingTweets((prev) => ({ ...prev, [tweetId]: false }));
    }
  };

  // Add comment generation and posting
  const handleGenerateComment = async (
    userId: string,
    tweetId: string,
    tweetText: string
  ) => {
    setGeneratingComments((prev) => ({ ...prev, [tweetId]: true }));

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
      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const comment = data.candidates[0].content.parts[0].text;
        setGeneratedComments((prev) => ({
          ...prev,
          [tweetId]: comment,
        }));
      } else {
        throw new Error("Invalid response format from Gemini API");
      }
    } catch (error) {
      console.error("Error generating comment:", error);
      alert("Failed to generate comment");
    } finally {
      setGeneratingComments((prev) => ({ ...prev, [tweetId]: false }));
    }
  };

  const handlePostComment = async (
    userId: string,
    tweetId: string,
    comment: string
  ) => {
    setCommentingTweets((prev) => ({ ...prev, [tweetId]: true }));
    try {
      const tokens = await fetchAuthTokens();
      if (!tokens?.bearerToken || !tokens?.csrfToken) {
        throw new Error("Authentication tokens not found");
      }

      const response = await fetch(
        "https://x.com/i/api/graphql/UYy4T67XpYXgWKOafKXB_A/CreateTweet",
        {
          method: "POST",
          headers: {
            authorization: tokens.bearerToken,
            "content-type": "application/json",
            "x-csrf-token": tokens.csrfToken,
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-active-user": "yes",
          },
          credentials: "include",
          body: JSON.stringify({
            variables: {
              tweet_text: comment,
              reply: {
                in_reply_to_tweet_id: tweetId,
                exclude_reply_user_ids: [],
              },
            },
            queryId: "UYy4T67XpYXgWKOafKXB_A",
            features: FEATURES,
          }),
        }
      );

      const data = await response.json();
      if (data.errors) {
        throw new Error(data.errors[0]?.message || "Failed to post comment");
      }

      setUserTweets((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          tweets: prev[userId].tweets.map((t) =>
            t.id === tweetId ? { ...t, hasCommented: true } : t
          ),
        },
      }));

      // Clear the generated comment
      setGeneratedComments((prev) => {
        const newComments = { ...prev };
        delete newComments[tweetId];
        return newComments;
      });
    } catch (error) {
      console.error("Error posting comment:", error);
      alert("Failed to post comment");
    } finally {
      setCommentingTweets((prev) => ({ ...prev, [tweetId]: false }));
    }
  };

  // Batch operations
  const handleBatchOperation = async (
    userId: string | null,
    operation: "like" | "generate" | "post"
  ) => {
    if (operation === "generate") {
      setIsGenerating(true);
    }

    try {
      const users = userId ? [userId] : Object.keys(userTweets);

      for (const uid of users) {
        const tweets = userTweets[uid].tweets;
        for (const tweet of tweets) {
          if (tweet.isHandled) continue;

          try {
            if (operation === "like" && !tweet.isLiked) {
              await handleLikeTweet(uid, tweet.id);
              await sleep(1000); // Add delay between likes
            } else if (
              operation === "generate" &&
              !generatedComments[tweet.id]
            ) {
              await handleGenerateComment(uid, tweet.id, tweet.text);
              await sleep(1000);
            } else if (
              operation === "post" &&
              generatedComments[tweet.id] &&
              !tweet.hasCommented
            ) {
              await handlePostComment(
                uid,
                tweet.id,
                generatedComments[tweet.id]
              );
              await sleep(2000);
            }
          } catch (error) {
            console.error(
              `Error in batch operation for tweet ${tweet.id}:`,
              error
            );
            // Continue with next tweet even if one fails
          }
        }
      }
    } catch (error) {
      console.error("Error in batch operation:", error);
    } finally {
      if (operation === "generate") {
        setIsGenerating(false);
      }
    }
  };

  const handleEditComment = (tweetId: string) => {
    // Implementation of handleEditComment function
  };

  const renderUserSection = (userTweetsData: UserTweets) => {
    const { user, tweets, isExpanded, isLoading, error, retryTimeout } =
      userTweetsData;
    const unhandledCount = tweets.filter((t) => !t.isHandled).length;

    return (
      <Paper
        elevation={0}
        sx={{
          mb: 2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            p: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            bgcolor: "background.paper",
            borderBottom: isExpanded ? "1px solid" : "none",
            borderColor: "divider",
          }}
        >
          {/* User info section */}
          <Stack direction="row" spacing={2} alignItems="center" flex={1}>
            <Avatar
              sx={{
                width: 40,
                height: 40,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                color: "primary.main",
              }}
              src={userTweetsData.user.profile_image_url}
            >
              {userTweetsData.user.name[0].toUpperCase()}
            </Avatar>
            <Box flex={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                {userTweetsData.user.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                @{userTweetsData.user.screen_name}
              </Typography>
            </Box>
          </Stack>

          {/* Action buttons */}
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="small"
              onClick={() =>
                handleBatchOperation(userTweetsData.user.rest_id, "like")
              }
              disabled={likingTweets[userTweetsData.user.rest_id]}
              startIcon={<FavoriteIcon />}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                bgcolor: "primary.main",
                "&:hover": {
                  bgcolor: "primary.dark",
                },
              }}
            >
              Like All
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() =>
                handleBatchOperation(userTweetsData.user.rest_id, "generate")
              }
              disabled={generatingComments[userTweetsData.user.rest_id]}
              startIcon={<AutoFixHighIcon />}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                bgcolor: "secondary.main",
                "&:hover": {
                  bgcolor: "secondary.dark",
                },
              }}
            >
              Generate All
            </Button>
            <IconButton
              size="small"
              onClick={() => handleExpandUser(userTweetsData.user.rest_id)}
              sx={{
                transform: isExpanded ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          </Stack>
        </Box>

        <Collapse in={isExpanded}>
          <Box
            sx={{
              p: 2,
              bgcolor: (theme) => alpha(theme.palette.background.default, 0.5),
            }}
          >
            {isLoading ? (
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                p={2}
                gap={1}
              >
                <CircularProgress size={24} color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Fetching tweets...
                </Typography>
              </Box>
            ) : error ? (
              <Alert
                severity={retryTimeout ? "warning" : "error"}
                sx={{
                  mb: retryTimeout ? 1 : 2,
                  borderRadius: 2,
                }}
              >
                {error}
                {retryTimeout && (
                  <Box sx={{ width: "100%", mt: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={
                        (retryTimeout.remaining / retryTimeout.total) * 100
                      }
                      sx={{
                        borderRadius: 1,
                        height: 6,
                        bgcolor: (theme) =>
                          alpha(theme.palette.warning.main, 0.1),
                        "& .MuiLinearProgress-bar": {
                          bgcolor: "warning.main",
                        },
                      }}
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 0.5, display: "block" }}
                    >
                      Retrying in {Math.ceil(retryTimeout.remaining / 1000)}s
                    </Typography>
                  </Box>
                )}
              </Alert>
            ) : (
              <Stack spacing={2}>
                {tweets.map((tweet) => (
                  <Paper
                    key={tweet.id}
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: "background.paper",
                      "&:hover": {
                        transform: "translateY(-1px)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      },
                    }}
                  >
                    {/* Tweet text with ellipsis */}
                    <Typography
                      variant="body2"
                      sx={{
                        mb: 1.5,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {tweet.text}
                    </Typography>

                    {/* Generated comment section */}
                    {generatedComments[tweet.id] && (
                      <Box
                        sx={{
                          mt: 1,
                          mb: 2,
                          p: 1.5,
                          bgcolor: alpha("#1DA1F2", 0.05),
                          borderRadius: 1,
                          border: "1px solid",
                          borderColor: alpha("#1DA1F2", 0.1),
                        }}
                      >
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ whiteSpace: "pre-wrap" }}
                        >
                          {generatedComments[tweet.id]}
                        </Typography>
                      </Box>
                    )}

                    {/* Tweet actions */}
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <IconButton
                          size="small"
                          onClick={() =>
                            handleLikeTweet(
                              userTweetsData.user.rest_id,
                              tweet.id
                            )
                          }
                          disabled={likingTweets[tweet.id]}
                          sx={{
                            p: 0.5,
                            color: tweet.isLiked
                              ? "error.main"
                              : "action.active",
                          }}
                        >
                          {likingTweets[tweet.id] ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <FavoriteIcon fontSize="small" />
                          )}
                        </IconButton>

                        {/* Comment Generation and Posting */}
                        {tweet.hasCommented ? (
                          <Button
                            variant="contained"
                            size="medium"
                            disabled
                            startIcon={<CommentIcon />}
                            sx={{
                              backgroundColor: "success.main",
                              "&:hover": {
                                backgroundColor: "success.dark",
                              },
                            }}
                          >
                            Commented
                          </Button>
                        ) : generatedComments[tweet.id] ? (
                          <Stack direction="row" spacing={1}>
                            <Box
                              sx={{
                                p: 2,
                                bgcolor: "background.paper",
                                borderRadius: 1,
                                border: "1px solid",
                                borderColor: "divider",
                              }}
                            >
                              <Typography variant="body2">
                                {generatedComments[tweet.id]}
                              </Typography>
                            </Box>
                            <Button
                              variant="contained"
                              size="medium"
                              onClick={() =>
                                handlePostComment(
                                  userTweetsData.user.rest_id,
                                  tweet.id,
                                  generatedComments[tweet.id]
                                )
                              }
                              disabled={commentingTweets[tweet.id]}
                              startIcon={
                                commentingTweets[tweet.id] ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <SendIcon />
                                )
                              }
                              sx={{
                                backgroundColor: "black",
                                "&:hover": {
                                  backgroundColor: "rgba(0, 0, 0, 0.8)",
                                },
                              }}
                            >
                              Post
                            </Button>
                          </Stack>
                        ) : (
                          <Button
                            variant="outlined"
                            size="medium"
                            onClick={() =>
                              handleGenerateComment(
                                userTweetsData.user.rest_id,
                                tweet.id,
                                tweet.text
                              )
                            }
                            disabled={generatingComments[tweet.id]}
                            startIcon={
                              generatingComments[tweet.id] ? (
                                <CircularProgress size={16} />
                              ) : (
                                <AutoFixHighIcon />
                              )
                            }
                            sx={{
                              borderColor: "black",
                              color: "black",
                              "&:hover": {
                                borderColor: "black",
                                backgroundColor: "rgba(0, 0, 0, 0.04)",
                              },
                            }}
                          >
                            Generate Comment
                          </Button>
                        )}
                      </Stack>

                      {tweet.isHandled && (
                        <Chip
                          size="small"
                          icon={<CheckCircleIcon fontSize="small" />}
                          label="Done"
                          color="success"
                          variant="outlined"
                          sx={{ height: 24 }}
                        />
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>
        </Collapse>
      </Paper>
    );
  };

  if (isInitialLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="h-full bg-background text-black"
      >
        <div className="container mx-auto p-6 space-y-6">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border border-border shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold text-foreground">
                      Task Overview
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Manage your Twitter engagement tasks
                    </CardDescription>
                  </div>
                  <Button
                    variant="outlined"
                    size="medium"
                    onClick={() => loadSavedUsersAndTweets()}
                    disabled={isInitialLoading}
                    startIcon={
                      <RefreshIcon
                        className={isInitialLoading ? "animate-spin" : ""}
                      />
                    }
                    sx={{
                      borderColor: "black",
                      color: "black",
                      "&:hover": {
                        borderColor: "black",
                        backgroundColor: "rgba(0, 0, 0, 0.04)",
                      },
                    }}
                  >
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <AnimatePresence mode="wait">
                  {isInitialLoading ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex items-center justify-center p-8"
                    >
                      <CircularProgress sx={{ color: "black" }} />
                    </motion.div>
                  ) : Object.keys(userTweets).length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="text-center p-8"
                    >
                      <Typography variant="h6" className="text-foreground mb-4">
                        No users added yet. Add users from the Interactions tab.
                      </Typography>
                      <Button
                        variant="outlined"
                        onClick={() => onViewChange("interactions")}
                        sx={{
                          borderColor: "black",
                          color: "black",
                          "&:hover": {
                            borderColor: "black",
                            backgroundColor: "rgba(0, 0, 0, 0.04)",
                          },
                        }}
                      >
                        Go to Interactions
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-6"
                    >
                      {Object.entries(userTweets).map(
                        ([userId, userData], index) => (
                          <motion.div
                            key={userId}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <Card className="border border-border">
                              <CardHeader className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <motion.img
                                      src={userData.user.profile_image_url}
                                      alt={userData.user.name}
                                      className="w-10 h-10 rounded-full"
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      transition={{ delay: index * 0.1 + 0.2 }}
                                    />
                                    <div>
                                      <CardTitle className="text-lg text-foreground">
                                        {userData.user.name}
                                      </CardTitle>
                                      <CardDescription className="text-muted-foreground">
                                        @{userData.user.screen_name}
                                      </CardDescription>
                                    </div>
                                  </div>
                                  <IconButton
                                    onClick={() => handleExpandUser(userId)}
                                    sx={{ color: "black" }}
                                  >
                                    {userData.isExpanded ? (
                                      <ExpandLessIcon />
                                    ) : (
                                      <ExpandMoreIcon />
                                    )}
                                  </IconButton>
                                </div>
                              </CardHeader>
                              <AnimatePresence>
                                {userData.isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                  >
                                    <CardContent className="p-4 pt-0">
                                      {userData.isLoading ? (
                                        <motion.div
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          className="flex items-center justify-center p-4"
                                        >
                                          <CircularProgress
                                            sx={{ color: "black" }}
                                          />
                                        </motion.div>
                                      ) : userData.error ? (
                                        <motion.div
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          className="p-4 bg-red-50 text-red-600 rounded-lg"
                                        >
                                          {userData.error}
                                          {userData.retryTimeout && (
                                            <div className="mt-2">
                                              <p className="text-sm">
                                                Retrying in{" "}
                                                {Math.ceil(
                                                  userData.retryTimeout
                                                    .remaining / 1000
                                                )}
                                                s
                                              </p>
                                              <div className="h-1 bg-red-200 rounded-full mt-1">
                                                <motion.div
                                                  className="h-full bg-red-500 rounded-full"
                                                  initial={{ width: "100%" }}
                                                  animate={{
                                                    width: `${
                                                      (userData.retryTimeout
                                                        .remaining /
                                                        userData.retryTimeout
                                                          .total) *
                                                      100
                                                    }%`,
                                                  }}
                                                  transition={{ duration: 0.1 }}
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </motion.div>
                                      ) : (
                                        <motion.div
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          className="space-y-4"
                                        >
                                          {userData.tweets.map(
                                            (tweet, tweetIndex) => (
                                              <motion.div
                                                key={tweet.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{
                                                  delay: tweetIndex * 0.05,
                                                }}
                                                className="p-4 border rounded-lg hover:bg-accent transition-colors"
                                              >
                                                <div className="flex items-start space-x-4">
                                                  <Checkbox
                                                    checked={tweet.isHandled}
                                                    onCheckedChange={() =>
                                                      handleMarkTweetHandled(
                                                        userId,
                                                        tweet.id
                                                      )
                                                    }
                                                  />
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-muted-foreground mb-1">
                                                      {formatDistanceToNow(
                                                        new Date(
                                                          tweet.created_at
                                                        ),
                                                        {
                                                          addSuffix: true,
                                                        }
                                                      )}
                                                    </p>
                                                    <p className="text-sm text-foreground">
                                                      {tweet.text}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-3">
                                                      <Button
                                                        variant={
                                                          tweet.isLiked
                                                            ? "contained"
                                                            : "outlined"
                                                        }
                                                        size="medium"
                                                        onClick={() =>
                                                          handleLikeTweet(
                                                            userId,
                                                            tweet.id
                                                          )
                                                        }
                                                        disabled={
                                                          likingTweets[tweet.id]
                                                        }
                                                        startIcon={
                                                          likingTweets[
                                                            tweet.id
                                                          ] ? (
                                                            <CircularProgress
                                                              size={16}
                                                            />
                                                          ) : (
                                                            <FavoriteIcon />
                                                          )
                                                        }
                                                        sx={{
                                                          borderColor: "black",
                                                          color: tweet.isLiked
                                                            ? "white"
                                                            : "black",
                                                          backgroundColor:
                                                            tweet.isLiked
                                                              ? "black"
                                                              : "transparent",
                                                          "&:hover": {
                                                            borderColor:
                                                              "black",
                                                            backgroundColor:
                                                              tweet.isLiked
                                                                ? "black"
                                                                : "rgba(0, 0, 0, 0.04)",
                                                          },
                                                        }}
                                                      >
                                                        {tweet.isLiked
                                                          ? "Liked"
                                                          : "Like"}
                                                      </Button>

                                                      {/* Comment Generation and Posting */}
                                                      {tweet.hasCommented ? (
                                                        <Button
                                                          variant="contained"
                                                          size="medium"
                                                          disabled
                                                          startIcon={
                                                            <CommentIcon />
                                                          }
                                                          sx={{
                                                            backgroundColor:
                                                              "success.main",
                                                            "&:hover": {
                                                              backgroundColor:
                                                                "success.dark",
                                                            },
                                                          }}
                                                        >
                                                          Commented
                                                        </Button>
                                                      ) : generatedComments[
                                                          tweet.id
                                                        ] ? (
                                                        <Stack
                                                          direction="row"
                                                          spacing={1}
                                                        >
                                                          <Box
                                                            sx={{
                                                              p: 2,
                                                              bgcolor:
                                                                "background.paper",
                                                              borderRadius: 1,
                                                              border:
                                                                "1px solid",
                                                              borderColor:
                                                                "divider",
                                                            }}
                                                          >
                                                            <Typography variant="body2">
                                                              {
                                                                generatedComments[
                                                                  tweet.id
                                                                ]
                                                              }
                                                            </Typography>
                                                          </Box>
                                                          <Button
                                                            variant="contained"
                                                            size="medium"
                                                            onClick={() =>
                                                              handlePostComment(
                                                                userId,
                                                                tweet.id,
                                                                generatedComments[
                                                                  tweet.id
                                                                ]
                                                              )
                                                            }
                                                            disabled={
                                                              commentingTweets[
                                                                tweet.id
                                                              ]
                                                            }
                                                            startIcon={
                                                              commentingTweets[
                                                                tweet.id
                                                              ] ? (
                                                                <CircularProgress
                                                                  size={16}
                                                                />
                                                              ) : (
                                                                <SendIcon />
                                                              )
                                                            }
                                                            sx={{
                                                              backgroundColor:
                                                                "black",
                                                              "&:hover": {
                                                                backgroundColor:
                                                                  "rgba(0, 0, 0, 0.8)",
                                                              },
                                                            }}
                                                          >
                                                            Post
                                                          </Button>
                                                        </Stack>
                                                      ) : (
                                                        <Button
                                                          variant="outlined"
                                                          size="medium"
                                                          onClick={() =>
                                                            handleGenerateComment(
                                                              userId,
                                                              tweet.id,
                                                              tweet.text
                                                            )
                                                          }
                                                          disabled={
                                                            generatingComments[
                                                              tweet.id
                                                            ]
                                                          }
                                                          startIcon={
                                                            generatingComments[
                                                              tweet.id
                                                            ] ? (
                                                              <CircularProgress
                                                                size={16}
                                                              />
                                                            ) : (
                                                              <AutoFixHighIcon />
                                                            )
                                                          }
                                                          sx={{
                                                            borderColor:
                                                              "black",
                                                            color: "black",
                                                            "&:hover": {
                                                              borderColor:
                                                                "black",
                                                              backgroundColor:
                                                                "rgba(0, 0, 0, 0.04)",
                                                            },
                                                          }}
                                                        >
                                                          Generate Comment
                                                        </Button>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                              </motion.div>
                                            )
                                          )}
                                        </motion.div>
                                      )}
                                    </CardContent>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </Card>
                          </motion.div>
                        )
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border border-border shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-foreground">
                  Batch Actions
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Perform actions on multiple tweets at once
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <Button
                    variant="outlined"
                    onClick={() => handleBatchOperation(null, "like")}
                    disabled={isGenerating}
                    startIcon={<FavoriteIcon />}
                    sx={{
                      borderColor: "black",
                      color: "black",
                      "&:hover": {
                        borderColor: "black",
                        backgroundColor: "rgba(0, 0, 0, 0.04)",
                      },
                    }}
                  >
                    Like All
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => handleBatchOperation(null, "generate")}
                    disabled={isGenerating}
                    startIcon={<AutoFixHighIcon />}
                    sx={{
                      borderColor: "black",
                      color: "black",
                      "&:hover": {
                        borderColor: "black",
                        backgroundColor: "rgba(0, 0, 0, 0.04)",
                      },
                    }}
                  >
                    Generate All Comments
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => handleBatchOperation(null, "post")}
                    disabled={isGenerating}
                    startIcon={<SendIcon />}
                    sx={{
                      backgroundColor: "black",
                      "&:hover": {
                        backgroundColor: "rgba(0, 0, 0, 0.8)",
                      },
                    }}
                  >
                    Post All Comments
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
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

// Helper function to fetch auth tokens
interface TwitterAuthTokens {
  bearerToken: string;
  csrfToken: string;
}

const fetchAuthTokens = async (): Promise<TwitterAuthTokens | null> => {
  try {
    const storedTokens = localStorage.getItem("twitterAuthTokens");
    if (storedTokens) {
      const tokens = JSON.parse(storedTokens) as TwitterAuthTokens;
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

    const tokens = await new Promise<TwitterAuthTokens>((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_AUTH_TOKENS" }, (response) => {
        resolve(response as TwitterAuthTokens);
      });
    });

    if (tokens?.bearerToken && tokens?.csrfToken) {
      localStorage.setItem("twitterAuthTokens", JSON.stringify(tokens));
      return tokens;
    }

    return null;
  } catch (error) {
    console.error("Error fetching auth tokens:", error);
    return null;
  }
};

// Modify the checkIfUserReplied function
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
    console.log("currentUserScreenName", currentUserScreenName);
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

    // Get the conversation thread entries
    const instructions =
      data?.data?.threaded_conversation_with_injections_v2?.instructions || [];

    const entries =
      instructions.find((i: any) => i.type === "TimelineAddEntries")?.entries ||
      [];

    // Find the first conversation thread entry
    const conversationEntry = entries.find((entry: any) =>
      entry.entryId.includes("conversationthread")
    );

    if (!conversationEntry) return false;

    // Get the first reply in the conversation thread
    const firstReply =
      conversationEntry.content?.items?.[0]?.item?.itemContent?.tweet_results
        ?.result;
    if (!firstReply) return false;

    // Check if it's from the current user using screen name
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

export default TaskManager;
