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
} from "@mui/material";

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

  useEffect(() => {
    console.log("Loading persona from storage");
    chrome.storage.sync.get(["persona"], (result) => {
      if (result.persona) {
        setPersona(result.persona);
        console.log("Loaded persona:", result.persona);
      }
    });
  }, []);

  const fetchTweets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // First get the auth tokens
      const tokens = await new Promise<TwitterAuthTokens>((resolve) => {
        chrome.runtime.sendMessage({ type: "GET_AUTH_TOKENS" }, resolve);
      });

      if (!tokens.bearerToken || !tokens.csrfToken) {
        throw new Error(
          "Please visit Twitter first to capture authentication tokens"
        );
      }

      const response = await fetch(
        "https://x.com/i/api/graphql/Y9WM4Id6UcGFE8Z-hbnixw/UserTweets?variables=%7B%22userId%22%3A%221373515851735859201%22%2C%22count%22%3A20%2C%22includePromotedContent%22%3Atrue%2C%22withQuickPromoteEligibilityTweetFields%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D&features=%7B%22profile_label_improvements_pcf_label_in_post_enabled%22%3Atrue%2C%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Atrue%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22premium_content_api_read_enabled%22%3Afalse%2C%22communities_web_enable_tweet_community_results_fetch%22%3Atrue%2C%22c9s_tweet_anatomy_moderator_badge_enabled%22%3Atrue%2C%22responsive_web_grok_analyze_button_fetch_trends_enabled%22%3Afalse%2C%22responsive_web_grok_analyze_post_followups_enabled%22%3Atrue%2C%22responsive_web_jetfuel_frame%22%3Afalse%2C%22responsive_web_grok_share_attachment_enabled%22%3Atrue%2C%22articles_preview_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22responsive_web_grok_analysis_button_from_backend%22%3Atrue%2C%22creator_subscriptions_quote_tweet_preview_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22rweb_video_timestamps_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_grok_image_annotation_enabled%22%3Afalse%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D&fieldToggles=%7B%22withArticlePlainText%22%3Afalse%7D",
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
        data.data?.user?.result?.timeline_v2?.timeline?.instructions[1]
          ?.entries || [];

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

  const handlePostComment = async (tweetId: string) => {
    const comment = generatedComments[tweetId];
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "POST_COMMENT",
          tweetId,
          comment,
        });
      }
    });
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
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={fetchTweets}
            disabled={isLoading}
            sx={{ mb: 2 }}
          >
            {isLoading ? <CircularProgress size={24} /> : "Fetch Latest Tweets"}
          </Button>

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
              <Card key={tweet.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2">{tweet.author}</Typography>
                  <Typography variant="body1">{tweet.text}</Typography>
                  <Box sx={{ mt: 2 }}>
                    {generatedComments[tweet.id] ? (
                      <>
                        <Typography variant="body2">
                          {generatedComments[tweet.id]}
                        </Typography>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={() => handlePostComment(tweet.id)}
                          sx={{ mt: 1 }}
                        >
                          Post Comment
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleGenerateComment(tweet.id)}
                      >
                        Generate Comment
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      )}
    </Container>
  );
};

export default Popup;
