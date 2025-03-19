/// <reference types="chrome"/>

import React from "react";
import ReactDOM from "react-dom/client";
import { TwitterApiRequest, TwitterApiResponse } from "../types";
import Sidebar from "./Sidebar";
import "../styles/globals.css";

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
  if (event.data.type === "STORE_SCREEN_NAME") {
    console.log("STORE_SCREEN_NAME", event.data.screen_name);
    chrome.runtime.sendMessage({
      type: "STORE_SCREEN_NAME",
      screen_name: event.data.screen_name,
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

// Add this to handle API responses from the injected script
let nextRequestId = 1;
const pendingRequests = new Map<
  number,
  (response: TwitterApiResponse) => void
>();

// Listen for API responses from the injected script
window.addEventListener("message", function (event) {
  if (event.data.type === "TWITTER_API_RESPONSE") {
    const resolver = pendingRequests.get(event.data.requestId);
    if (resolver) {
      pendingRequests.delete(event.data.requestId);
      resolver({
        success: event.data.success,
        data: event.data.data,
        error: event.data.error,
      });
    }
  }
});

// Update the API request handler
chrome.runtime.onMessage.addListener(
  (
    request: TwitterApiRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: TwitterApiResponse) => void
  ) => {
    if (request.type === "TWITTER_API_REQUEST") {
      const requestId = nextRequestId++;

      // Store the sendResponse callback
      pendingRequests.set(requestId, sendResponse);

      // Forward request to injected script
      window.postMessage(
        {
          type: "TWITTER_API_REQUEST",
          requestId,
          payload: request.payload,
        },
        "*"
      );

      return true; // Keep the message channel open
    }
  }
);

// Create and inject the sidebar container
const sidebarContainer = document.createElement("div");
sidebarContainer.id = "twitter-interaction-sidebar";
document.body.appendChild(sidebarContainer);

// Apply styles to the container
Object.assign(sidebarContainer.style, {
  position: "fixed",
  right: "0",
  top: "0",
  height: "100vh",
  width: "min(350px, 90vw)",
  maxWidth: "350px",
  backgroundColor: "white",
  boxShadow: "-2px 0 5px rgba(0,0,0,0.1)",
  zIndex: "9999",
  transform: "translateX(350px)", // Start hidden
  transition: "transform 0.3s ease",
  overflowX: "hidden",
  overflowY: "auto",
  padding: "16px",
});

// Create a toggle button
const toggleButton = document.createElement("button");
Object.assign(toggleButton.style, {
  position: "fixed",
  right: "0px",
  top: "20px",
  zIndex: "10000",
  padding: "8px",
  backgroundColor: "#1DA1F2",
  color: "white",
  border: "none",
  borderRadius: "4px 0 0 4px",
  cursor: "pointer",
});
toggleButton.textContent = "←";
document.body.appendChild(toggleButton);
// sidebarContainer.appendChild(toggleButton);

// Toggle sidebar visibility
let isOpen = false;
toggleButton.onclick = () => {
  isOpen = !isOpen;
  sidebarContainer.style.transform = isOpen
    ? "translateX(0)"
    : "translateX(350px)";
  toggleButton.textContent = isOpen ? "→" : "←";
};

// Render the React component into the sidebar
const root = ReactDOM.createRoot(sidebarContainer);
root.render(
  <React.StrictMode>
    <Sidebar />
  </React.StrictMode>
);
