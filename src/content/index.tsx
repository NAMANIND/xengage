/// <reference types="chrome"/>

import React from "react";
import ReactDOM from "react-dom/client";

interface RequestMessage {
  type: string;
  tweetId: string;
  comment: string;
}

// Function to post a comment on Twitter
const postComment = async (tweetId: string, comment: string) => {
  // TODO: Implement the actual comment posting logic
  console.log(`Posting comment "${comment}" on tweet ${tweetId}`);
};

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(
  (
    request: RequestMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: { success: boolean; error?: string }) => void
  ) => {
    if (request.type === "POST_COMMENT") {
      postComment(request.tweetId, request.comment)
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true;
    }
  }
);
