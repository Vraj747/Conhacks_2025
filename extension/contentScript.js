// Run as soon as the content script loads
detectShoppingIntent();
detectProductPage();

// Also run after DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  detectShoppingIntent();
  detectProductPage();
});

// Add a listener for page navigation
let lastUrl = location.href; 
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('URL changed to', url);
    
    // Check if this is a new cart/checkout page
    if (url.includes('cart') || url.includes('checkout') || url.includes('basket')) {
      // Reset all product popup statuses when user navigates to cart
      resetAllProductPopups();
    } else {
      // For product pages, continue with normal behavior
      detectShoppingIntent();
      detectProductPage();
    }
  }
}).observe(document, {subtree: true, childList: true});

// And also set up a mutation observer to detect dynamically added buttons
const observer = new MutationObserver(function(mutations) {
  detectShoppingIntent();
  detectProductPage();
});

// Start observing the document with the configured parameters
observer.observe(document.body, { childList: true, subtree: true });

// Product-specific flag to prevent repeated popups for the same product
// We'll store this in localStorage with the product URL as the key
function getProductKey() {
  return 'dineed_product_' + window.location.href.split('?')[0];
}

// Check if we've already shown a popup for this product
function hasShownPopupForCurrentProduct() {
  try {
    const key = getProductKey();
    return localStorage.getItem(key) === 'true';
  } catch (err) {
    console.error("Error checking product popup status:", err);
    return false;
  }
}

// Mark that we've shown a popup for this product
function markPopupShownForCurrentProduct() {
  try {
    const key = getProductKey();
    localStorage.setItem(key, 'true');
    console.log("Marked popup as shown for this product URL");
  } catch (err) {
    console.error("Error storing product popup status:", err);
  }
}

// Reset all product popup statuses
function resetAllProductPopups() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('dineed_product_')) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`Reset popup status for ${keysToRemove.length} products`);
  } catch (err) {
    console.error("Error resetting all product popups:", err);
  }
}

function detectShoppingIntent() {
  console.log("Detecting shopping intent...");
  
  // Check if we've already shown a popup for this product
  if (hasShownPopupForCurrentProduct()) {
    console.log("Already shown popup for this product URL, skipping detection");
    return;
  }
  
  // Define the exact selectors for shopping buttons only
  const shoppingButtonSelectors = [
    // Amazon-specific add to cart/buy now buttons
    '#add-to-cart-button',
    '#buy-now-button',
    '.a-button-input[name="submit.add-to-cart"]',
    '.a-button-input[name="submit.buy-now"]',
    
    // Walmart specific
    'button[data-tl-id="ProductPrimaryCTA-button"]',
    'button.add-to-cart-btn',
    
    // BestBuy specific
    'button.add-to-cart-button',
    'button.btn-primary[data-button-state="ADD_TO_CART"]',
    
    // eBay specific
    'a.btn.btn-prim.vi-VR-btnWdth-XL',
    'a.ux-call-to-action__link',
    
    // Generic but specific add to cart selectors
    'button[name="add-to-cart"]',
    'button.add_to_cart_button',
    'button.single_add_to_cart_button',
    'input[name="add-to-cart"]',
    'button.btn-addtocart',
    'button.add-to-cart',
    'button[data-action="add-to-cart"]'
  ];
  
  // Combined selector
  const combinedSelector = shoppingButtonSelectors.join(', ');
  
  // Find all matching buttons
  const shoppingButtons = document.querySelectorAll(combinedSelector);
  
  console.log(`Found ${shoppingButtons.length} shopping buttons`);
  
  shoppingButtons.forEach(button => {
    // Check if we've already attached a listener to this button
    if (!button.dataset.dINeedListenerAttached) {
      console.log("Found shopping button:", button);
      button.dataset.dINeedListenerAttached = "true";
      
      button.addEventListener('click', function(e) {
        console.log("Shopping button clicked:", e.target);
        
        // Check again if we've already shown popup for this product
        if (hasShownPopupForCurrentProduct()) {
          console.log("Already shown popup for this product URL, allowing click to proceed");
          return true; // Allow the click to proceed normally
        }
        
        e.preventDefault();
        e.stopPropagation();
        collectProductInfo();
        showReflectionPopup(e);
        return false;
      }, true);
    }
  });
}

function collectProductInfo() {
  let productInfo = {
    title: "",
    price: "",
    category: "",
    url: window.location.href
  };

  // Amazon specific
  if (window.location.hostname.includes('amazon')) {
    productInfo.title = document.querySelector('#productTitle')?.textContent.trim() || '';
    productInfo.price = document.querySelector('.a-price .a-offscreen')?.textContent.trim() || '';
    
    // Try to determine product category
    const breadcrumbs = document.querySelectorAll('#wayfinding-breadcrumbs_feature_div li');
    if (breadcrumbs.length > 0) {
      productInfo.category = breadcrumbs[0].textContent.trim();
    }
  }
  
  // Add similar selectors for other supported sites
  
  chrome.storage.local.set({currentProduct: productInfo});
}

function showReflectionPopup(e) {
  console.log("Showing reflection popup");
  
  // Check if we already have an overlay active
  if (document.querySelector('.dineed-overlay')) {
    console.log("Popup already active");
    return;
  }
  
  // Prevent the default click action temporarily
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  // Get the product info
  chrome.storage.local.get(['currentProduct'], function(data) {
    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.className = 'dineed-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.zIndex = '2147483647'; // Maximum z-index
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    
    // Create the popup with modern design
    const popup = document.createElement('div');
    popup.className = 'dineed-popup';
    popup.style.backgroundColor = 'white';
    popup.style.width = '450px';
    popup.style.maxWidth = '92%';
    popup.style.borderRadius = '12px';
    popup.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
    popup.style.overflow = 'hidden';
    popup.style.fontFamily = 'Arial, sans-serif';
    
    // Format product info if available
    let productInfo = '';
    let productTitle = data.currentProduct && data.currentProduct.title ? data.currentProduct.title : '';
    let productPrice = data.currentProduct && data.currentProduct.price ? data.currentProduct.price : '';
    
    // Create header section
    const headerSection = document.createElement('div');
    headerSection.style.padding = '20px';
    headerSection.style.textAlign = 'center';
    headerSection.style.borderBottom = '1px solid #f0f0f0';
    
    headerSection.innerHTML = `
      <h2 style="margin: 0; color: #333; font-size: 24px; font-weight: 600;">Do I Need That?</h2>
      <p style="margin: 10px 0 0; color: #666; font-size: 16px;">Take a moment to reflect on this purchase.</p>
    `;
    
    // Create product section
    const productSection = document.createElement('div');
    productSection.style.padding = '20px';
    productSection.style.backgroundColor = '#f9f9f9';
    productSection.style.borderBottom = '1px solid #f0f0f0';
    productSection.style.fontSize = '14px';
    productSection.style.lineHeight = '1.4';
    productSection.style.textAlign = 'center';
    
    if (productTitle) {
      productSection.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px; word-wrap: break-word;">${productTitle}</div>
        <div style="font-size: 18px; color: #e47911; font-weight: bold;">${productPrice}</div>
      `;
    } else {
      productSection.innerHTML = `<p style="margin: 0; font-style: italic; color: #999;">Product information not available</p>`;
    }
    
    // Create buttons section
    const buttonsSection = document.createElement('div');
    buttonsSection.style.padding = '20px';
    buttonsSection.style.display = 'flex';
    buttonsSection.style.justifyContent = 'space-between';
    buttonsSection.style.gap = '10px';
    
    // Yes, I need it button
    const yesButton = document.createElement('button');
    yesButton.id = 'dineed-yes';
    yesButton.textContent = 'Yes, I need it';
    yesButton.style.flex = '1';
    yesButton.style.padding = '12px 0';
    yesButton.style.border = 'none';
    yesButton.style.borderRadius = '8px';
    yesButton.style.backgroundColor = '#e0e0e0';
    yesButton.style.color = '#333';
    yesButton.style.fontWeight = 'bold';
    yesButton.style.fontSize = '14px';
    yesButton.style.cursor = 'pointer';
    yesButton.style.transition = 'background-color 0.2s';
    
    // Add hover effect
    yesButton.onmouseover = function() {
      this.style.backgroundColor = '#d0d0d0';
    };
    yesButton.onmouseout = function() {
      this.style.backgroundColor = '#e0e0e0';
    };
    
    // Show alternatives button
    const altButton = document.createElement('button');
    altButton.id = 'dineed-alternatives';
    altButton.textContent = 'Show alternatives';
    altButton.style.flex = '1';
    altButton.style.padding = '12px 0';
    altButton.style.border = 'none';
    altButton.style.borderRadius = '8px';
    altButton.style.backgroundColor = '#4CAF50';
    altButton.style.color = 'white';
    altButton.style.fontWeight = 'bold';
    altButton.style.fontSize = '14px';
    altButton.style.cursor = 'pointer';
    altButton.style.transition = 'background-color 0.2s';
    
    // Add hover effect
    altButton.onmouseover = function() {
      this.style.backgroundColor = '#3d9140';
    };
    altButton.onmouseout = function() {
      this.style.backgroundColor = '#4CAF50';
    };
    
    // No, I'll skip it button
    const noButton = document.createElement('button');
    noButton.id = 'dineed-no';
    noButton.textContent = "No, I'll skip it";
    noButton.style.flex = '1';
    noButton.style.padding = '12px 0';
    noButton.style.border = 'none';
    noButton.style.borderRadius = '8px';
    noButton.style.backgroundColor = '#2196F3';
    noButton.style.color = 'white';
    noButton.style.fontWeight = 'bold';
    noButton.style.fontSize = '14px';
    noButton.style.cursor = 'pointer';
    noButton.style.transition = 'background-color 0.2s';
    
    // Add hover effect
    noButton.onmouseover = function() {
      this.style.backgroundColor = '#0b7dda';
    };
    noButton.onmouseout = function() {
      this.style.backgroundColor = '#2196F3';
    };
    
    // Add buttons to buttons section
    buttonsSection.appendChild(yesButton);
    buttonsSection.appendChild(altButton);
    buttonsSection.appendChild(noButton);
    
    // Add all sections to popup
    popup.appendChild(headerSection);
    popup.appendChild(productSection);
    popup.appendChild(buttonsSection);
    
    // Add popup to overlay
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    // Handle button clicks
    document.getElementById('dineed-yes').addEventListener('click', function() {
      console.log("User clicked 'Yes'");
      
      // Mark that we've shown a popup for this product URL
      // This will prevent showing the popup again for this product
      markPopupShownForCurrentProduct();
      
      // Remove the popup
      removePopup();
      
      // Trigger the original button click after a short delay
      setTimeout(() => {
        try {
          // For Amazon specifically, we need a special approach
          if (window.location.hostname.includes('amazon')) {
            console.log("Using Amazon-specific approach");
            
            // Find the actual add to cart button
            const addToCartButton = document.querySelector('#add-to-cart-button');
            if (addToCartButton) {
              console.log("Found add-to-cart button, clicking natively");
              
              // Use the native click() method
              addToCartButton.click();
              return;
            }
            
            // Find the buy now button as fallback
            const buyNowButton = document.querySelector('#buy-now-button');
            if (buyNowButton) {
              console.log("Found buy-now button, clicking natively");
              buyNowButton.click();
              return;
            }
            
            // If specific buttons not found, try to find the closest form
            if (e && e.target) {
              const originalTarget = e.target;
              const form = originalTarget.closest('form');
              if (form) {
                console.log("Submitting form");
                form.submit();
                return;
              }
            }
          } else {
            // Non-Amazon sites can use the regular approach
            if (e && e.target) {
              const originalTarget = e.target;
              
              // Try to submit the form if it exists
              const form = originalTarget.closest('form');
              if (form) {
                console.log("Submitting form");
                form.submit();
                return;
              }
              
              // Create a new click event that won't be intercepted
              console.log("Clicking original target with new event");
              const originalEvent = new MouseEvent('click', {
                bubbles: false, // Don't bubble to avoid our own listeners
                cancelable: true,
                view: window
              });
              
              // Temporarily remove our click listener from the target
              if (originalTarget.dataset) {
                delete originalTarget.dataset.dINeedListenerAttached;
              }
              
              // Dispatch the event
              originalTarget.dispatchEvent(originalEvent);
            }
          }
        } catch (err) {
          console.error("Error proceeding with original action:", err);
        }
      }, 100);
    });
    
    document.getElementById('dineed-alternatives').addEventListener('click', function() {
      console.log("User clicked 'Show alternatives'");
      
      // Remove the popup
      removePopup();
      
      // Show loading state
      const loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'dineed-overlay';
      loadingOverlay.style.position = 'fixed';
      loadingOverlay.style.top = '0';
      loadingOverlay.style.left = '0';
      loadingOverlay.style.width = '100%';
      loadingOverlay.style.height = '100%';
      loadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      loadingOverlay.style.zIndex = '2147483647';
      loadingOverlay.style.display = 'flex';
      loadingOverlay.style.justifyContent = 'center';
      loadingOverlay.style.alignItems = 'center';
      
      const loadingContent = document.createElement('div');
      loadingContent.className = 'dineed-popup dineed-loading';
      loadingContent.style.backgroundColor = 'white';
      loadingContent.style.borderRadius = '12px';
      loadingContent.style.padding = '30px';
      loadingContent.style.width = '400px';
      loadingContent.style.maxWidth = '90%';
      loadingContent.style.textAlign = 'center';
      loadingContent.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
      
      loadingContent.innerHTML = `
        <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Finding sustainable alternatives...</h2>
        <div style="margin: 25px auto; width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #4CAF50; border-radius: 50%; animation: dineed-spin 1s linear infinite;"></div>
        <p style="margin: 0; color: #666;">We're searching second-hand marketplaces and sustainable brands</p>
      `;
      
      // Add keyframe animation
      const styleSheet = document.createElement('style');
      styleSheet.textContent = `
        @keyframes dineed-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styleSheet);
      
      loadingOverlay.appendChild(loadingContent);
      document.body.appendChild(loadingOverlay);
      
      // Find alternatives
      findAlternatives();
      
      // Set a timeout to ensure we show something even if the backend is slow
      setTimeout(() => {
        // Check if we still have the loading overlay
        const currentOverlay = document.querySelector('.dineed-overlay .dineed-loading');
        if (currentOverlay) {
          // If we're still loading after 5 seconds, show some default alternatives
          chrome.storage.local.get(['currentProduct'], function(data) {
            if (data.currentProduct) {
              // Create some default second-hand marketplace links
              const productTitle = encodeURIComponent(data.currentProduct.title || '');
              const secondHandAlts = [
                {
                  title: `Find "${data.currentProduct.title}" on eBay`,
                  price: "Various prices",
                  source: "eBay",
                  url: `https://www.ebay.com/sch/i.html?_nkw=${productTitle}`,
                  isSearchUrl: true
                },
                {
                  title: `Find "${data.currentProduct.title}" on Poshmark`,
                  price: "Various prices",
                  source: "Poshmark",
                  url: `https://poshmark.com/search?query=${productTitle}`,
                  isSearchUrl: true
                }
              ];
              
              // Display the alternatives
              displayAlternatives(secondHandAlts, null, data.currentProduct);
            }
          });
        }
      }, 5000);
    });
    
    document.getElementById('dineed-no').addEventListener('click', function() {
      console.log("User clicked 'No'");
      
      // Mark that we've shown a popup for this product URL
      // This will prevent showing the popup again for this product
      markPopupShownForCurrentProduct();
      
      removePopup();
      // Maybe show a positive reinforcement message
      showSavedMessage();
      
      // Update stats
      chrome.storage.local.get(['reconsideredCount', 'moneySaved'], function(stats) {
        const reconsideredCount = (stats.reconsideredCount || 0) + 1;
        let moneySaved = stats.moneySaved || 0;
        
        if (data.currentProduct && data.currentProduct.price) {
          const priceStr = data.currentProduct.price.replace(/[^\d.]/g, '');
          const price = parseFloat(priceStr);
          if (!isNaN(price)) {
            moneySaved += price;
          }
        }
        
        chrome.storage.local.set({
          reconsideredCount: reconsideredCount,
          moneySaved: moneySaved,
          co2Saved: (stats.co2Saved || 0) + 2.5 // rough estimate of CO2 saved per item
        });
      });
    });
  });
}

function removePopup() {
  const overlay = document.querySelector('.dineed-overlay');
  if (overlay) {
    document.body.removeChild(overlay);
  }
}

function findAlternatives() {
  chrome.storage.local.get(['currentProduct'], function(data) {
    if (data.currentProduct) {
      // Send a message to the background script to find alternatives
      chrome.runtime.sendMessage({
        action: "findAlternatives",
        product: data.currentProduct
      }, function(response) {
        // Check if we got a response with alternatives
        if (response && response.secondHand && response.secondHand.length > 0) {
          // Display the alternatives
          displayAlternatives(response.secondHand, response.sustainable, data.currentProduct);
        } else {
          // If no response or no alternatives, create default ones
          const productTitle = encodeURIComponent(data.currentProduct.title || '');
          const secondHandAlts = [
            {
              title: `Find "${data.currentProduct.title}" on eBay`,
              price: "Various prices",
              source: "eBay",
              url: `https://www.ebay.com/sch/i.html?_nkw=${productTitle}`,
              isSearchUrl: true
            },
            {
              title: `Find "${data.currentProduct.title}" on Poshmark`,
              price: "Various prices",
              source: "Poshmark",
              url: `https://poshmark.com/search?query=${productTitle}`,
              isSearchUrl: true
            },
            {
              title: `Find "${data.currentProduct.title}" on Mercari`,
              price: "Various prices",
              source: "Mercari",
              url: `https://www.mercari.com/search/?keyword=${productTitle}`,
              isSearchUrl: true
            }
          ];
          
          // Display the alternatives
          displayAlternatives(secondHandAlts, null, data.currentProduct);
        }
      });
    }
  });
}

function showSavedMessage() {
  // Show success message and automatically disappear
  const savedOverlay = document.createElement('div');
  savedOverlay.className = 'dineed-overlay dineed-fade';
  savedOverlay.style.position = 'fixed';
  savedOverlay.style.top = '0';
  savedOverlay.style.left = '0';
  savedOverlay.style.width = '100%';
  savedOverlay.style.height = '100%';
  savedOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  savedOverlay.style.zIndex = '2147483647';
  savedOverlay.style.display = 'flex';
  savedOverlay.style.justifyContent = 'center';
  savedOverlay.style.alignItems = 'center';
  savedOverlay.style.animation = 'dineed-fadeout 3s forwards';
  
  // Add keyframe animation
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes dineed-fadeout {
      0% { opacity: 1; }
      70% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(styleSheet);
  
  const savedContent = document.createElement('div');
  savedContent.className = 'dineed-popup dineed-saved';
  savedContent.style.backgroundColor = '#E8F5E9';
  savedContent.style.borderRadius = '12px';
  savedContent.style.padding = '30px';
  savedContent.style.width = '400px';
  savedContent.style.maxWidth = '90%';
  savedContent.style.textAlign = 'center';
  savedContent.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
  savedContent.style.border = '2px solid #4CAF50';
  
  savedContent.innerHTML = `
    <div style="font-size: 50px; margin-bottom: 10px;">🌿</div>
    <h2 style="margin: 0 0 15px; color: #2E7D32; font-size: 24px;">Good choice!</h2>
    <p style="margin: 0; color: #444; font-size: 16px;">You just helped reduce consumption and waste.</p>
  `;
  
  savedOverlay.appendChild(savedContent);
  document.body.appendChild(savedOverlay);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (document.body.contains(savedOverlay)) {
      document.body.removeChild(savedOverlay);
    }
  }, 3000);
}

// Add this to contentScript.js
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "showAlternatives") {
    displayAlternatives(request.secondHand, null, request.originalProduct);
  } else if (request.action === "showLoading") {
    // Show loading overlay with custom message
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'dineed-overlay';
    loadingOverlay.style.position = 'fixed';
    loadingOverlay.style.top = '0';
    loadingOverlay.style.left = '0';
    loadingOverlay.style.width = '100%';
    loadingOverlay.style.height = '100%';
    loadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    loadingOverlay.style.zIndex = '2147483647';
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.justifyContent = 'center';
    loadingOverlay.style.alignItems = 'center';
    
    const loadingContent = document.createElement('div');
    loadingContent.className = 'dineed-popup dineed-loading';
    loadingContent.style.backgroundColor = 'white';
    loadingContent.style.borderRadius = '12px';
    loadingContent.style.padding = '30px';
    loadingContent.style.width = '400px';
    loadingContent.style.maxWidth = '90%';
    loadingContent.style.textAlign = 'center';
    loadingContent.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
    
    loadingContent.innerHTML = `
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">${request.message || 'Finding second-hand alternatives...'}</h2>
      <div style="margin: 25px auto; width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #4CAF50; border-radius: 50%; animation: dineed-spin 1s linear infinite;"></div>
      <p style="margin: 0; color: #666;">We're searching for second-hand items on trusted marketplaces</p>
    `;
    
    loadingOverlay.appendChild(loadingContent);
    
    // Remove any existing overlays first
    removePopup();
    document.body.appendChild(loadingOverlay);
  } else if (request.action === "showError") {
    // Show error message
    const errorOverlay = document.createElement('div');
    errorOverlay.className = 'dineed-overlay';
    errorOverlay.style.position = 'fixed';
    errorOverlay.style.top = '0';
    errorOverlay.style.left = '0';
    errorOverlay.style.width = '100%';
    errorOverlay.style.height = '100%';
    errorOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    errorOverlay.style.zIndex = '2147483647';
    errorOverlay.style.display = 'flex';
    errorOverlay.style.justifyContent = 'center';
    errorOverlay.style.alignItems = 'center';
    
    const errorContent = document.createElement('div');
    errorContent.className = 'dineed-popup dineed-error';
    errorContent.style.backgroundColor = '#FFF8F8';
    errorContent.style.borderRadius = '12px';
    errorContent.style.padding = '25px';
    errorContent.style.width = '400px';
    errorContent.style.maxWidth = '90%';
    errorContent.style.textAlign = 'center';
    errorContent.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
    errorContent.style.border = '2px solid #F44336';
    
    errorContent.innerHTML = `
      <h2 style="margin: 0 0 15px; color: #F44336; font-size: 22px;">Oops! Something went wrong</h2>
      <p style="margin: 0 0 20px; color: #555;">${request.message || 'Could not find alternatives at this time.'}</p>
      <div style="display: flex; justify-content: center; gap: 15px;">
        <button id="dineed-error-close" style="<button id="dineed-error-close" style="padding: 10px 20px; background-color: #e0e0e0; color: #333; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Close</button>
        <button id="dineed-error-retry" style="padding: 10px 20px; background-color: #2196F3; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Try Again</button>
      </div>
    `;
    
    errorOverlay.appendChild(errorContent);
    
    // Remove any existing overlays first
    removePopup();
    document.body.appendChild(errorOverlay);
    
    // Add event listeners for buttons
    document.getElementById('dineed-error-close').addEventListener('click', removePopup);
    document.getElementById('dineed-error-retry').addEventListener('click', function() {
      removePopup();
      findAlternatives();
    });
  }
});

function displayAlternatives(secondHand, sustainable, originalProduct) {
  // Remove loading overlay
  removePopup();
  
  // Create alternatives popup
  const alternativesOverlay = document.createElement('div');
  alternativesOverlay.className = 'dineed-overlay';
  alternativesOverlay.style.position = 'fixed';
  alternativesOverlay.style.top = '0';
  alternativesOverlay.style.left = '0';
  alternativesOverlay.style.width = '100%';
  alternativesOverlay.style.height = '100%';
  alternativesOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  alternativesOverlay.style.zIndex = '2147483647';
  alternativesOverlay.style.display = 'flex';
  alternativesOverlay.style.justifyContent = 'center';
  alternativesOverlay.style.alignItems = 'center';
  
  // Create the alternatives popup container
  const alternativesContainer = document.createElement('div');
  alternativesContainer.className = 'dineed-alternatives-popup';
  
  // Add CSS link to the document if it doesn't exist
  if (!document.querySelector('link[href*="alternatives.css"]')) {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.type = 'text/css';
    cssLink.href = chrome.runtime.getURL('alternatives.css');
    document.head.appendChild(cssLink);
  }
  
  // Header section with title and close button
  const headerSection = document.createElement('div');
  headerSection.innerHTML = `
    <h1>
      Second-Hand Alternatives
      <span class="close-btn">&times;</span>
    </h1>
  `;
  
  // Original product section
  const originalSection = document.createElement('div');
  originalSection.className = 'original-item';
  
  const originalTitle = originalProduct && originalProduct.title ? originalProduct.title : 'Unknown Product';
  const originalPrice = originalProduct && originalProduct.price ? originalProduct.price : 'Price not available';
  
  originalSection.innerHTML = `
    <h3>Original Item:</h3>
    <div class="original-product">${originalTitle}</div>
    <div class="original-price">${originalPrice}</div>
  `;
  
  // Content section (scrollable)
  const contentSection = document.createElement('div');
  contentSection.className = 'second-hand-options';
  
  // Generate HTML for alternatives
  let secondHandHTML = '';
  if (secondHand && secondHand.length > 0) {
    secondHand.forEach(item => {
      // Check if the URL is specific to a product or just a search/marketplace URL
      const isSpecificUrl = item.url && (
        item.url.includes('/itm/') || 
        item.url.includes('/listing/') || 
        item.url.includes('/dp/') || 
        item.url.includes('/item/')
      );
      
      // Check if it's a search URL
      const isSearchUrl = item.url && (
        item.url.includes('/sch/') || 
        item.url.includes('/search') || 
        item.url.includes('?q=') || 
        item.url.includes('?keyword=') || 
        item.url.includes('?query=')
      );
      
      let buttonText = 'View Item';
      let buttonTitle = 'View this specific second-hand item';
      
      if (isSearchUrl || item.isSearchUrl) {
        buttonText = 'View Similar Items';
        buttonTitle = 'This will take you to search results for similar items on this marketplace';
      } else if (!isSpecificUrl) {
        buttonText = 'Visit';
        buttonTitle = 'This will take you to the marketplace homepage';
      }
      
      // Ensure we have all required properties with defaults
      const title = item.title || 'Unknown Product';
      const price = item.price || 'Price not available';
      const source = item.source || 'Unknown Source';
      const url = item.url || '#';
      const condition = item.condition || 'Used';
      const distance = item.distance || 'Ships nationwide';
      
      secondHandHTML += `
        <div class="alternative-item">
          <h4>${title}</h4>
          <div class="item-details">
            <span class="price-label">${price}</span>
            <div class="ebay-item">
              <span class="ebay-logo">${source}</span>
              <span class="verified-icon">✓</span>
            </div>
            <span class="shipping-info">${distance}</span>
            <span class="condition-label">Condition: ${condition}</span>
          </div>
          <div class="item-actions">
            <button class="credible-source">Credible Source</button>
            ${isSearchUrl || item.isSearchUrl ? 
              '<span class="search-tag">Search Results</span>' : 
              ''}
          </div>
          <a href="${url}" target="_blank" class="search-results" title="${buttonTitle}">${buttonText}</a>
        </div>
      `;
    });
  }
  
  contentSection.innerHTML = `
    <h3>Second-Hand Options</h3>
    <div class="second-hand-description">
      These are verified second-hand items from trusted marketplaces with buyer protection.
    </div>
    ${secondHandHTML.length ? secondHandHTML : '<p class="no-results">No second-hand options found from credible sources</p>'}
    <div class="note-box">
      <p><strong>Note:</strong> Links will take you to search results for similar items on these marketplaces. From there, you can browse and filter to find the exact item you're looking for.</p>
    </div>
  `;
  
  // Buttons section
  const buttonsSection = document.createElement('div');
  buttonsSection.className = 'action-buttons';
  
  buttonsSection.innerHTML = `
    <button id="dineed-continue-original" class="continue-btn">Continue with Original Purchase</button>
    <button id="dineed-skip-purchase" class="skip-btn">Skip this Purchase</button>
  `;
  
  // Assemble the popup
  alternativesContainer.appendChild(headerSection);
  alternativesContainer.appendChild(originalSection);
  alternativesContainer.appendChild(contentSection);
  alternativesContainer.appendChild(buttonsSection);
  alternativesOverlay.appendChild(alternativesContainer);
  document.body.appendChild(alternativesOverlay);
  
  // Add event listeners for buttons
  document.querySelector('.close-btn').addEventListener('click', removePopup);
  
  document.getElementById('dineed-continue-original').addEventListener('click', function() {
    // Mark that we've shown a popup for this product URL
    markPopupShownForCurrentProduct();
    
    removePopup();
    
    // For Amazon, directly click the add to cart button
    if (window.location.hostname.includes('amazon')) {
      const addToCartButton = document.querySelector('#add-to-cart-button');
      if (addToCartButton) {
        addToCartButton.click();
        return;
      }
    }
    
    // For other sites or if Amazon button not found
    if (originalProduct && originalProduct.url) {
      window.location.href = originalProduct.url;
    }
  });
  
  document.getElementById('dineed-skip-purchase').addEventListener('click', function() {
    // Mark that we've shown a popup for this product URL
    markPopupShownForCurrentProduct();
    
    removePopup();
    showSavedMessage();
  });
}

// Add this new function to detect product pages
function detectProductPage() {
  console.log("Detecting if on product page...");
  
  let isProductPage = false;
  let productInfo = {
    title: "",
    price: "",
    category: "",
    url: window.location.href
  };

  // Amazon specific detection (works for all Amazon domains)
  if (window.location.hostname.includes('amazon')) {
    console.log("Detected Amazon domain");
    const productTitle = document.querySelector('#productTitle, .product-title-word-break, #title');
    const price = document.querySelector('.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .a-price, #price, .price-large');
    
    if (productTitle) {
      isProductPage = true;
      productInfo.title = productTitle.textContent.trim();
      console.log("Found product title:", productInfo.title);
      
      if (price) {
        productInfo.price = price.textContent.trim();
        console.log("Found product price:", productInfo.price);
      }
      
      // Try to determine product category
      const breadcrumbs = document.querySelectorAll('#wayfinding-breadcrumbs_feature_div li, .a-breadcrumb li, .nav-a-content, .a-link-normal.a-color-tertiary');
      if (breadcrumbs.length > 0) {
        productInfo.category = breadcrumbs[0].textContent.trim();
        console.log("Found product category:", productInfo.category);
      }
    }
  }
  
  // Walmart specific detection
  else if (window.location.hostname.includes('walmart')) {
    const productTitle = document.querySelector('h1[itemprop="name"]');
    const price = document.querySelector('[data-automation="product-price"]');
    
    if (productTitle) {
      isProductPage = true;
      productInfo.title = productTitle.textContent.trim();
      
      if (price) {
        productInfo.price = price.textContent.trim();
      }
    }
  }
  
  // Best Buy specific detection
  else if (window.location.hostname.includes('bestbuy')) {
    const productTitle = document.querySelector('.sku-title h1');
    const price = document.querySelector('.priceView-customer-price span');
    
    if (productTitle) {
      isProductPage = true;
      productInfo.title = productTitle.textContent.trim();
      
      if (price) {
        productInfo.price = price.textContent.trim();
      }
    }
  }
  
  // eBay specific detection
  else if (window.location.hostname.includes('ebay')) {
    const productTitle = document.querySelector('#itemTitle');
    const price = document.querySelector('#prcIsum');
    
    if (productTitle) {
      isProductPage = true;
      productInfo.title = productTitle.textContent.replace('Details about', '').trim();
      
      if (price) {
        productInfo.price = price.textContent.trim();
      }
    }
  }
  
  // If we detected a product page, save the information
  if (isProductPage && productInfo.title) {
    console.log("Product page detected:", productInfo);
    chrome.storage.local.set({
      currentProduct: productInfo,
      onProductPage: true
    });
    
    // Notify the extension that we're on a product page
    chrome.runtime.sendMessage({
      action: "onProductPage",
      product: productInfo
    });
  } else {
    chrome.storage.local.set({
      onProductPage: false
    });
  }
}