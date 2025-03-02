console.log("Do I Need That? extension loaded");

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
  
  // Create popup overlay
  const overlay = document.createElement('div');
  overlay.className = 'dineed-overlay';
  
  const popup = document.createElement('div');
  popup.className = 'dineed-popup';
  popup.innerHTML = `
    <h2>Do I Need That?</h2>
    <p>Take a moment to reflect on this purchase.</p>
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
    // Try to proceed with checkout by clicking the original button
    const originalButton = e.target;
    console.log("Proceeding with original action on:", originalButton);
    
    // Instead of using click() (which might be intercepted again),
    // try to submit the form directly if possible
    const form = originalButton.closest('form');
    if (form) {
      console.log("Submitting form directly");
      form.submit();
    } else {
      // If no form, simulate a native click event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      // Temporarily remove our listener
      originalButton.removeEventListener('click', interceptClick, true);
      originalButton.dispatchEvent(clickEvent);
      // Re-add our listener after a delay
      setTimeout(() => {
        originalButton.addEventListener('click', interceptClick, true);
      }, 100);
    }
  });
  
  document.getElementById('dineed-alternatives').addEventListener('click', function() {
    console.log("User clicked 'Show alternatives'");
    removePopup();
    // Placeholder for the alternatives functionality
    alert("This would show alternatives in the full implementation");
  });
  
  document.getElementById('dineed-no').addEventListener('click', function() {
    console.log("User clicked 'No'");
    removePopup();
    // Show a positive reinforcement message
    alert("Good choice! You just helped reduce consumption.");
  });
}

function removePopup() {
  const overlay = document.querySelector('.dineed-overlay');
  if (overlay) {
    document.body.removeChild(overlay);
  }
}