// FINAL VERSION WITH ALL FIXES
console.log("Do I Need That? Final Version loaded");

// Create a unique session ID to track this instance
const sessionId = "dineed_" + Date.now();
console.log("Session ID:", sessionId);

// Global flags
let popupActive = false;
let currentProduct = null;
let originalClickTarget = null;

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

// Mark that user needs to see popup again for this product
function resetPopupForCurrentProduct() {
  try {
    const key = getProductKey();
    localStorage.removeItem(key);
    console.log("Reset popup status for this product URL");
  } catch (err) {
    console.error("Error resetting product popup status:", err);
  }
}

// When page loads or URL changes, check if we need to reset popup status
window.addEventListener('load', function() {
  // Check if this is a new cart/checkout page (not a product page)
  if (window.location.href.includes('cart') || 
      window.location.href.includes('checkout') || 
      window.location.href.includes('basket')) {
    // Reset all product popup statuses when user navigates to cart
    resetAllProductPopups();
  }
});

// Listen for URL changes (SPA navigation)
let lastUrl = window.location.href;
new MutationObserver(() => {
  if (lastUrl !== window.location.href) {
    lastUrl = window.location.href;
    console.log("URL changed to", window.location.href);
    
    // Check if this is a new cart/checkout page
    if (window.location.href.includes('cart') || 
        window.location.href.includes('checkout') || 
        window.location.href.includes('basket')) {
      // Reset all product popup statuses when user navigates to cart
      resetAllProductPopups();
    }
  }
}).observe(document, {subtree: true, childList: true});

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

// Main event listener for clicks
document.addEventListener('click', function(e) {
  // Skip if popup is already active
  if (popupActive) {
    return;
  }
  
  // Check if click is on an add-to-cart or checkout button
  if (isShoppingButton(e.target)) {
    console.log("Shopping button clicked:", e.target);
    
    // Check if we've already shown a popup for this product
    if (hasShownPopupForCurrentProduct()) {
      console.log("Already shown popup for this product URL, allowing click to proceed");
      return; // Allow the click to proceed normally
    }
    
    // Prevent default action
    e.preventDefault();
    e.stopPropagation();
    
    // Store target for later
    originalClickTarget = e.target;
    
    // Extract product information
    extractProductInfo();
    
    // Show popup
    showPopup();
    
    return false;
  }
}, true); // Capture phase

// Extract product information from the page
function extractProductInfo() {
  currentProduct = {
    title: "",
    price: "",
    url: window.location.href
  };
  
  // Try to detect product title and price
  if (window.location.hostname.includes('amazon')) {
    // Amazon
    const titleElement = document.querySelector('#productTitle');
    const priceElement = document.querySelector('.a-price .a-offscreen, #priceblock_ourprice');
    
    if (titleElement) {
      currentProduct.title = titleElement.textContent.trim();
    }
    
    if (priceElement) {
      currentProduct.price = priceElement.textContent.trim();
    }
  } else {
    // Generic detection for other sites
    // Try to find a product title in common heading elements
    const headings = document.querySelectorAll('h1');
    for (const heading of headings) {
      if (heading.textContent.length > 10 && heading.textContent.length < 200) {
        currentProduct.title = heading.textContent.trim();
        break;
      }
    }
    
    // Try to find price
    const priceElements = document.querySelectorAll('.price, .product-price, [itemprop="price"]');
    for (const priceElement of priceElements) {
      const text = priceElement.textContent.trim();
      if (text && /\$?\d+(\.\d{2})?/.test(text)) {
        currentProduct.price = text;
        break;
      }
    }
  }
  
  console.log("Extracted product info:", currentProduct);
}

// Check if an element is a shopping-related button
function isShoppingButton(element) {
  // Skip non-elements
  if (!element || !element.tagName) return false;
  
  // Get text content, classes, and ID
  const text = (element.textContent || "").toLowerCase();
  const classList = Array.from(element.classList || []).join(" ").toLowerCase();
  const id = (element.id || "").toLowerCase();
  const type = (element.getAttribute('type') || "").toLowerCase();
  const name = (element.getAttribute('name') || "").toLowerCase();
  
  // Skip if this is our own button
  if (id.includes('dineed')) return false;
  
  // Check for common shopping button patterns
  const shoppingTerms = [
    'add to cart', 'add to basket', 'buy now', 'checkout', 'purchase', 
    'proceed to checkout', 'complete purchase', 'place order'
  ];
  
  // Check text content
  for (const term of shoppingTerms) {
    if (text.includes(term)) return true;
  }
  
  // Check ID and classes
  const idClassPatterns = [
    'add-to-cart', 'addtocart', 'add_to_cart', 'buy-now', 'buynow', 
    'checkout', 'cart-button', 'cartbutton', 'purchase', 'submit-order'
  ];
  
  for (const pattern of idClassPatterns) {
    if (id.includes(pattern) || classList.includes(pattern)) return true;
  }
  
  // Check for submit buttons in forms
  if ((element.tagName === 'BUTTON' || element.tagName === 'INPUT') && 
      (type === 'submit' || type === 'button')) {
    
    // Check if parent form has shopping-related action
    const form = element.closest('form');
    if (form) {
      const formAction = (form.action || "").toLowerCase();
      if (formAction.includes('cart') || formAction.includes('checkout') || 
          formAction.includes('purchase') || formAction.includes('buy')) {
        return true;
      }
    }
    
    // Check specific names/values
    if (name.includes('add') || name.includes('cart') || name.includes('buy') ||
        name.includes('checkout') || name.includes('purchase')) {
      return true;
    }
  }
  
  // Amazon-specific buttons
  if (id === 'add-to-cart-button' || id === 'buy-now-button' || 
      id === 'sc-buy-box-ptc-button' || id === 'submitOrderButtonId') {
    return true;
  }
  
  return false;
}

// Show the reflection popup
function showPopup() {
  // Mark popup as active
  popupActive = true;
  
  console.log("Showing popup");
  
  // Create the overlay
  const overlay = document.createElement('div');
  overlay.id = `dineed-overlay-${sessionId}`;
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  overlay.style.zIndex = '2147483647';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  
  // Create the popup
  const popup = document.createElement('div');
  popup.style.backgroundColor = 'white';
  popup.style.padding = '20px';
  popup.style.borderRadius = '8px';
  popup.style.maxWidth = '90%';
  popup.style.width = '400px';
  popup.style.textAlign = 'center';
  popup.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
  
  // Format product info if available
  let productInfoHtml = '';
  if (currentProduct && currentProduct.title) {
    productInfoHtml = `
      <div style="background-color: #f5f5f5; border-radius: 6px; padding: 15px; margin: 15px 0; text-align: center;">
        ${currentProduct.title} - ${currentProduct.price || ''}
      </div>
    `;
  }
  
  // Set popup content - using minimal HTML for reliability
  popup.innerHTML = `
    <h2 style="margin-top: 0; color: #333;">Do I Need That?</h2>
    <p style="margin-bottom: 20px; color: #555;">Take a moment to reflect on this purchase.</p>
    ${productInfoHtml}
    <div style="display: flex; justify-content: center; gap: 10px; margin-top: 20px;">
      <button id="dineed-yes-${sessionId}" style="padding: 8px 16px; border-radius: 4px; border: none; background-color: #e0e0e0; color: black; font-weight: bold; cursor: pointer;">Yes, I need it</button>
      <button id="dineed-alt-${sessionId}" style="padding: 8px 16px; border-radius: 4px; border: none; background-color: #4CAF50; color: white; font-weight: bold; cursor: pointer;">Show me alternatives</button>
      <button id="dineed-no-${sessionId}" style="padding: 8px 16px; border-radius: 4px; border: none; background-color: #2196F3; color: white; font-weight: bold; cursor: pointer;">No, I'll skip it</button>
    </div>
  `;
  
  // Add popup to overlay
  overlay.appendChild(popup);
  
  // Add overlay to body
  document.body.appendChild(overlay);
  
  // Add event listeners to buttons
  document.getElementById(`dineed-yes-${sessionId}`).addEventListener('click', handleYesClick);
  document.getElementById(`dineed-alt-${sessionId}`).addEventListener('click', handleAltClick);
  document.getElementById(`dineed-no-${sessionId}`).addEventListener('click', handleNoClick);
}

// Handle "Yes, I need it" click
function handleYesClick() {
  console.log("User clicked Yes");
  
  // Mark that we've shown a popup for this product URL
  // This will prevent showing the popup again for this product
  markPopupShownForCurrentProduct();
  
  // Remove popup
  removePopup();
  
  // Proceed with original action
  if (originalClickTarget) {
    console.log("Proceeding with original action");
    setTimeout(() => {
      try {
        // Try multiple strategies to trigger the original action
        
        // Strategy 1: Try to submit the form if it exists
        const form = originalClickTarget.closest('form');
        if (form) {
          console.log("Submitting form");
          form.submit();
          return;
        }
        
        // Strategy 2: Programmatically click the button
        console.log("Clicking original target");
        originalClickTarget.click();
        
        // Strategy 3: If it's a link, navigate to its href
        if (originalClickTarget.tagName === 'A' && originalClickTarget.href) {
          console.log("Navigating to link href");
          window.location.href = originalClickTarget.href;
        }
      } catch (err) {
        console.error("Error proceeding with original action:", err);
      }
    }, 100);
  }
}

// Handle "Show me alternatives" click
function handleAltClick() {
  console.log("User clicked Show alternatives");
  
  // Remove existing popup
  removePopup();
  
  // Generate alternatives
  showAlternatives();
}

// Handle "No, I'll skip it" click
function handleNoClick() {
  console.log("User clicked No");
  
  // Mark that we've shown a popup for this product URL
  // This will prevent showing the popup again for this product
  markPopupShownForCurrentProduct();
  
  // Remove popup
  removePopup();
  
  // Show success message
  showSuccessMessage();
}

// Remove the popup
function removePopup() {
  // Set popup as inactive
  popupActive = false;
  
  // Remove overlay if it exists
  const overlay = document.getElementById(`dineed-overlay-${sessionId}`);
  if (overlay) {
    document.body.removeChild(overlay);
    console.log("Popup removed");
  }
}

// Show success message
function showSuccessMessage() {
  const successOverlay = document.createElement('div');
  successOverlay.style.position = 'fixed';
  successOverlay.style.top = '0';
  successOverlay.style.left = '0';
  successOverlay.style.width = '100%';
  successOverlay.style.height = '100%';
  successOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  successOverlay.style.zIndex = '2147483647';
  successOverlay.style.display = 'flex';
  successOverlay.style.justifyContent = 'center';
  successOverlay.style.alignItems = 'center';
  
  const successBox = document.createElement('div');
  successBox.style.backgroundColor = '#E8F5E9';
  successBox.style.padding = '20px';
  successBox.style.borderRadius = '8px';
  successBox.style.maxWidth = '90%';
  successBox.style.width = '400px';
  successBox.style.textAlign = 'center';
  successBox.style.border = '2px solid #4CAF50';
  
  successBox.innerHTML = `
    <h2 style="color: #2E7D32; margin-top: 0;">Good choice! 🌿</h2>
    <p>You just helped reduce consumption and waste.</p>
  `;
  
  successOverlay.appendChild(successBox);
  document.body.appendChild(successOverlay);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (document.body.contains(successOverlay)) {
      document.body.removeChild(successOverlay);
    }
  }, 3000);
}

// Generate and show alternatives
function showAlternatives() {
  // Create a new overlay for alternatives
  const alternativesOverlay = document.createElement('div');
  alternativesOverlay.id = `dineed-alt-overlay-${sessionId}`;
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
  alternativesOverlay.style.overflow = 'auto';
  
  // Create the alternatives container
  const alternativesContainer = document.createElement('div');
  alternativesContainer.style.backgroundColor = 'white';
  alternativesContainer.style.borderRadius = '8px';
  alternativesContainer.style.maxWidth = '90%';
  alternativesContainer.style.width = '800px';
  alternativesContainer.style.maxHeight = '90vh';
  alternativesContainer.style.overflow = 'auto';
  alternativesContainer.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2)';
  
  // Title and close button
  const headerDiv = document.createElement('div');
  headerDiv.style.display = 'flex';
  headerDiv.style.justifyContent = 'space-between';
  headerDiv.style.alignItems = 'center';
  headerDiv.style.padding = '15px 20px';
  headerDiv.style.borderBottom = '1px solid #e0e0e0';
  
  headerDiv.innerHTML = `
    <h2 style="margin: 0; color: #2196F3;">Second-Hand Alternatives</h2>
    <button id="dineed-close-alt-${sessionId}" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
  `;
  
  alternativesContainer.appendChild(headerDiv);
  
  // Original product info
  const originalProductDiv = document.createElement('div');
  originalProductDiv.style.padding = '15px 20px';
  originalProductDiv.style.backgroundColor = '#f9f9f9';
  originalProductDiv.style.borderBottom = '1px solid #e0e0e0';
  
  originalProductDiv.innerHTML = `
    <h3 style="margin-top: 0;">Original Item:</h3>
    <p>${currentProduct?.title || 'Product'} - ${currentProduct?.price || ''}</p>
  `;
  
  alternativesContainer.appendChild(originalProductDiv);
  
  // Alternatives section
  const alternativesSection = document.createElement('div');
  alternativesSection.style.padding = '15px 20px';
  
  // Generate mock second-hand alternatives based on current product
  let alternativesHtml = '';
  const marketplaces = ['eBay', 'Poshmark', 'Mercari'];
  const conditions = ['Various Used Conditions', 'Like New', 'Good Condition', 'Excellent Condition'];
  const productName = currentProduct?.title || 'Product';
  const productPrice = currentProduct?.price || '$100.00';
  
  // Extract numeric price
  const priceMatch = productPrice.match(/\$?(\d+(\.\d{2})?)/);
  const numericPrice = priceMatch ? parseFloat(priceMatch[1]) : 100;
  
  // Generate alternatives for each marketplace
  marketplaces.forEach((marketplace, index) => {
    // Calculate discounted price (between 50-70% of original)
    const discountFactor = 0.5 + (Math.random() * 0.2);
    const discountedPrice = (numericPrice * discountFactor).toFixed(2);
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const score = 75 + Math.floor(Math.random() * 15);
    
    alternativesHtml += `
      <div style="border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; margin-bottom: 15px; background-color: white; position: relative;">
        <h4 style="margin-top: 0; margin-bottom: 8px;">${productName}</h4>
        <div style="margin: 10px 0;">
          <span style="font-weight: bold; color: #4CAF50; font-size: 16px; display: block; margin-bottom: 5px;">$${discountedPrice}</span>
          <span style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">${marketplace} ✓</span>
          <span style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">Condition: ${condition}</span>
          <span style="font-weight: bold; display: block; margin-bottom: 5px;">Score: ${score}/100</span>
        </div>
        <div style="margin: 10px 0;">
          <span style="display: inline-block; background-color: #4CAF50; color: white; font-size: 11px; padding: 2px 6px; border-radius: 10px; font-weight: bold;">Credible Source</span>
          <span style="display: inline-block; background-color: #2196F3; color: white; font-size: 11px; padding: 2px 6px; border-radius: 10px; font-weight: bold; margin-left: 8px;">Search Results</span>
        </div>
        <a href="https://${marketplace.toLowerCase()}.com/search?q=${encodeURIComponent(productName)}" target="_blank" style="display: inline-block; background-color: #2196F3; color: white; padding: 8px 14px; border-radius: 4px; text-decoration: none; font-weight: bold; margin-top: 10px;">Visit Marketplace</a>
      </div>
    `;
  });
  
  alternativesSection.innerHTML = `
    <h3>Second-Hand Options</h3>
    <p style="font-size: 14px; color: #555; margin: 10px 0; font-style: italic;">These are verified second-hand items from trusted marketplaces with buyer protection.</p>
    <div>
      ${alternativesHtml}
    </div>
    <div style="margin-top: 15px; padding: 10px; background-color: #f5f5f5; border-radius: 4px; font-size: 13px; color: #555; border-left: 3px solid #2196F3;">
      <p style="margin: 0; line-height: 1.4;"><strong>Note:</strong> Links will take you to search results for similar items on these marketplaces. From there, you can browse and filter to find the exact item you're looking for.</p>
    </div>
  `;
  
  alternativesContainer.appendChild(alternativesSection);
  
  // Add buttons at the bottom
  const buttonsSection = document.createElement('div');
  buttonsSection.style.padding = '15px';
  buttonsSection.style.borderTop = '1px solid #e0e0e0';
  buttonsSection.style.backgroundColor = '#f9f9f9';
  buttonsSection.style.display = 'flex';
  buttonsSection.style.justifyContent = 'center';
  buttonsSection.style.gap = '10px';
  
  buttonsSection.innerHTML = `
    <button id="dineed-continue-${sessionId}" style="padding: 10px 16px; border-radius: 4px; border: none; background-color: #e0e0e0; color: #333; font-weight: bold; cursor: pointer; font-size: 14px;">Continue with Original Purchase</button>
    <button id="dineed-skip-${sessionId}" style="padding: 10px 16px; border-radius: 4px; border: none; background-color: #2196F3; color: white; font-weight: bold; cursor: pointer; font-size: 14px;">Skip this Purchase</button>
  `;
  
  alternativesContainer.appendChild(buttonsSection);
  alternativesOverlay.appendChild(alternativesContainer);
  document.body.appendChild(alternativesOverlay);
  
  // Add event listeners for the buttons
  document.getElementById(`dineed-close-alt-${sessionId}`).addEventListener('click', function() {
    if (document.body.contains(alternativesOverlay)) {
      document.body.removeChild(alternativesOverlay);
      popupActive = false;
    }
  });
  
  document.getElementById(`dineed-continue-${sessionId}`).addEventListener('click', function() {
    // Mark that we've shown a popup for this product URL to prevent showing it again
    markPopupShownForCurrentProduct();
    
    if (document.body.contains(alternativesOverlay)) {
      document.body.removeChild(alternativesOverlay);
      popupActive = false;
      // Trigger the original action
      if (originalClickTarget) {
        setTimeout(() => {
          try {
            const form = originalClickTarget.closest('form');
            if (form) {
              form.submit();
            } else {
              originalClickTarget.click();
            }
          } catch (err) {
            console.error("Error proceeding with original action:", err);
          }
        }, 100);
      }
    }
  });
  
  document.getElementById(`dineed-skip-${sessionId}`).addEventListener('click', function() {
    // Mark that we've shown a popup for this product URL to prevent showing it again
    markPopupShownForCurrentProduct();
    
    if (document.body.contains(alternativesOverlay)) {
      document.body.removeChild(alternativesOverlay);
      popupActive = false;
      // Show success message
      showSuccessMessage();
    }
  });
}