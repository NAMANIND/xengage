(function () {
  // Store the original XHR methods
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

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
    });

    // Call the original open method
    return originalOpen.apply(this, arguments);
  };
})();
