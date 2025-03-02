// Function to check if the current page is a product page
function isProductPage() {
    const url = window.location.href;
    const productPagePatterns = [
        /amazon\.com\/.*\/dp\//,
        /amazon\.com\/dp\//,
        /ebay\.com\/itm\//,
        /walmart\.com\/ip\//,
        /bestbuy\.com\/site\//,
        /target\.com\/p\//,
        /staples\.com\/product_/
    ];
    
    return productPagePatterns.some(pattern => pattern.test(url));
}

// Function to create and inject the sustainability badge
function injectSustainabilityBadge() {
    console.log("Do I Need That? - Checking if we should inject badge");
    
    // Only inject on product pages
    if (!isProductPage()) {
        console.log("Do I Need That? - Not a product page, skipping badge injection");
        return;
    }
    
    console.log("Do I Need That? - Product page detected, injecting badge");
    
    // Create badge container
    const badgeContainer = document.createElement('div');
    badgeContainer.className = 'dineed-badge-container';
    badgeContainer.style.position = 'fixed';
    badgeContainer.style.top = '100px';
    badgeContainer.style.right = '20px';
    badgeContainer.style.zIndex = '9999';
    badgeContainer.style.backgroundColor = '#ffffff';
    badgeContainer.style.borderRadius = '8px';
    badgeContainer.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    badgeContainer.style.padding = '15px';
    badgeContainer.style.width = '250px';
    badgeContainer.style.fontFamily = 'Arial, sans-serif';
    badgeContainer.style.transition = 'all 0.3s ease';
    
    // Add loading state initially
    badgeContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <h3 style="margin: 0; color: #4CAF50;">Do I Need That?</h3>
            <button id="dineed-close" style="background: none; border: none; cursor: pointer; font-size: 16px;">×</button>
        </div>
        <div id="dineed-loading" style="text-align: center; padding: 10px;">
            <p>Analyzing product sustainability...</p>
            <div style="width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #4CAF50; border-radius: 50%; margin: 10px auto; animation: dineed-spin 1s linear infinite;"></div>
        </div>
        <div id="dineed-content" style="display: none;"></div>
        <div id="dineed-error" style="display: none; color: #F44336; padding: 10px;"></div>
        <style>
            @keyframes dineed-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    // Add badge to page
    document.body.appendChild(badgeContainer);
    
    // Add close button functionality
    document.getElementById('dineed-close').addEventListener('click', function() {
        badgeContainer.style.opacity = '0';
        setTimeout(() => {
            badgeContainer.remove();
        }, 300);
    });
    
    // Get the current URL
    const url = window.location.href;
    
    // Call the backend API
    fetch('http://127.0.0.1:8000/api/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Could not analyze this product. Please make sure the backend server is running.');
            });
        }
        return response.json();
    })
    .then(data => {
        // Hide loading indicator
        document.getElementById('dineed-loading').style.display = 'none';
        
        // Check if the response was successful
        if (data.success) {
            // Display the product information
            displayProductInfo(data);
        } else {
            throw new Error(data.error || 'Unknown error occurred');
        }
    })
    .catch(error => {
        // Hide loading indicator and show error
        document.getElementById('dineed-loading').style.display = 'none';
        const errorElement = document.getElementById('dineed-error');
        errorElement.textContent = error.message || 'Could not analyze this product. Please make sure the backend server is running.';
        errorElement.style.display = 'block';
        console.error('Do I Need That? - Error:', error);
    });
}

// Function to display product information in the badge
function displayProductInfo(data) {
    const contentElement = document.getElementById('dineed-content');
    contentElement.style.display = 'block';
    
    // Get sustainability score
    const scoreValue = data.product.sustainability_score;
    const scoreLevel = scoreValue >= 75 ? 'high' : (scoreValue >= 50 ? 'medium' : 'low');
    const scoreColor = scoreValue >= 75 ? '#4CAF50' : (scoreValue >= 50 ? '#FF9800' : '#F44336');
    const impactText = scoreLevel === 'high' ? 'Low Impact' : (scoreLevel === 'medium' ? 'Medium Impact' : 'High Impact');
    
    // Create HTML content
    let html = `
        <div style="text-align: center; margin-bottom: 15px;">
            <div style="position: relative; width: 80px; height: 80px; margin: 0 auto; background: conic-gradient(${scoreColor} ${scoreValue * 3.6}deg, #e0e0e0 ${scoreValue * 3.6}deg 360deg); border-radius: 50%;">
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; font-weight: bold;">${scoreValue}</div>
            </div>
            <p style="margin: 5px 0; font-weight: bold; color: ${scoreColor};">${impactText}</p>
        </div>
    `;
    
    // Add eco factors
    if (data.product.eco_factors && data.product.eco_factors.length > 0) {
        html += '<div style="margin-bottom: 15px;"><h4 style="margin: 5px 0;">Environmental Factors:</h4><ul style="margin: 5px 0; padding-left: 20px;">';
        
        data.product.eco_factors.forEach(factor => {
            html += `<li>${factor}</li>`;
        });
        
        html += '</ul></div>';
    }
    
    // Add alternatives count
    const secondhandCount = data.secondhand_alternatives ? data.secondhand_alternatives.length : 0;
    const sustainableCount = data.sustainable_alternatives ? data.sustainable_alternatives.length : 0;
    
    if (secondhandCount > 0 || sustainableCount > 0) {
        html += '<div style="margin-bottom: 15px;">';
        
        if (secondhandCount > 0) {
            html += `<p>Found ${secondhandCount} second-hand alternatives</p>`;
        }
        
        if (sustainableCount > 0) {
            html += `<p>Found ${sustainableCount} sustainable alternatives</p>`;
        }
        
        html += '</div>';
    }
    
    // Add button to open popup
    html += `
        <button id="dineed-open-popup" style="background-color: #4CAF50; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; width: 100%;">
            View Detailed Analysis
        </button>
    `;
    
    // Set the HTML content
    contentElement.innerHTML = html;
    
    // Add event listener for the popup button
    document.getElementById('dineed-open-popup').addEventListener('click', function() {
        chrome.runtime.sendMessage({ action: "openPopup" });
    });
}

// Run the injection when the page is fully loaded
window.addEventListener('load', injectSustainabilityBadge);

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "checkProductPage") {
        sendResponse({ isProductPage: isProductPage() });
    }
}); 