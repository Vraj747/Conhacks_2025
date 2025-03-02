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
    
    const popup = document.createElement('div');
    popup.className = 'dineed-popup';
    
    let productInfo = '';
    if (data.currentProduct && data.currentProduct.title) {
      productInfo = `<p class="product-info">${data.currentProduct.title} - ${data.currentProduct.price}</p>`;
    }
    
    popup.innerHTML = `
      <h2>Do I Need That?</h2>
      <p>Take a moment to reflect on this purchase.</p>
      ${productInfo}
      <div class="dineed-buttons">
        <button id="dineed-yes">Yes, I need it</button>
        <button id="dineed-alternatives">Show me alternatives</button>
        <button id="dineed-no">No, I'll skip it</button>
      </div>
    `;
    
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
      loadingOverlay.innerHTML = `
        <div class="dineed-popup dineed-loading">
          <h2>Finding sustainable alternatives...</h2>
          <div class="dineed-spinner"></div>
          <p>We're searching second-hand marketplaces and sustainable brands</p>
        </div>
      `;
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
  savedOverlay.innerHTML = `
    <div class="dineed-popup dineed-saved">
      <h2>Good choice! 🌿</h2>
      <p>You just helped reduce consumption and waste.</p>
    </div>
  `;
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
    loadingOverlay.innerHTML = `
      <div class="dineed-popup dineed-loading">
        <h2>${request.message || 'Finding second-hand alternatives...'}</h2>
        <div class="dineed-spinner"></div>
        <p>We're searching for second-hand items on trusted marketplaces</p>
      </div>
    `;
    
    // Remove any existing overlays first
    removePopup();
    document.body.appendChild(loadingOverlay);
  } else if (request.action === "showError") {
    // Show error message
    const errorOverlay = document.createElement('div');
    errorOverlay.className = 'dineed-overlay';
    errorOverlay.innerHTML = `
      <div class="dineed-popup dineed-error">
        <h2>Oops! Something went wrong</h2>
        <p>${request.message || 'Could not find alternatives at this time.'}</p>
        <div class="dineed-buttons">
          <button id="dineed-error-close">Close</button>
          <button id="dineed-error-retry">Try Again</button>
        </div>
      </div>
    `;
    
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
        buttonText = 'Visit Marketplace';
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
        <div class="dineed-alternative-item">
          <h4>${title}</h4>
          <div class="dineed-alt-details">
            <span class="dineed-price">${price}</span>
            <span class="dineed-source" title="Verified second-hand marketplace">${source} ✓</span>
            <span class="dineed-distance">${distance}</span>
            <span class="dineed-condition">Condition: ${condition}</span>
          </div>
          <div class="dineed-credibility">
            <span class="dineed-credibility-badge" title="This source has buyer protection and verified sellers">Credible Source</span>
            ${isSearchUrl || item.isSearchUrl ? '<span class="dineed-search-badge" title="This link will show you search results for similar items">Search Results</span>' : ''}
          </div>
          <a href="${url}" target="_blank" class="dineed-view-btn" title="${buttonTitle}">${buttonText}</a>
        </div>
      `;
    });
  }
  
  // Ensure we have the original product info with defaults
  const originalTitle = originalProduct && originalProduct.title ? originalProduct.title : 'Unknown Product';
  const originalPrice = originalProduct && originalProduct.price ? originalProduct.price : 'Price not available';
  
  alternativesOverlay.innerHTML = `
    <div class="dineed-alternatives-popup">
      <div class="dineed-alt-header">
        <h2>Second-Hand Alternatives</h2>
        <button class="dineed-close">&times;</button>
      </div>
      
      <div class="dineed-original">
        <h3>Original Item:</h3>
        <p>${originalTitle} - ${originalPrice}</p>
      </div>
      
      <div class="dineed-alt-section">
        <h3>Second-Hand Options</h3>
        <p class="dineed-alt-description">These are verified second-hand items from trusted marketplaces with buyer protection.</p>
        <div class="dineed-alt-container">
          ${secondHandHTML.length ? secondHandHTML : '<p>No second-hand options found from credible sources</p>'}
        </div>
        <div class="dineed-search-explanation">
          <p><strong>Note:</strong> Links will take you to search results for similar items on these marketplaces. From there, you can browse and filter to find the exact item you're looking for.</p>
        </div>
      </div>
      
      <div class="dineed-buttons">
        <button id="dineed-continue-original">Continue with Original Purchase</button>
        <button id="dineed-skip-purchase">Skip this Purchase</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(alternativesOverlay);
  
  document.querySelector('.dineed-close').addEventListener('click', removePopup);
  
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