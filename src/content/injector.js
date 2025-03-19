(function () {
  // Store the original XHR methods
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  // Add a function to handle API requests from the extension
  window.handleTwitterApiRequest = async function (request) {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        credentials: "include",
        body: request.body ? JSON.stringify(request.body) : undefined,
      });

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error("API request failed:", error);
      return { success: false, error: error.message };
    }
  };

  // Listen for API requests from the extension
  window.addEventListener("message", async function (event) {
    if (event.data.type === "TWITTER_API_REQUEST") {
      const result = await window.handleTwitterApiRequest(event.data.payload);
      window.postMessage(
        {
          type: "TWITTER_API_RESPONSE",
          requestId: event.data.requestId,
          ...result,
        },
        "*"
      );
    }
  });

  // Store headers for each XHR instance
  XMLHttpRequest.prototype._requestHeaders = {};

  // Override setRequestHeader method to capture request headers
  XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
    // Store the header
    if (!this._requestHeaders) {
      this._requestHeaders = {};
    }
    this._requestHeaders[header] = value;

    // Only send message for authorization or csrf token
    if (
      header.toLowerCase() === "authorization" ||
      header.toLowerCase() === "x-csrf-token"
    ) {
      window.postMessage(
        {
          type: "CAPTURED_HEADER",
          header: header,
          value: value,
          url: this._url,
        },
        "*"
      );
    }

    // Call original method
    return originalSetRequestHeader.apply(this, arguments);
  };

  // Override the open method
  XMLHttpRequest.prototype.open = function (
    method,
    url,
    async,
    user,
    password
  ) {
    // Store the URL for use in setRequestHeader
    this._url = url;

    // Add an event listener for when response headers are received
    this.addEventListener("readystatechange", function () {
      if (this.readyState === this.HEADERS_RECEIVED) {
        // Get all response headers
        const responseHeaders = this.getAllResponseHeaders();
        // Send response headers to content script
        window.postMessage(
          {
            type: "xhr_response_headers",
            headers: responseHeaders,
            requestHeaders: this._requestHeaders,
            url: url,
            method: method,
          },
          "*"
        );
      }

      // Capture screen_name from account settings API
      if (
        this.readyState === this.DONE &&
        url.includes("/1.1/account/settings.json")
      ) {
        try {
          const response = JSON.parse(this.responseText);
          if (response.screen_name) {
            // Send to content script to handle storage
            window.postMessage(
              {
                type: "STORE_SCREEN_NAME",
                screen_name: response.screen_name,
              },
              "*"
            );
          }
        } catch (error) {
          console.error("Error parsing account settings response:", error);
        }
      }
    });

    // Call the original open method
    return originalOpen.apply(this, arguments);
  };
})();
