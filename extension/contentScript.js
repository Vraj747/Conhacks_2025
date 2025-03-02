// Flag to prevent multiple popups or interceptions
let isProcessingClick = false;

// Run as soon as the content script loads
detectShoppingIntent();
detectProductPage();

// Also run after DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  detectShoppingIntent();
  detectProductPage();
});

// And also set up a mutation observer to detect dynamically added buttons
const observer = new MutationObserver(function(mutations) {
  detectShoppingIntent();
  detectProductPage();
});

// Start observing the document with the configured parameters
observer.observe(document.body, { childList: true, subtree: true });

function detectShoppingIntent() {
  console.log("Detecting shopping intent...");
  
  // Amazon-specific selectors - Only look for Add to Cart buttons
  if (window.location.hostname.includes('amazon')) {
    // Specifically target only Add to Cart buttons
    const amazonButtons = document.querySelectorAll('#add-to-cart-button, .a-button-input[name="submit.add-to-cart"]');
    
    amazonButtons.forEach(button => {
      // Check if we've already attached a listener to this button
      if (!button.dataset.dINeedListenerAttached) {
        console.log("Found Amazon Add to Cart button:", button);
        button.dataset.dINeedListenerAttached = "true";
        
        button.addEventListener('click', function(e) {
          if (isProcessingClick) return true;
          
          console.log("Add to Cart button clicked!");
          e.preventDefault();
          e.stopPropagation();
          collectProductInfo();
          showReflectionPopup(e);
          return false;
        }, true);
      }
    });
  }
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
    
    // Try different price selectors
    const priceElement = 
      document.querySelector('.a-price .a-offscreen') || 
      document.querySelector('#price_inside_buybox') ||
      document.querySelector('#priceblock_ourprice');
    
    if (priceElement) {
      productInfo.price = priceElement.textContent.trim();
    }
    
    // Try to determine product category
    const breadcrumbs = document.querySelectorAll('#wayfinding-breadcrumbs_feature_div li');
    if (breadcrumbs.length > 0) {
      productInfo.category = breadcrumbs[0].textContent.trim();
    }
    
    // Get product image
    const productImage = document.querySelector('#landingImage') || document.querySelector('#imgBlkFront');
    if (productImage) {
      productInfo.imageUrl = productImage.src;
    }
  }
  
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
      // Format the price to look nice
      let formattedPrice = data.currentProduct.price;
      if (formattedPrice) {
        try {
          const priceValue = parseFloat(formattedPrice.replace(/[^\d.]/g, ''));
          formattedPrice = '$' + priceValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        } catch (e) {
          // Keep original price if parsing fails
        }
      }
      
      productInfo = `
        <div class="product-info">
          <p class="product-title">${data.currentProduct.title}</p>
          <p class="product-price">${formattedPrice}</p>
        </div>`;
    }
    
    popup.innerHTML = `
      <h2>Do I Need That?</h2>
      <p class="reflection-text">Take a moment to reflect on this purchase.</p>
      ${productInfo}
      <div class="dineed-buttons">
        <button id="dineed-yes" class="dineed-button dineed-yes">Yes, I need it</button>
        <button id="dineed-alternatives" class="dineed-button dineed-alternatives">Show me alternatives</button>
        <button id="dineed-no" class="dineed-button dineed-no">No, I'll skip it</button>
      </div>
    `;
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    // Add modern styles for the popup
    addModernStyles();
    
    // Handle button clicks
    document.getElementById('dineed-yes').addEventListener('click', function() {
      console.log("User clicked 'Yes'");
      // Continue with original purchase
      removePopup();
      
      // Set flag to prevent re-triggering
      isProcessingClick = true;
      
      // Trigger the original button click
      if (e && e.target) {
        setTimeout(() => {
          // Temporarily remove event listeners to prevent infinite loop
          const originalTarget = e.target;
          const originalClone = originalTarget.cloneNode(true);
          
          if (originalTarget.parentNode) {
            originalTarget.parentNode.replaceChild(originalClone, originalTarget);
            
            // Dispatch click event on the clone
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            originalClone.dispatchEvent(clickEvent);
            
            // Reset flag after a delay
            setTimeout(() => {
              isProcessingClick = false;
            }, 1000);
          } else {
            isProcessingClick = false;
          }
        }, 100);
      } else {
        isProcessingClick = false;
      }
    });
    
    document.getElementById('dineed-alternatives').addEventListener('click', function() {
      console.log("User clicked 'Show alternatives'");
      removePopup();
      findAlternatives();
    });
    
    document.getElementById('dineed-no').addEventListener('click', function() {
      console.log("User clicked 'No'");
      removePopup();
      // Show a positive reinforcement message
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

function addModernStyles() {
  // Add modern styles to the popup
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .dineed-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      z-index: 99999;
      display: flex;
      justify-content: center;
      align-items: center;
      backdrop-filter: blur(3px);
      font-family: Arial, sans-serif;
    }
    
    .dineed-popup {
      background-color: white;
      border-radius: 12px;
      padding: 24px;
      width: 450px;
      max-width: 90%;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
      text-align: center;
      animation: dineed-fadein 0.3s ease-out;
    }
    
    @keyframes dineed-fadein {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .dineed-popup h2 {
      color: #333;
      font-size: 28px;
      margin: 0 0 12px 0;
      font-weight: 600;
    }
    
    .reflection-text {
      font-size: 16px;
      color: #666;
      margin-bottom: 20px;
    }
    
    .product-info {
      background-color: #f8f8f8;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
      text-align: left;
      border-left: 4px solid #4CAF50;
    }
    
    .product-title {
      font-size: 16px;
      font-weight: 500;
      margin: 0 0 8px 0;
      color: #333;
    }
    
    .product-price {
      font-size: 18px;
      font-weight: 700;
      margin: 0;
      color: #4CAF50;
    }
    
    .dineed-buttons {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 24px;
    }
    
    .dineed-button {
      padding: 14px 16px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-weight: 600;
      font-size: 16px;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }
    
    .dineed-button::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(255, 255, 255, 0.1);
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    .dineed-button:hover::after {
      opacity: 1;
    }
    
    .dineed-button:active {
      transform: scale(0.98);
    }
    
    .dineed-yes {
      background-color: #e0e0e0;
      color: #333;
    }
    
    .dineed-alternatives {
      background-color: #4CAF50;
      color: white;
    }
    
    .dineed-no {
      background-color: #2196F3;
      color: white;
    }
    
    .dineed-loading {
      text-align: center;
    }
    
    .dineed-spinner {
      display: inline-block;
      width: 50px;
      height: 50px;
      border: 4px solid rgba(76, 175, 80, 0.2);
      border-radius: 50%;
      border-top-color: #4CAF50;
      animation: dineed-spin 1s linear infinite;
      margin: 20px 0;
    }
    
    @keyframes dineed-spin {
      to { transform: rotate(360deg); }
    }
    
    .dineed-alternatives-popup {
      width: 800px;
      max-width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      background-color: white;
      border-radius: 12px;
      animation: dineed-fadein 0.3s ease-out;
    }
    
    .dineed-alt-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #e0e0e0;
      position: sticky;
      top: 0;
      background-color: white;
      z-index: 1;
      border-radius: 12px 12px 0 0;
    }
    
    .dineed-alt-header h2 {
      margin: 0;
      color: #4CAF50;
      font-size: 24px;
    }
    
    .dineed-close {
      background: none;
      border: none;
      font-size: 28px;
      cursor: pointer;
      color: #666;
      transition: color 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
    }
    
    .dineed-close:hover {
      color: #333;
      background-color: #f1f1f1;
    }
    
    .dineed-original {
      padding: 16px 24px;
      background-color: #f9f9f9;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .dineed-original h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
      color: #333;
    }
    
    .dineed-original p {
      margin: 0;
      font-size: 16px;
      color: #666;
    }
    
    .dineed-alt-section {
      padding: 16px 24px;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .dineed-alt-section h3 {
      margin: 0 0 16px 0;
      font-size: 20px;
      color: #333;
    }
    
    .dineed-alt-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }
    
    .dineed-alternative-item {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      background-color: white;
    }
    
    .dineed-alternative-item:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
    }
    
    .dineed-alternative-item h4 {
      margin: 0 0 12px 0;
      font-size: 16px;
      color: #333;
    }
    
    .dineed-alt-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }
    
    .dineed-price {
      font-weight: 700;
      font-size: 18px;
      color: #4CAF50;
    }
    
    .dineed-source, .dineed-distance, .dineed-eco {
      font-size: 14px;
      color: #666;
    }
    
    .dineed-view-btn {
      display: inline-block;
      padding: 8px 16px;
      background-color: #2196F3;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      transition: background-color 0.2s ease;
      text-align: center;
    }
    
    .dineed-view-btn:hover {
      background-color: #0d8bf2;
    }
    
    .dineed-saved {
      text-align: center;
      background-color: #E8F5E9;
      border-left: none;
      border: 2px solid #4CAF50;
      padding: 24px;
    }
    
    .dineed-saved h2 {
      color: #2E7D32;
      margin-bottom: 8px;
    }
    
    .dineed-fade {
      animation: dineed-fadeout 3s forwards;
    }
    
    @keyframes dineed-fadeout {
      0% { opacity: 1; }
      70% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(styleEl);
}

function removePopup() {
  const overlay = document.querySelector('.dineed-overlay');
  if (overlay) {
    // Add fade-out animation
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    
    // Remove after animation completes
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    }, 300);
  }
}

function findAlternatives() {
  chrome.storage.local.get(['currentProduct'], function(data) {
    if (data.currentProduct) {
      console.log("Finding alternatives for:", data.currentProduct);
      
      // Show loading overlay
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
      
      // Generate alternatives immediately instead of waiting for API
      setTimeout(() => {
        // Generate some mock alternatives
        generateMockAlternatives(data.currentProduct);
      }, 1500);
    }
  });
}

function generateMockAlternatives(product) {
  console.log("Generating mock alternatives for:", product);
  
  // Parse the price to generate relative prices for alternatives
  let basePrice = 500; // Default price if we can't parse
  if (product.price) {
    const priceStr = product.price.replace(/[^\d.]/g, '');
    const parsedPrice = parseFloat(priceStr);
    if (!isNaN(parsedPrice)) {
      basePrice = parsedPrice;
    }
  }
  
  // Generate second-hand options
  const secondHandOptions = [
    {
      title: `${product.title} (Used - Like New)`,
      price: `$${(basePrice * 0.6).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
      source: "Facebook Marketplace",
      url: "https://www.facebook.com/marketplace/",
      distance: "5 miles away"
    },
    {
      title: `${product.title} (Refurbished)`,
      price: `$${(basePrice * 0.7).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
      source: "ThriftShop",
      url: "https://www.thriftshop.com/",
      distance: "12 miles away"
    }
  ];
  
  // Generate sustainable alternatives
  const sustainableOptions = [
    {
      title: `Eco-friendly ${product.title.split(' ').slice(0, 3).join(' ')}`,
      price: `$${(basePrice * 1.1).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
      source: "EcoStore",
      url: "https://www.ecostore.com/",
      ecoRating: "A+ (Recycled materials, carbon neutral shipping)"
    },
    {
      title: `Sustainable ${product.title.split(' ').slice(0, 3).join(' ')}`,
      price: `$${(basePrice * 1.2).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
      source: "GreenTech",
      url: "https://www.greentech.com/",
      ecoRating: "A (Fair trade certified, organic materials)"
    }
  ];
  
  // Display the alternatives
  displayAlternatives(secondHandOptions, sustainableOptions, product);
}

function showSavedMessage() {
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
    displayAlternatives(request.secondHand, request.sustainable, request.originalProduct);
  }
});

function displayAlternatives(secondHand, sustainable, originalProduct) {
  // Remove loading overlay
  removePopup();
  
  // Format the price for display
  let formattedPrice = originalProduct.price;
  if (formattedPrice && !formattedPrice.startsWith('$')) {
    formattedPrice = '$' + formattedPrice;
  }
  
  // Create alternatives popup
  const alternativesOverlay = document.createElement('div');
  alternativesOverlay.className = 'dineed-overlay';
  
  let secondHandHTML = '';
  secondHand.forEach(item => {
    secondHandHTML += `
      <div class="dineed-alternative-item">
        <h4>${item.title}</h4>
        <div class="dineed-alt-details">
          <span class="dineed-price">${item.price}</span>
          <span class="dineed-source">${item.source}</span>
          <span class="dineed-distance">${item.distance}</span>
        </div>
        <a href="${item.url}" target="_blank" class="dineed-view-btn">View Item</a>
      </div>
    `;
  });
  
  let sustainableHTML = '';
  sustainable.forEach(item => {
    sustainableHTML += `
      <div class="dineed-alternative-item">
        <h4>${item.title}</h4>
        <div class="dineed-alt-details">
          <span class="dineed-price">${item.price}</span>
          <span class="dineed-source">${item.source}</span>
          <span class="dineed-eco">Rating: ${item.ecoRating}</span>
        </div>
        <a href="${item.url}" target="_blank" class="dineed-view-btn">View Item</a>
      </div>
    `;
  });
  
  alternativesOverlay.innerHTML = `
    <div class="dineed-alternatives-popup">
      <div class="dineed-alt-header">
        <h2>Sustainable Alternatives</h2>
        <button class="dineed-close">&times;</button>
      </div>
      
      <div class="dineed-original">
        <h3>Original Item:</h3>
        <p>${originalProduct.title} - ${formattedPrice}</p>
      </div>
      
      <div class="dineed-alt-section">
        <h3>Second-Hand Options</h3>
        <div class="dineed-alt-container">
          ${secondHandHTML.length ? secondHandHTML : '<p>No second-hand options found nearby</p>'}
        </div>
      </div>
      
      <div class="dineed-alt-section">
        <h3>Sustainable Brand Alternatives</h3>
        <div class="dineed-alt-container">
          ${sustainableHTML.length ? sustainableHTML : '<p>No sustainable alternatives found</p>'}
        </div>
      </div>
      
      <div class="dineed-buttons" style="padding: 16px 24px;">
        <button id="dineed-continue-original" class="dineed-button dineed-yes">Continue with Original Purchase</button>
        <button id="dineed-skip-purchase" class="dineed-button dineed-no">Skip this Purchase</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(alternativesOverlay);
  
  // Add modern styles
  addModernStyles();
  
  document.querySelector('.dineed-close').addEventListener('click', removePopup);
  document.getElementById('dineed-continue-original').addEventListener('click', function() {
    removePopup();
    
    // Set processing flag
    isProcessingClick = true;
    
    // Simulate click on original add to cart button
    const addToCartButton = document.querySelector('#add-to-cart-button');
    if (addToCartButton) {
      // Clone and replace to avoid event listeners
      const buttonClone = addToCartButton.cloneNode(true);
      if (addToCartButton.parentNode) {
        addToCartButton.parentNode.replaceChild(buttonClone, addToCartButton);
        
        // Click the cloned button
        buttonClone.click();
      }
    }
    
    // Reset flag after a delay
    setTimeout(() => {
      isProcessingClick = false;
    }, 1000);
  });
  
  document.getElementById('dineed-skip-purchase').addEventListener('click', function() {
    removePopup();
    showSavedMessage();
    
    // Update stats
    chrome.storage.local.get(['reconsideredCount', 'moneySaved'], function(stats) {
      const reconsideredCount = (stats.reconsideredCount || 0) + 1;
      let moneySaved = stats.moneySaved || 0;
      
      if (originalProduct && originalProduct.price) {
        const priceStr = originalProduct.price.replace(/[^\d.]/g, '');
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

  // Amazon specific detection
  if (window.location.hostname.includes('amazon')) {
    const productTitle = document.querySelector('#productTitle');
    const price = document.querySelector('.a-price .a-offscreen') || 
                  document.querySelector('#price_inside_buybox') ||
                  document.querySelector('#priceblock_ourprice');
    
    if (productTitle) {
      isProductPage = true;
      productInfo.title = productTitle.textContent.trim();
      
      if (price) {
        productInfo.price = price.textContent.trim();
      }
      
      // Try to determine product category
      const breadcrumbs = document.querySelectorAll('#wayfinding-breadcrumbs_feature_div li');
      if (breadcrumbs.length > 0) {
        productInfo.category = breadcrumbs[0].textContent.trim();
      }
      
      // Get product image
      const productImage = document.querySelector('#landingImage') || document.querySelector('#imgBlkFront');
      if (productImage) {
        productInfo.imageUrl = productImage.src;
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