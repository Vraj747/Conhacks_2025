document.addEventListener('DOMContentLoaded', function() {
   // Create product information section
   const productInfoSection = document.createElement('div');
   productInfoSection.className = 'product-section';
   productInfoSection.innerHTML = '<h3>Current Product</h3><p class="loading">Analyzing product...</p>';
   
   // Insert after the stats section
   const statsSection = document.querySelector('.stats');
   statsSection.insertAdjacentElement('afterend', productInfoSection);
   
   // Load saved stats
   chrome.storage.local.get(['reconsideredCount', 'moneySaved', 'co2Saved', 'settings'], function(data) {
       // Update stats values
       if (data.reconsideredCount) {
           document.getElementById('reconsideredCount').textContent = data.reconsideredCount;
       }
       
       if (data.moneySaved) {
           document.getElementById('moneySaved').textContent = `$${data.moneySaved.toFixed(2)}`;
       }
       
       if (data.co2Saved) {
           document.getElementById('co2Saved').textContent = `${data.co2Saved.toFixed(1)} kg`;
       }
       
       // Set toggle states
       if (data.settings) {
           document.getElementById('enableExtension').checked = data.settings.enabled !== false;
           document.getElementById('showSecondHand').checked = data.settings.showSecondHand !== false;
           document.getElementById('showSustainable').checked = data.settings.showSustainable !== false;
       }
       
       // Load product info if extension is enabled
       if (!data.settings || data.settings.enabled !== false) {
           loadProductInfo();
       } else {
           productInfoSection.innerHTML = `
               <h3>Current Product</h3>
               <p>Enable "Do I Need That?" to analyze products.</p>
           `;
       }
   });
   
   // Save settings when toggles are changed
   document.getElementById('enableExtension').addEventListener('change', function() {
       saveSettings();
       // Reload product info when extension is toggled
       if (this.checked) {
           loadProductInfo();
       } else {
           const productSection = document.querySelector('.product-section');
           if (productSection) {
               productSection.innerHTML = `
                   <h3>Current Product</h3>
                   <p>Enable "Do I Need That?" to analyze products.</p>
               `;
           }
       }
   });
   
   document.getElementById('showSecondHand').addEventListener('change', saveSettings);
   document.getElementById('showSustainable').addEventListener('change', saveSettings);
   
   function saveSettings() {
       const settings = {
           enabled: document.getElementById('enableExtension').checked,
           showSecondHand: document.getElementById('showSecondHand').checked,
           showSustainable: document.getElementById('showSustainable').checked
       };
       
       chrome.storage.local.set({settings: settings});
   }

   function loadProductInfo() {
       // Get the current tab ID
       chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
           if (!tabs || tabs.length === 0) {
               console.log("No active tabs found");
               const productSection = document.querySelector('.product-section');
               productSection.innerHTML = `
                   <h3>Current Product</h3>
                   <p>No active tab detected.</p>
               `;
               return;
           }
           
           const currentTabId = tabs[0].id;
           const currentUrl = tabs[0].url;
           
           // First check if we have data for this tab
           chrome.storage.local.get([
               `sustainability_${currentTabId}`, 
               `product_${currentTabId}`, 
               'currentProduct', 
               'onProductPage'
           ], function(data) {
               const sustainabilityData = data[`sustainability_${currentTabId}`];
               const productData = data[`product_${currentTabId}`] || data.currentProduct;
               const onProductPage = data.onProductPage;
               
               if (sustainabilityData) {
                   // We already have sustainability data for this product
                   displayProductInfo(sustainabilityData);
                   return;
               }
               
               if (productData) {
                   // We have product data but no sustainability data yet
                   const productSection = document.querySelector('.product-section');
                   productSection.innerHTML = `
                       <h3>Current Product</h3>
                       <div class="product-card">
                           <h4 class="product-title">${productData.title || 'Product'}</h4>
                           <div class="product-price">${productData.price || ''}</div>
                           <p class="loading">Analyzing sustainability metrics...</p>
                       </div>
                   `;
                   
                   // Try to fetch sustainability data
                   fetchSustainabilityData(currentUrl, currentTabId);
                   return;
               }
               
               // Check if we're on a product page
               if (onProductPage) {
                   const productSection = document.querySelector('.product-section');
                   productSection.innerHTML = `
                       <h3>Current Product</h3>
                       <p class="loading">Detecting product information...</p>
                   `;
                   return;
               }
               
               // Check if we're on a supported product page
               const isProductPage = /amazon\.com|walmart\.com|bestbuy\.com|ebay\.com/.test(currentUrl || '');
               
               if (!isProductPage) {
                   const productSection = document.querySelector('.product-section');
                   productSection.innerHTML = `
                       <h3>Current Product</h3>
                       <p>No product detected. Visit a supported product page.</p>
                       <p class="supported-sites">Supported sites: Amazon, Walmart, Best Buy, eBay</p>
                   `;
                   return;
               }
               
               // We're on a product page but don't have data yet
               const productSection = document.querySelector('.product-section');
               productSection.innerHTML = `
                   <h3>Current Product</h3>
                   <p class="loading">Analyzing product page...</p>
               `;
               
               // Try to fetch sustainability data
               fetchSustainabilityData(currentUrl, currentTabId);
           });
       });
   }
   
   function fetchSustainabilityData(url, tabId) {
       if (!url) {
           const productSection = document.querySelector('.product-section');
           productSection.innerHTML = `
               <h3>Current Product</h3>
               <p class="error">Invalid URL. Cannot analyze product.</p>
           `;
           return;
       }
       
       // Generate mock data for demonstration purposes
       setTimeout(() => {
           const mockData = generateMockData(url);
           
           // Store the sustainability data for this tab
           chrome.storage.local.set({
               [`sustainability_${tabId}`]: mockData
           });
           
           displayProductInfo(mockData);
       }, 1000);
   }
   
   function generateMockData(url) {
       // Extract product name from URL
       let productName = "Product";
       if (url.includes('amazon.com')) {
           const match = url.match(/\/([A-Z0-9]{10})/);
           if (match) {
               productName = `Amazon Product ${match[1].substring(0, 5)}`;
           }
       }
       
       // Generate random score
       const score = Math.floor(Math.random() * 100);
       let level = "Poor";
       if (score >= 80) level = "Excellent";
       else if (score >= 60) level = "Good";
       else if (score >= 40) level = "Average";
       else if (score >= 20) level = "Below Average";
       
       // Generate factors
       const factors = [
           "Materials used in manufacturing",
           "Energy consumption during production",
           "Packaging recyclability",
           "Company sustainability practices"
       ];
       
       // Generate mock alternatives
       const alternatives = [
           {
               title: `Eco-friendly ${productName}`,
               price: "$" + (Math.floor(Math.random() * 100) + 20).toFixed(2),
               source: "EarthHero",
               url: "https://earthhero.com/",
               sustainability_score: Math.floor(Math.random() * 20) + 80
           },
           {
               title: `Sustainable ${productName}`,
               price: "$" + (Math.floor(Math.random() * 100) + 20).toFixed(2),
               source: "Patagonia",
               url: "https://www.patagonia.com/",
               sustainability_score: Math.floor(Math.random() * 20) + 70
           }
       ];
       
       return {
           product: {
               title: productName,
               price: "$" + (Math.floor(Math.random() * 100) + 10).toFixed(2),
               url: url
           },
           sustainability: {
               score: score,
               level: level,
               factors: factors
           },
           alternatives: alternatives
       };
   }

   function displayProductInfo(data) {
       const productSection = document.querySelector('.product-section');
       
       if (!data.product || !data.product.title) {
           productSection.innerHTML = `
               <h3>Current Product</h3>
               <p>Could not identify product on this page.</p>
           `;
           return;
       }
       
       // Get sustainability data
       const sustainability = data.sustainability;
       const scoreColor = getSustainabilityColor(sustainability.score);
       
       // Create factors list
       let factorsHtml = '';
       if (sustainability.factors && sustainability.factors.length > 0) {
           factorsHtml = '<ul class="factors">';
           sustainability.factors.forEach(factor => {
               factorsHtml += `<li>${factor}</li>`;
           });
           factorsHtml += '</ul>';
       }
       
       // Create alternatives section
       let alternativesHtml = '';
       if (data.alternatives && data.alternatives.length > 0) {
           alternativesHtml = '<h4>Sustainable Alternatives</h4><div class="alternatives">';
           data.alternatives.forEach(alt => {
               const altScoreColor = getSustainabilityColor(alt.sustainability_score);
               alternativesHtml += `
                   <div class="alternative-item">
                       <div class="alt-title">${alt.title}</div>
                       <div class="alt-details">
                           <span class="alt-price">${alt.price}</span>
                           <span class="alt-source">${alt.source}</span>
                           <span class="alt-score" style="color: ${altScoreColor}">
                               Score: ${alt.sustainability_score}/100
                           </span>
                       </div>
                       <a href="${alt.url}" target="_blank" class="view-alt-btn">View</a>
                   </div>
               `;
           });
           alternativesHtml += '</div>';
       }
       
       // Update product section HTML
       productSection.innerHTML = `
           <h3>Current Product</h3>
           <div class="product-card">
               <h4 class="product-title">${data.product.title}</h4>
               <div class="product-price">${data.product.price}</div>
               
               <div class="sustainability-score">
                   <div class="score-label">Sustainability Score:</div>
                   <div class="score-value" style="color: ${scoreColor}">
                       ${sustainability.score}/100
                       <span class="score-level">(${sustainability.level})</span>
                   </div>
               </div>
               
               ${factorsHtml}
               
               <div class="actions">
                   <button id="continueBtn" class="action-btn continue">Continue with Purchase</button>
                   <button id="skipBtn" class="action-btn skip">Skip this Purchase</button>
               </div>
           </div>
           
           ${alternativesHtml}
       `;
       
       // Add button event listeners
       document.getElementById('continueBtn').addEventListener('click', function() {
           // Just close the popup to continue with purchase
           window.close();
       });
       
       document.getElementById('skipBtn').addEventListener('click', function() {
           // Update stats for skipped purchase
           chrome.storage.local.get(['reconsideredCount', 'moneySaved', 'co2Saved'], function(stats) {
               const reconsideredCount = (stats.reconsideredCount || 0) + 1;
               let moneySaved = stats.moneySaved || 0;
               let co2Saved = stats.co2Saved || 0;
               
               if (data.product && data.product.price) {
                   const priceStr = data.product.price.replace(/[^\d.]/g, '');
                   const price = parseFloat(priceStr);
                   if (!isNaN(price)) {
                       moneySaved += price;
                   }
               }
               
               co2Saved += 2.5; // rough estimate of CO2 saved per item
               
               chrome.storage.local.set({
                   reconsideredCount: reconsideredCount,
                   moneySaved: moneySaved,
                   co2Saved: co2Saved
               }, function() {
                   // Show confirmation and update displayed stats
                   document.getElementById('reconsideredCount').textContent = reconsideredCount;
                   document.getElementById('moneySaved').textContent = `$${moneySaved.toFixed(2)}`;
                   document.getElementById('co2Saved').textContent = `${co2Saved.toFixed(1)} kg`;
                   
                   // Show success message
                   showSuccessMessage();
               });
           });
       });
   }
   
   function getSustainabilityColor(score) {
       // Return color based on sustainability score
       if (score >= 80) return '#4CAF50'; // Green for high
       if (score >= 60) return '#8BC34A'; // Light green
       if (score >= 40) return '#FFC107'; // Yellow/amber for medium
       if (score >= 20) return '#FF9800'; // Orange
       return '#F44336'; // Red for low
   }
   
   function showSuccessMessage() {
       // Create and show success message
       const successMsg = document.createElement('div');
       successMsg.className = 'success-message';
       successMsg.innerHTML = `
           <div class="success-content">
               <div class="success-icon">🌿</div>
               <h3>Good Choice!</h3>
               <p>You've helped the planet by reconsidering this purchase.</p>
               <p>Your stats have been updated.</p>
           </div>
       `;
       
       document.body.appendChild(successMsg);
       
       // Remove after 3 seconds
       setTimeout(() => {
           if (document.body.contains(successMsg)) {
               document.body.removeChild(successMsg);
           }
       }, 3000);
   }
});