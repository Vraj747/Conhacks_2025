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
            const currentTabId = tabs[0].id;
            const currentUrl = tabs[0].url;
            
            // First check if we have sustainability data for this tab
            chrome.storage.local.get([`sustainability_${currentTabId}`, `product_${currentTabId}`, 'onProductPage'], function(data) {
                const sustainabilityData = data[`sustainability_${currentTabId}`];
                const productData = data[`product_${currentTabId}`];
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
                            <h4 class="product-title">${productData.title}</h4>
                            <div class="product-price">${productData.price}</div>
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
                const isProductPage = /amazon\.(com|ca|co\.uk|de|fr|it|es|jp|in|com\.au|com\.mx)|walmart\.(com|ca)|bestbuy\.(com|ca)|ebay\.(com|ca|co\.uk|de|fr|it|es|com\.au)/.test(currentUrl);
                
                if (!isProductPage) {
                    const productSection = document.querySelector('.product-section');
                    productSection.innerHTML = `
                        <h3>Current Product</h3>
                        <p>No product detected. Visit a supported product page.</p>
                        <p class="supported-sites">Supported sites: Amazon, Walmart, Best Buy, eBay (including regional domains)</p>
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
        // API endpoint
        const apiUrl = 'http://127.0.0.1:8000/api/analyze';
        
        // Show loading state
        const productSection = document.querySelector('.product-section');
        productSection.innerHTML = `
            <h3>Current Product</h3>
            <p class="loading">Analyzing product sustainability...</p>
        `;
        
        // Fetch product info
        fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: url })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API returned status ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('API response:', data);
                
                // Check if the API returned an error
                if (data.error) {
                    throw new Error(data.error || 'API returned unsuccessful response');
                }
                
                // Store the sustainability data for this tab
                chrome.storage.local.set({
                    [`sustainability_${tabId}`]: data
                });
                
                displayProductInfo(data);
            })
            .catch(error => {
                console.error('Error fetching product data:', error);
                productSection.innerHTML = `
                    <h3>Current Product</h3>
                    <p class="error">Could not analyze this product. Please make sure the backend server is running.</p>
                    <p>Error: ${error.message}</p>
                `;
            });
    }

    function displayProductInfo(data) {
        const productSection = document.querySelector('.product-section');
        
        // Check if we have valid product data
        if (!data || !data.title) {
            productSection.innerHTML = `
                <h3>Current Product</h3>
                <p>Could not identify product on this page.</p>
            `;
            return;
        }
        
        // Get sustainability data with null checks
        const ecoFactors = data.eco_factors || [0, []];
        const score = ecoFactors[0] || 0;
        const factors = ecoFactors[1] || [];
        const scoreColor = getSustainabilityColor(score);
        
        // Determine sustainability level based on score
        let level = 'Poor';
        if (score >= 80) level = 'Excellent';
        else if (score >= 60) level = 'Good';
        else if (score >= 40) level = 'Average';
        else if (score >= 20) level = 'Below Average';
        
        // Create factors list with null check
        let factorsHtml = '';
        if (factors && Array.isArray(factors) && factors.length > 0) {
            factorsHtml = '<ul class="factors">';
            factors.forEach(factor => {
                factorsHtml += `<li>${factor}</li>`;
            });
            factorsHtml += '</ul>';
        }
        
        // Get packaging impact data with null checks
        let packagingHtml = '';
        if (data.packaging_impact) {
            const packagingImpact = data.packaging_impact;
            const impactScore = packagingImpact.impact_score || 0;
            const impactLevel = packagingImpact.impact_level || 'Medium';
            const impactFactors = packagingImpact.impact_factors || [];
            const materials = packagingImpact.materials || [];
            const wasteWeight = packagingImpact.waste_weight_g || 0;
            const carbonFootprint = packagingImpact.carbon_footprint_g || 0;
            const waterUsage = packagingImpact.water_usage_l || 0;
            
            // Determine color based on impact level (inverse of sustainability - higher score means lower impact)
            let impactColor = '#F44336'; // Red for high impact
            if (impactScore >= 75) {
                impactColor = '#4CAF50'; // Green for low impact
            } else if (impactScore >= 50) {
                impactColor = '#FFC107'; // Yellow/amber for medium impact
            }
            
            packagingHtml = `
                <div class="packaging-impact">
                    <h4>Packaging Environmental Impact</h4>
                    <div class="impact-score" style="display: flex; align-items: center; margin-bottom: 10px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: conic-gradient(${impactColor} ${impactScore * 3.6}deg, #e0e0e0 ${impactScore * 3.6}deg 360deg); display: flex; align-items: center; justify-content: center; margin-right: 10px;">
                            <span style="font-weight: bold;">${impactScore}</span>
                        </div>
                        <span style="font-weight: bold; color: ${impactColor};">${impactLevel} Impact</span>
                    </div>
                    <div class="impact-details">
                        <p><strong>Materials:</strong> ${materials.join(', ')}</p>
                        <p><strong>Estimated waste:</strong> ${wasteWeight}g</p>
                        <p><strong>Carbon footprint:</strong> ${carbonFootprint}g CO₂</p>
                        <p><strong>Water usage:</strong> ${waterUsage}L</p>
                    </div>
                    <div class="impact-factors">
                        <h5>Impact Factors:</h5>
                        <ul>
                            ${impactFactors.map(factor => `<li>${factor}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }
        
        // Get alternatives from the API response
        const secondHandAlts = data.secondhand_alternatives || [];
        const sustainableAlts = data.sustainable_alternatives || [];
        
        // Create alternatives section
        let alternativesHtml = '';
        
        // Create second-hand alternatives section
        if (secondHandAlts.length > 0 && document.getElementById('showSecondHand').checked) {
            alternativesHtml += '<h4>Second-Hand Alternatives</h4><div class="alternatives">';
            secondHandAlts.forEach(alt => {
                const altScore = alt.sustainability_score || 85; // Default high score for second-hand
                const altScoreColor = getSustainabilityColor(altScore);
                const altUrl = alt.link || alt.url || '#';
                
                // Check if this is a search URL or a specific product link
                const isSearchUrl = alt.isSearchUrl || (!altUrl.includes('item') && !altUrl.includes('product') && !altUrl.includes('dp/'));
                
                alternativesHtml += `
                    <div class="alternative-item">
                        <div class="alt-title">${alt.title || 'Unknown Product'}</div>
                        <div class="alt-details">
                            <span class="alt-price">${alt.price || '$0.00'}</span>
                            <span class="alt-source">${alt.source || 'Unknown Source'}</span>
                            ${alt.condition ? `<span class="alt-condition">Condition: ${alt.condition}</span>` : ''}
                            <span class="alt-score" style="color: ${altScoreColor}">
                                Score: ${altScore}/100
                            </span>
                        </div>
                        <a href="${altUrl}" target="_blank" class="view-alt-btn" 
                           title="${isSearchUrl ? 'This will take you to the marketplace homepage where you can search for similar items' : 'View this specific second-hand product'}">
                           ${isSearchUrl ? 'Visit Marketplace' : 'View Item'}</a>
                    </div>
                `;
            });
            alternativesHtml += '</div>';
        }
        
        // Create sustainable alternatives section
        if (sustainableAlts.length > 0 && document.getElementById('showSustainable').checked) {
            alternativesHtml += '<h4>Sustainable Brand Alternatives</h4><div class="alternatives">';
            sustainableAlts.forEach(alt => {
                const altScore = alt.sustainability_score || 75; // Default good score for sustainable
                const altScoreColor = getSustainabilityColor(altScore);
                const altUrl = alt.link || alt.url || '#';
                
                // Check if this is a search URL or a specific product link
                const isSearchUrl = alt.isSearchUrl || (!altUrl.includes('item') && !altUrl.includes('product') && !altUrl.includes('dp/'));
                
                // Create eco-factors list if available
                let ecoFactorsHtml = '';
                if (alt.eco_factors && Array.isArray(alt.eco_factors) && alt.eco_factors.length > 0) {
                    ecoFactorsHtml = '<ul class="eco-factors">';
                    alt.eco_factors.forEach(factor => {
                        ecoFactorsHtml += `<li>${factor}</li>`;
                    });
                    ecoFactorsHtml += '</ul>';
                }
                
                alternativesHtml += `
                    <div class="alternative-item">
                        <div class="alt-title">${alt.title || 'Unknown Product'}</div>
                        <div class="alt-details">
                            <span class="alt-price">${alt.price || '$0.00'}</span>
                            <span class="alt-source">${alt.source || 'Unknown Source'}</span>
                            <span class="alt-score" style="color: ${altScoreColor}">
                                Score: ${altScore}/100
                            </span>
                        </div>
                        ${ecoFactorsHtml}
                        <a href="${altUrl}" target="_blank" class="view-alt-btn"
                           title="${isSearchUrl ? 'This will take you to the brand\'s website where you can browse similar sustainable products' : 'View this specific sustainable product'}">
                           ${isSearchUrl ? 'Visit Brand' : 'View Item'}</a>
                    </div>
                `;
            });
            alternativesHtml += '</div>';
        }
        
        // Create the product card with sustainability score and packaging impact
        productSection.innerHTML = `
            <h3>Current Product</h3>
            <div class="product-card">
                <h4 class="product-title">${data.title}</h4>
                <div class="product-price">${data.price}</div>
                <div class="product-details">
                    ${data.image_url ? `<img src="${data.image_url}" alt="${data.title}" class="product-image">` : ''}
                    <div class="sustainability-score">
                        <h4>Sustainability Score</h4>
                        <div class="score-circle" style="background: conic-gradient(${scoreColor} ${score * 3.6}deg, #e0e0e0 ${score * 3.6}deg 360deg);">
                            <span>${score}</span>
                        </div>
                        <p class="score-level">${level} Sustainability</p>
                        ${factorsHtml}
                    </div>
                </div>
                ${packagingHtml}
                <div class="product-actions">
                    <button id="skipBtn" class="action-button">Skip This Purchase</button>
                    <button id="showAlternativesBtn" class="action-button">Show Alternatives</button>
                    <a href="${data.url}" target="_blank" class="action-button secondary">View on Amazon</a>
                </div>
            </div>
            <div id="alternativesSection" style="display: none;">
                <h3>Alternatives</h3>
                ${alternativesHtml}
            </div>
        `;
        
        // Add button event listeners
        document.getElementById('skipBtn').addEventListener('click', function() {
            // Update stats for skipped purchase
            chrome.storage.local.get(['reconsideredCount', 'moneySaved'], function(stats) {
                const reconsideredCount = (stats.reconsideredCount || 0) + 1;
                let moneySaved = stats.moneySaved || 0;
                
                if (data && data.price) {
                    const priceStr = data.price.replace(/[^\d.]/g, '');
                    const price = parseFloat(priceStr);
                    if (!isNaN(price)) {
                        moneySaved += price;
                    }
                }
                
                chrome.storage.local.set({
                    reconsideredCount: reconsideredCount,
                    moneySaved: moneySaved,
                    co2Saved: (stats.co2Saved || 0) + 2.5 // rough estimate of CO2 saved per item
                }, function() {
                    // Show confirmation and update displayed stats
                    document.getElementById('reconsideredCount').textContent = reconsideredCount;
                    document.getElementById('moneySaved').textContent = `$${moneySaved.toFixed(2)}`;
                    document.getElementById('co2Saved').textContent = `${((stats.co2Saved || 0) + 2.5).toFixed(1)} kg`;
                    
                    // Show success message
                    showSuccessMessage();
                });
            });
        });
        
        // Add event listener for the Show Alternatives button
        document.getElementById('showAlternativesBtn').addEventListener('click', function() {
            const alternativesSection = document.getElementById('alternativesSection');
            
            // If we already have alternatives, just toggle their visibility
            if (alternativesHtml) {
                if (alternativesSection.style.display === 'none') {
                    alternativesSection.style.display = 'block';
                    this.textContent = 'Hide Alternatives';
                } else {
                    alternativesSection.style.display = 'none';
                    this.textContent = 'Show Alternatives';
                }
                return;
            }
            
            // If we don't have alternatives yet, create some default ones
            const productTitle = encodeURIComponent(data.title || '');
            let defaultAlternativesHtml = '';
            
            // Create default second-hand alternatives
            if (document.getElementById('showSecondHand').checked) {
                defaultAlternativesHtml += '<h4>Second-Hand Alternatives</h4><div class="alternatives">';
                
                // Add eBay
                defaultAlternativesHtml += `
                    <div class="alternative-item">
                        <div class="alt-title">Find "${data.title}" on eBay</div>
                        <div class="alt-details">
                            <span class="alt-price">Various prices</span>
                            <span class="alt-source">eBay</span>
                            <span class="alt-score" style="color: ${getSustainabilityColor(85)}">
                                Score: 85/100
                            </span>
                        </div>
                        <a href="https://www.ebay.com/sch/i.html?_nkw=${productTitle}" target="_blank" class="view-alt-btn" 
                           title="This will take you to eBay search results for this product">
                           Visit Marketplace</a>
                    </div>
                `;
                
                // Add Poshmark
                defaultAlternativesHtml += `
                    <div class="alternative-item">
                        <div class="alt-title">Find "${data.title}" on Poshmark</div>
                        <div class="alt-details">
                            <span class="alt-price">Various prices</span>
                            <span class="alt-source">Poshmark</span>
                            <span class="alt-score" style="color: ${getSustainabilityColor(85)}">
                                Score: 85/100
                            </span>
                        </div>
                        <a href="https://poshmark.com/search?query=${productTitle}" target="_blank" class="view-alt-btn" 
                           title="This will take you to Poshmark search results for this product">
                           Visit Marketplace</a>
                    </div>
                `;
                
                defaultAlternativesHtml += '</div>';
            }
            
            // Update the alternatives section
            alternativesSection.innerHTML = `
                <h3>Alternatives</h3>
                ${defaultAlternativesHtml}
            `;
            
            // Show the alternatives section
            alternativesSection.style.display = 'block';
            this.textContent = 'Hide Alternatives';
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

    // Function to check if URL is a product page
    function isProductPage(url) {
        const productPagePatterns = [
            /amazon\.(com|ca|co\.uk|de|fr|it|es|jp|in|com\.au|com\.mx)\/.*\/dp\//,
            /amazon\.(com|ca|co\.uk|de|fr|it|es|jp|in|com\.au|com\.mx)\/dp\//,
            /amazon\.(com|ca|co\.uk|de|fr|it|es|jp|in|com\.au|com\.mx)\/.*\/gp\/product\//,
            /ebay\.(com|ca|co\.uk|de|fr|it|es|com\.au)\/itm\//,
            /walmart\.(com|ca)\/ip\//,
            /bestbuy\.(com|ca)\/site\//,
            /target\.com\/p\//,
            /staples\.(com|ca)\/product_/
        ];
        
        return productPagePatterns.some(pattern => pattern.test(url));
    }
});