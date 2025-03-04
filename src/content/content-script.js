// Inject the script
const script = document.createElement("script");
script.src = chrome.runtime.getURL("src/content/injector.js");
(document.head || document.documentElement).appendChild(script);
alert("content-script.js");

script.onload = function () {
  script.remove();
};

// Listen for messages from the injected script
window.addEventListener("message", function (event) {
  if (event.data.type === "xhr_headers") {
    // Process the headers here
    console.log("XHR Headers:", event.data.headers);
    console.log("URL:", event.data.url);

    // You can send this to your background script if needed
    chrome.runtime.sendMessage({
      type: "xhr_headers",
      headers: event.data.headers,
      url: event.data.url,
    });
  }
});
