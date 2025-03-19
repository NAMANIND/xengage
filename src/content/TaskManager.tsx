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
  onViewChange: React.Dispatch<React.SetStateAction<"interactions" | "tasks">>;
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
          tweets: resolvedTweets.filter((tweet) => !tweet.hasCommented), // skip if the tweet has already been replied to
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

                        {!generatedComments[tweet.id] ? (
                          <Button
                            size="small"
                            variant="text"
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
                                <CircularProgress size={16} color="inherit" />
                              ) : (
                                <AutoFixHighIcon fontSize="small" />
                              )
                            }
                            sx={{
                              minWidth: 0,
                              px: 1,
                              color: "text.secondary",
                            }}
                          >
                            Generate
                          </Button>
                        ) : (
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => handleEditComment(tweet.id)}
                              startIcon={<EditIcon fontSize="small" />}
                              sx={{
                                minWidth: 0,
                                px: 1,
                                color: "text.secondary",
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
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
                                  <CircularProgress size={16} color="inherit" />
                                ) : (
                                  <SendIcon fontSize="small" />
                                )
                              }
                              sx={{
                                minWidth: 0,
                                px: 1.5,
                                bgcolor: "#1DA1F2",
                                "&:hover": {
                                  bgcolor: "#1a8cd8",
                                },
                              }}
                            >
                              Post
                            </Button>
                          </Stack>
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
      <Box
        sx={{
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          bgcolor: "#f7f9fa", // Light gray background
        }}
      >
        {/* Improved header with better styling */}
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#1DA1F2",
            boxShadow: "0 2px 8px rgba(29,161,242,0.15)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          {/* Title */}
          <div
            style={{
              color: "white",
              fontSize: "18px",
              fontWeight: 600,
              marginBottom: "12px",
              textAlign: "center",
            }}
          >
            Tweet Task Manager
          </div>

          {/* Buttons container with wrapping */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              justifyContent: "center",
            }}
          >
            <Button
              variant="outlined"
              onClick={() => handleBatchOperation(null, "like")}
              startIcon={<FavoriteIcon />}
              size="small"
              sx={{
                color: "white",
                borderColor: "rgba(255,255,255,0.5)",
                "&:hover": {
                  borderColor: "white",
                  backgroundColor: "rgba(255,255,255,0.1)",
                },
                textTransform: "none",
                borderRadius: 2,
                padding: "4px 12px",
                minWidth: "fit-content",
              }}
            >
              Like All
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleBatchOperation(null, "generate")}
              startIcon={<AutorenewIcon />}
              size="small"
              disabled={isGenerating}
              sx={{
                color: "white",
                borderColor: "rgba(255,255,255,0.5)",
                "&:hover": {
                  borderColor: "white",
                  backgroundColor: "rgba(255,255,255,0.1)",
                },
                textTransform: "none",
                borderRadius: 2,
                padding: "4px 12px",
                minWidth: "fit-content",
              }}
            >
              {isGenerating ? (
                <>
                  <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
                  Generating...
                </>
              ) : (
                "Generate All"
              )}
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleBatchOperation(null, "post")}
              startIcon={<SendIcon />}
              size="small"
              sx={{
                color: "white",
                borderColor: "rgba(255,255,255,0.5)",
                "&:hover": {
                  borderColor: "white",
                  backgroundColor: "rgba(255,255,255,0.1)",
                },
                textTransform: "none",
                borderRadius: 2,
                padding: "4px 12px",
                minWidth: "fit-content",
              }}
            >
              Post All
            </Button>
            <Button
              variant="outlined"
              onClick={loadSavedUsersAndTweets}
              startIcon={<RefreshIcon />}
              size="small"
              sx={{
                color: "white",
                borderColor: "rgba(255,255,255,0.5)",
                "&:hover": {
                  borderColor: "white",
                  backgroundColor: "rgba(255,255,255,0.1)",
                },
                textTransform: "none",
                borderRadius: 2,
                padding: "4px 12px",
                minWidth: "fit-content",
              }}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Content area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            backgroundColor: "#f7f9fa",
          }}
        >
          {/* User sections */}
          <Stack spacing={2}>
            {Object.values(userTweets).map((userTweetsData) => (
              <Paper
                key={userTweetsData.user.rest_id}
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                {/* User header - make it more compact */}
                <Box
                  sx={{
                    p: 1.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    bgcolor: "background.paper",
                    borderBottom: userTweetsData.isExpanded ? 1 : 0,
                    borderColor: "divider",
                  }}
                >
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      fontSize: "1rem",
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.1),
                      color: "primary.main",
                    }}
                    src={userTweetsData.user.profile_image_url}
                  >
                    {userTweetsData.user.name[0].toUpperCase()}
                  </Avatar>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {userTweetsData.user.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      @{userTweetsData.user.screen_name}
                    </Typography>
                  </Box>

                  {/* Action buttons - more compact */}
                  <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                    <IconButton
                      size="small"
                      onClick={() =>
                        handleBatchOperation(
                          userTweetsData.user.rest_id,
                          "like"
                        )
                      }
                      sx={{
                        color: "error.main",
                        p: 0.5,
                      }}
                    >
                      <FavoriteIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() =>
                        handleBatchOperation(
                          userTweetsData.user.rest_id,
                          "generate"
                        )
                      }
                      sx={{
                        color: "primary.main",
                        p: 0.5,
                      }}
                    >
                      <AutoFixHighIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() =>
                        handleExpandUser(userTweetsData.user.rest_id)
                      }
                      sx={{
                        p: 0.5,
                        transform: userTweetsData.isExpanded
                          ? "rotate(180deg)"
                          : "none",
                        transition: "transform 0.2s",
                      }}
                    >
                      <ExpandMoreIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>

                {/* Tweets section */}
                <Collapse in={userTweetsData.isExpanded}>
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: (theme) =>
                        alpha(theme.palette.background.default, 0.5),
                    }}
                  >
                    <Stack spacing={1.5}>
                      {userTweetsData.tweets.map((tweet) => (
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
                            title={tweet.text}
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
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              {/* link to tweet */}
                              <IconButton
                                size="small"
                                sx={{
                                  color: "primary.main",
                                  p: 0.5,
                                }}
                                onClick={() => {
                                  const url = `https://x.com/${userTweetsData.user.screen_name}/status/${tweet.id}`;
                                  window.open(url, "_blank");
                                }}
                              >
                                <LinkIcon fontSize="small" />
                              </IconButton>
                              <IconButton
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

                              {!generatedComments[tweet.id] ? (
                                <Button
                                  size="small"
                                  variant="text"
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
                                      <CircularProgress
                                        size={16}
                                        color="inherit"
                                      />
                                    ) : (
                                      <AutoFixHighIcon fontSize="small" />
                                    )
                                  }
                                  sx={{
                                    minWidth: 0,
                                    px: 1,
                                    color: "text.secondary",
                                  }}
                                >
                                  Generate
                                </Button>
                              ) : (
                                <Stack direction="row" spacing={1}>
                                  <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => handleEditComment(tweet.id)}
                                    startIcon={<EditIcon fontSize="small" />}
                                    sx={{
                                      minWidth: 0,
                                      px: 1,
                                      color: "text.secondary",
                                    }}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="contained"
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
                                        <CircularProgress
                                          size={16}
                                          color="inherit"
                                        />
                                      ) : (
                                        <SendIcon fontSize="small" />
                                      )
                                    }
                                    sx={{
                                      minWidth: 0,
                                      px: 1.5,
                                      bgcolor: "#1DA1F2",
                                      "&:hover": {
                                        bgcolor: "#1a8cd8",
                                      },
                                    }}
                                  >
                                    Post
                                  </Button>
                                </Stack>
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
                  </Box>
                </Collapse>
              </Paper>
            ))}
          </Stack>
        </div>
      </Box>
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
