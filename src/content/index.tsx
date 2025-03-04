/// <reference types="chrome"/>

import React from "react";
import ReactDOM from "react-dom/client";

// Inject the XHR interceptor script
const script = document.createElement("script");
script.src = chrome.runtime.getURL("injector.js");
(document.head || document.documentElement).appendChild(script);

script.onload = function () {
  script.remove();
};

// Listen for messages from the injected script
window.addEventListener("message", function (event) {
  if (event.data.type === "CAPTURED_HEADER") {
    // Forward the captured header to the background script
    chrome.runtime.sendMessage({
      type: "CAPTURED_HEADER",
      header: event.data.header,
      value: event.data.value,
    });
  }
});

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
