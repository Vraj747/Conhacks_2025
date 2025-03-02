console.log("Do I Need That? extension loaded");

// Flag to prevent multiple interceptions
let isProcessingClick = false;

// Wait for the page to fully load
window.addEventListener('load', function() {
  console.log("Page fully loaded, setting up button watchers");
  setupButtonWatchers();
});

// Also run on DOM content loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM content loaded, setting up button watchers");
  setupButtonWatchers();
});

// And run immediately for good measure
setupButtonWatchers();

// Set a periodic checker to handle dynamically loaded buttons
setInterval(setupButtonWatchers, 2000);

function setupButtonWatchers() {
  // Amazon checkout button selectors - being very specific
  const selectors = [
    'input[name="proceedToRetailCheckout"]',
    'input[value="Proceed to checkout"]',
    'span.a-button-inner:has(input[name="proceedToRetailCheckout"])',
    '#sc-buy-box-ptc-button',
    '#sc-buy-box input[type="submit"]',
    '.checkout-button',
    '.a-button-input[name="checkout"]',
    '#submitOrderButtonId input'
  ];

  // Try to find each button type
  selectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`Found ${elements.length} elements matching: ${selector}`);
        elements.forEach(el => {
          if (!el.getAttribute('dineed-watched')) {
            el.setAttribute('dineed-watched', 'true');
            
            // Add click listener to the element
            el.addEventListener('click', interceptClick, true);
            
            // Also try to add listeners to parent elements
            let parent = el.parentElement;
            for (let i = 0; i < 3 && parent; i++) {
              if (!parent.getAttribute('dineed-watched')) {
                parent.setAttribute('dineed-watched', 'true');
                parent.addEventListener('click', interceptClick, true);
              }
              parent = parent.parentElement;
            }
            
            console.log("Added click interceptor to:", el);
          }
        });
      }
    } catch (err) {
      console.error("Error with selector:", selector, err);
    }
  });
}

function interceptClick(e) {
  if (isProcessingClick) return;
  console.log("Click intercepted on:", e.target);
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  
  // Show the popup to ask if they need this
  showReflectionPopup(e);
  return false;
}

function showReflectionPopup(e) {
  // Check if popup already exists to avoid duplicates
  if (document.querySelector('.dineed-overlay')) {
    return;
  }
  
  console.log("Showing reflection popup");
  
  // Collect product info from the page
  const productTitle = document.querySelector('#productTitle') ? 
    document.querySelector('#productTitle').textContent.trim() : '';
  const productPrice = document.querySelector('.a-price .a-offscreen') ? 
    document.querySelector('.a-price .a-offscreen').textContent.trim() : '';
  
  const productInfo = productTitle && productPrice ? 
    `<p class="product-info">${productTitle} - ${productPrice}</p>` : '';
  
  // Create popup overlay
  const overlay = document.createElement('div');
  overlay.className = 'dineed-overlay';
  
  const popup = document.createElement('div');
  popup.className = 'dineed-popup';
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
  
  // Add styles to make sure the popup is visible and properly styled
  const style = document.createElement('style');
  style.textContent = `
    .dineed-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      z-index: 999999;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .dineed-popup {
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 90%;
      width: 400px;
      text-align: center;
    }
    
    .dineed-buttons {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-top: 20px;
    }
    
    .dineed-buttons button {
      padding: 8px 16px;
      border-radius: 4px;
      border: none;
      font-weight: bold;
      cursor: pointer;
    }
    
    #dineed-yes {
      background-color: #e0e0e0;
      color: black;
    }
    
    #dineed-alternatives {
      background-color: #4CAF50;
      color: white;
    }
    
    #dineed-no {
      background-color: #2196F3;
      color: white;
    }
  `;
  document.head.appendChild(style);
  
  // Handle button clicks
  document.getElementById('dineed-yes').addEventListener('click', function() {
    console.log("User clicked 'Yes'");
    // Continue with original purchase
    removePopup();
    
    // Set a flag to prevent re-triggering our interceptor
    isProcessingClick = true;
    
    // Try to proceed with checkout by clicking the original button
    const originalButton = e.target;
    console.log("Proceeding with original action on:", originalButton);
    
    // Try to submit the form directly if possible
    const form = originalButton.closest('form');
    if (form) {
      console.log("Submitting form directly");
      setTimeout(() => {
        form.submit();
        isProcessingClick = false;
      }, 100);
    } else {
      // If no form, simulate a native click event
      setTimeout(() => {
        // Remove our event listener temporarily
        originalButton.removeEventListener('click', interceptClick, true);
        
        // Create and dispatch a new click event
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        
        originalButton.dispatchEvent(clickEvent);
        
        // Re-add our listener after a delay
        setTimeout(() => {
          originalButton.addEventListener('click', interceptClick, true);
          isProcessingClick = false;
        }, 500);
      }, 100);
    }
  });
  
  document.getElementById('dineed-alternatives').addEventListener('click', function() {
    console.log("User clicked 'Show alternatives'");
    removePopup();
    
    // Collect product info for alternatives
    const productInfo = {
      title: productTitle || "Current Product",
      price: productPrice || "$0.00",
      url: window.location.href
    };
    
    // Use chrome.runtime.sendMessage to request alternatives
    chrome.runtime.sendMessage({
      action: "findAlternatives",
      product: productInfo
    });
    
    // Show loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'dineed-overlay';
    loadingOverlay.innerHTML = `
      <div class="dineed-popup">
        <h2>Finding sustainable alternatives...</h2>
        <div class="dineed-spinner"></div>
        <p>We're searching second-hand marketplaces and sustainable brands</p>
      </div>
    `;
    document.body.appendChild(loadingOverlay);
  });
  
  document.getElementById('dineed-no').addEventListener('click', function() {
    console.log("User clicked 'No'");
    removePopup();
    
    // Show a positive reinforcement message
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
    
    // Update stats if we have product info
    if (productPrice) {
      const priceValue = parseFloat(productPrice.replace(/[^\d.]/g, ''));
      if (!isNaN(priceValue)) {
        chrome.storage.local.get(['reconsideredCount', 'moneySaved', 'co2Saved'], function(stats) {
          chrome.storage.local.set({
            reconsideredCount: (stats.reconsideredCount || 0) + 1,
            moneySaved: (stats.moneySaved || 0) + priceValue,
            co2Saved: (stats.co2Saved || 0) + 2.5 // rough estimate of CO2 saved per item
          });
        });
      }
    }
  });
}

function removePopup() {
  const overlay = document.querySelector('.dineed-overlay');
  if (overlay) {
    document.body.removeChild(overlay);
  }
}

// Listen for messages from background script (for alternatives display)
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
        <p>${originalProduct.title} - ${originalProduct.price}</p>
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
  });
  document.getElementById('dineed-skip-purchase').addEventListener('click', function() {
    removePopup();
    
    // Show confirmation message
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
    
    // Update stats
    if (originalProduct && originalProduct.price) {
      const priceStr = originalProduct.price.replace(/[^\d.]/g, '');
      const price = parseFloat(priceStr);
      if (!isNaN(price)) {
        chrome.storage.local.get(['reconsideredCount', 'moneySaved', 'co2Saved'], function(stats) {
          chrome.storage.local.set({
            reconsideredCount: (stats.reconsideredCount || 0) + 1,
            moneySaved: (stats.moneySaved || 0) + price,
            co2Saved: (stats.co2Saved || 0) + 2.5 // rough estimate of CO2 saved per item
          });
        });
      }
    }
  });
}