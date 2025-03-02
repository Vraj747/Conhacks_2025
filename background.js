// Listen for tab updates
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    // Only run when the page is fully loaded
    if (changeInfo.status === 'complete' && tab.url) {
        // Check if this is a product page by sending a message to the content script
        chrome.tabs.sendMessage(tabId, { action: "checkProductPage" }, function(response) {
            // If we got a response and it's a product page
            if (response && response.isProductPage) {
                console.log("Do I Need That? - Product page detected in background script");
                
                // Update the extension icon to indicate we're on a product page
                chrome.action.setIcon({
                    path: {
                        "16": "icons/icon16-active.png",
                        "48": "icons/icon48-active.png",
                        "128": "icons/icon128-active.png"
                    },
                    tabId: tabId
                });
                
                // Update the badge text
                chrome.action.setBadgeText({
                    text: "ON",
                    tabId: tabId
                });
                
                chrome.action.setBadgeBackgroundColor({
                    color: "#4CAF50",
                    tabId: tabId
                });
            } else {
                // Reset the icon for non-product pages
                chrome.action.setIcon({
                    path: {
                        "16": "icons/icon16.png",
                        "48": "icons/icon48.png",
                        "128": "icons/icon128.png"
                    },
                    tabId: tabId
                });
                
                // Clear the badge text
                chrome.action.setBadgeText({
                    text: "",
                    tabId: tabId
                });
            }
        });
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // Handle opening the popup
    if (request.action === "openPopup") {
        console.log("Do I Need That? - Opening popup from content script request");
        chrome.action.openPopup();
    }
}); 