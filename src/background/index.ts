/// <reference types="chrome"/>

// Define interfaces
interface TwitterAuthTokens {
  bearerToken: string;
  csrfToken: string;
}

interface ExtendedXMLHttpRequest extends XMLHttpRequest {
  _requestHeaders?: { [key: string]: string };
}

interface TwitterUser {
  id: string;
  rest_id: string;
  name: string;
  screen_name: string;
  following?: boolean;
}

interface UserResponse {
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

// Store for auth tokens
let twitterAuthTokens: TwitterAuthTokens = {
  bearerToken: "",
  csrfToken: "",
};

// Add new storage for users
let savedUsers: TwitterUser[] = [];

// Inject the interceptor script
chrome.webNavigation.onCompleted.addListener(
  (details) => {
    if (details.url.includes("twitter.com") || details.url.includes("x.com")) {
      chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        func: injectXHRInterceptor,
      });
    }
  },
  { url: [{ hostContains: "twitter.com" }, { hostContains: "x.com" }] }
);

// The interceptor function that will be injected
function injectXHRInterceptor() {
  const XHR = XMLHttpRequest.prototype as ExtendedXMLHttpRequest;
  const open = XHR.open;
  const send = XHR.send;
  const setRequestHeader = XHR.setRequestHeader;

  XHR.open = function (method: string, url: string) {
    this._requestHeaders = {};
    console.log("url", url);
    return open.call(this, method, url, true);
  };

  XHR.setRequestHeader = function (header: string, value: string) {
    if (this._requestHeaders) {
      this._requestHeaders[header] = value;
      console.log(this._requestHeaders);
    }

    if (
      header.toLowerCase() === "authorization" ||
      header.toLowerCase() === "x-csrf-token"
    ) {
      chrome.runtime.sendMessage({
        type: "CAPTURED_HEADER",
        header,
        value,
      });
    }
    return setRequestHeader.call(this, header, value);
  };

  XHR.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    return send.call(this, body);
  };
}

// Listen for captured headers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CAPTURED_HEADER") {
    if (request.header.toLowerCase() === "authorization") {
      twitterAuthTokens.bearerToken = request.value;
    } else if (request.header.toLowerCase() === "x-csrf-token") {
      twitterAuthTokens.csrfToken = request.value;
    }
  }

  if (request.type === "GET_AUTH_TOKENS") {
    sendResponse(twitterAuthTokens);
    return true;
  }

  if (request.type === "FETCH_TWEETS") {
    // Use the captured tokens
    const headers = {
      authorization: twitterAuthTokens.bearerToken,
      "content-type": "application/json",
      "x-csrf-token": twitterAuthTokens.csrfToken,
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-active-user": "yes",
    };

    // TODO: Implement Twitter API call with captured tokens
    const mockTweets = [
      {
        id: "1",
        text: "This is a sample tweet",
        author: "@sampleUser",
      },
      {
        id: "2",
        text: "Another sample tweet",
        author: "@anotherUser",
      },
    ];
    sendResponse({ tweets: mockTweets });
  }

  if (request.type === "GENERATE_COMMENT") {
    // TODO: Implement AI service integration
    const mockComment = `Generated comment for tweet ${request.tweetId}`;
    sendResponse({ comment: mockComment });
  }

  if (request.type === "FETCH_USER_ID") {
    fetchUserByUsername(request.username)
      .then((user) => sendResponse({ success: true, user }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === "SAVE_USER") {
    // Check if user already exists
    const userExists = savedUsers.some(
      (u) => u.rest_id === request.user.rest_id
    );
    if (!userExists) {
      savedUsers.push(request.user);
      // Store in extension storage
      chrome.storage.local.set({ savedUsers }, () => {
        sendResponse({ success: true, users: savedUsers });
      });
    } else {
      sendResponse({ success: false, error: "User already saved" });
    }
    return true;
  }

  if (request.type === "STORE_SCREEN_NAME") {
    console.log("store screen name", request.screen_name);
    chrome.storage.local.set({
      main_screen_name: request.screen_name,
    });

    sendResponse({ success: true });
  }

  if (request.type === "GET_CURRENT_USER_SCREEN_NAME") {
    chrome.storage.local.get("main_screen_name", (result) => {
      sendResponse({ screen_name: result.main_screen_name });
    });
    return true;
  }

  if (request.type === "GET_SAVED_USERS") {
    // Get from extension storage and update in-memory array
    chrome.storage.local.get(["savedUsers"], (result) => {
      savedUsers = result.savedUsers || [];
      sendResponse({ users: savedUsers });
    });
    return true;
  }

  return true;
});

async function fetchUserByUsername(username: string): Promise<TwitterUser> {
  const url = `https://twitter.com/i/api/graphql/G3KGOASz96M-Qu0nwmGXNg/UserByScreenName`;
  const variables = {
    screen_name: username,
    withSafetyModeUserFields: true,
    features: {
      responsive_web_twitter_blue_verified_badge_is_enabled: true,
      verified_phone_label_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: true,
    },
  };

  const response = await fetch(
    `${url}?variables=${encodeURIComponent(JSON.stringify(variables))}`,
    {
      headers: {
        authorization: twitterAuthTokens.bearerToken,
        "x-csrf-token": twitterAuthTokens.csrfToken,
        "content-type": "application/json",
      },
    }
  );

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
  };
}
