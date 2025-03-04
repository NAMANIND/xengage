/// <reference types="chrome"/>

// Define interfaces
interface TwitterAuthTokens {
  bearerToken: string;
  csrfToken: string;
}

interface ExtendedXMLHttpRequest extends XMLHttpRequest {
  _requestHeaders?: { [key: string]: string };
}

// Store for auth tokens
let twitterAuthTokens: TwitterAuthTokens = {
  bearerToken: "",
  csrfToken: "",
};

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

  return true;
});
