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
  
  // Amazon-specific selectors
  if (window.location.hostname.includes('amazon')) {
    const amazonButtons = document.querySelectorAll('#add-to-cart-button, #buy-now-button, #submit.buy-now-button, .a-button-input[type="submit"]');
    
    amazonButtons.forEach(button => {
      // Check if we've already attached a listener to this button
      if (!button.dataset.dINeedListenerAttached) {
        console.log("Found Amazon button:", button);
        button.dataset.dINeedListenerAttached = "true";
        
        button.addEventListener('click', function(e) {
          console.log("Button clicked!");
          e.preventDefault();
          e.stopPropagation();
          collectProductInfo();
          showReflectionPopup(e);
          return false;
        }, true);
      }
    });
  }
  
  // General e-commerce selectors
  const buyButtons = document.querySelectorAll('button[type="submit"], .buy-now, .add-to-cart, #buy-now, [id*="buy"], [id*="checkout"], [class*="checkout"], [class*="cart"]:not(.header)');
  
  buyButtons.forEach(button => {
    // Check if we've already attached a listener to this button
    if (!button.dataset.dINeedListenerAttached) {
      console.log("Found generic button:", button);
      button.dataset.dINeedListenerAttached = "true";
      
      button.addEventListener('click', function(e) {
        console.log("Button clicked!");
        collectProductInfo();
        showReflectionPopup(e);
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
      // Continue with original purchase
      removePopup();
      // Trigger the original button click
      if (e && e.target) {
        setTimeout(() => {
          const originalEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          e.target.dispatchEvent(originalEvent);
        }, 100);
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
      chrome.runtime.sendMessage({
        action: "findAlternatives",
        product: data.currentProduct
      });
    }
  });
  
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
  
  // Create alternatives popup
  const alternativesOverlay = document.createElement('div');
  alternativesOverlay.className = 'dineed-overlay';
  
  let secondHandHTML = '';
  secondHand.forEach(item => {
    // Check if the URL is specific to a product or just a generic marketplace URL
    const isSpecificUrl = item.url.includes('item') || item.url.includes('listing') || item.url.includes('itm');
    const buttonText = isSpecificUrl ? 'View Item' : 'Visit Marketplace';
    const buttonTitle = isSpecificUrl ? 
      'View this specific second-hand item' : 
      'This will take you to the marketplace where you can search for similar items';
    
    secondHandHTML += `
      <div class="dineed-alternative-item">
        <h4>${item.title}</h4>
        <div class="dineed-alt-details">
          <span class="dineed-price">${item.price}</span>
          <span class="dineed-source" title="Verified second-hand marketplace">${item.source} ✓</span>
          <span class="dineed-distance">${item.distance}</span>
          ${item.condition ? `<span class="dineed-condition">Condition: ${item.condition}</span>` : ''}
        </div>
        <div class="dineed-credibility">
          <span class="dineed-credibility-badge" title="This source has buyer protection and verified sellers">Credible Source</span>
        </div>
        <a href="${item.url}" target="_blank" class="dineed-view-btn" title="${buttonTitle}">${buttonText}</a>
      </div>
    `;
  });
  
  let sustainableHTML = '';
  sustainable.forEach(item => {
    // Check if the URL is specific to a product or just a generic brand URL
    const isSpecificUrl = item.url.includes('product') || item.url.includes('products');
    const buttonText = isSpecificUrl ? 'View Item' : 'Visit Brand';
    const buttonTitle = isSpecificUrl ? 
      'View this specific sustainable product' : 
      'This will take you to the brand\'s website where you can browse similar sustainable products';
    
    sustainableHTML += `
      <div class="dineed-alternative-item">
        <h4>${item.title}</h4>
        <div class="dineed-alt-details">
          <span class="dineed-price">${item.price}</span>
          <span class="dineed-source" title="Verified sustainable brand">${item.source} ✓</span>
          <span class="dineed-eco">Rating: ${item.ecoRating}</span>
        </div>
        <a href="${item.url}" target="_blank" class="dineed-view-btn" title="${buttonTitle}">${buttonText}</a>
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
        <p>${originalProduct.title} - ${originalProduct.price}</p>
      </div>
      
      <div class="dineed-alt-section">
        <h3>Second-Hand Options</h3>
        <p class="dineed-alt-description">These are verified second-hand items from trusted marketplaces with buyer protection.</p>
        <div class="dineed-alt-container">
          ${secondHandHTML.length ? secondHandHTML : '<p>No second-hand options found from credible sources</p>'}
        </div>
      </div>
      
      <div class="dineed-alt-section">
        <h3>Sustainable Brand Alternatives</h3>
        <div class="dineed-alt-container">
          ${sustainableHTML.length ? sustainableHTML : '<p>No sustainable alternatives found</p>'}
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
    removePopup();
    showReflectionPopup();
  });
  document.getElementById('dineed-skip-purchase').addEventListener('click', function() {
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
