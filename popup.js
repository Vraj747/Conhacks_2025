document.addEventListener('DOMContentLoaded', function() {
    const analyzeButton = document.getElementById('analyze-button');
    const productInfo = document.getElementById('product-info');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessage = document.getElementById('error-message');
    const alternativesContainer = document.getElementById('alternatives-container');
    const secondhandContainer = document.getElementById('secondhand-alternatives');
    const sustainableContainer = document.getElementById('sustainable-alternatives');
    
    // Hide sections initially
    productInfo.style.display = 'none';
    loadingIndicator.style.display = 'none';
    errorMessage.style.display = 'none';
    alternativesContainer.style.display = 'none';
    
    // Function to get the current tab URL
    function getCurrentTabUrl(callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            callback(tabs[0].url);
        });
    }
    
    // Function to check if URL is a product page
    function isProductPage(url) {
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
    
    // Function to display product information
    function displayProductInfo(data) {
        // Clear previous content
        productInfo.innerHTML = '';
        secondhandContainer.innerHTML = '';
        sustainableContainer.innerHTML = '';
        
        // Create product info elements
        const productTitle = document.createElement('h2');
        productTitle.textContent = data.product.title;
        productTitle.className = 'product-title';
        
        const productDetails = document.createElement('div');
        productDetails.className = 'product-details';
        
        // Add product image if available
        if (data.product.image_url) {
            const productImage = document.createElement('img');
            productImage.src = data.product.image_url;
            productImage.alt = data.product.title;
            productImage.className = 'product-image';
            productDetails.appendChild(productImage);
        }
        
        const productInfo = document.createElement('div');
        productInfo.className = 'product-info';
        
        const productPrice = document.createElement('p');
        productPrice.innerHTML = `<strong>Price:</strong> ${data.product.price}`;
        productInfo.appendChild(productPrice);
        
        // Create sustainability score display
        const scoreContainer = document.createElement('div');
        scoreContainer.className = 'sustainability-score';
        
        const scoreValue = data.product.sustainability_score;
        const scoreLevel = scoreValue >= 75 ? 'high' : (scoreValue >= 50 ? 'medium' : 'low');
        const scoreColor = scoreValue >= 75 ? '#4CAF50' : (scoreValue >= 50 ? '#FF9800' : '#F44336');
        
        scoreContainer.innerHTML = `
            <h3>Sustainability Score</h3>
            <div class="score-circle" style="background: conic-gradient(${scoreColor} ${scoreValue * 3.6}deg, #e0e0e0 ${scoreValue * 3.6}deg 360deg);">
                <span>${scoreValue}</span>
            </div>
            <p class="score-level ${scoreLevel}-score">
                ${scoreLevel.charAt(0).toUpperCase() + scoreLevel.slice(1)} Impact
            </p>
        `;
        
        // Add eco factors
        const ecoFactors = document.createElement('div');
        ecoFactors.className = 'eco-factors';
        ecoFactors.innerHTML = '<h3>Environmental Factors</h3>';
        
        const factorsList = document.createElement('ul');
        data.product.eco_factors.forEach(factor => {
            const factorItem = document.createElement('li');
            factorItem.textContent = factor;
            factorsList.appendChild(factorItem);
        });
        
        ecoFactors.appendChild(factorsList);
        
        // Assemble product info
        productDetails.appendChild(productInfo);
        productInfo.appendChild(scoreContainer);
        productInfo.appendChild(ecoFactors);
        
        // Add to DOM
        productInfo.appendChild(productTitle);
        productInfo.appendChild(productDetails);
        
        // Display secondhand alternatives
        if (data.secondhand_alternatives && data.secondhand_alternatives.length > 0) {
            const secondhandTitle = document.createElement('h3');
            secondhandTitle.textContent = 'Second-hand Alternatives';
            secondhandContainer.appendChild(secondhandTitle);
            
            displayAlternatives(data.secondhand_alternatives, secondhandContainer);
        } else {
            secondhandContainer.innerHTML = '<h3>Second-hand Alternatives</h3><p>No second-hand alternatives found.</p>';
        }
        
        // Display sustainable alternatives
        if (data.sustainable_alternatives && data.sustainable_alternatives.length > 0) {
            const sustainableTitle = document.createElement('h3');
            sustainableTitle.textContent = 'Sustainable Alternatives';
            sustainableContainer.appendChild(sustainableTitle);
            
            displayAlternatives(data.sustainable_alternatives, sustainableContainer);
        } else {
            sustainableContainer.innerHTML = '<h3>Sustainable Alternatives</h3><p>No sustainable alternatives found.</p>';
        }
        
        // Show the product info and alternatives sections
        document.getElementById('product-info').style.display = 'block';
        alternativesContainer.style.display = 'block';
    }
    
    // Function to display alternatives
    function displayAlternatives(alternatives, container) {
        alternatives.forEach(alt => {
            const altItem = document.createElement('div');
            altItem.className = 'dineed-alternative-item';
            
            // Create image element if available
            if (alt.image_url) {
                const altImage = document.createElement('img');
                altImage.src = alt.image_url;
                altImage.alt = alt.title;
                altImage.className = 'alt-image';
                altItem.appendChild(altImage);
            }
            
            // Create info container
            const altInfo = document.createElement('div');
            altInfo.className = 'alt-info';
            
            // Add title with link
            const altTitle = document.createElement('a');
            altTitle.href = alt.link || '#';
            altTitle.target = '_blank';
            altTitle.textContent = alt.title;
            altTitle.className = 'alt-title';
            altInfo.appendChild(altTitle);
            
            // Add price
            const altPrice = document.createElement('p');
            altPrice.className = 'alt-price';
            altPrice.textContent = alt.price;
            altInfo.appendChild(altPrice);
            
            // Add condition if available
            if (alt.condition) {
                const altCondition = document.createElement('p');
                altCondition.className = 'alt-condition';
                altCondition.textContent = `Condition: ${alt.condition}`;
                altInfo.appendChild(altCondition);
            }
            
            // Add source
            const altSource = document.createElement('p');
            altSource.className = 'alt-source';
            altSource.textContent = `Source: ${alt.source}`;
            altInfo.appendChild(altSource);
            
            // Add eco factors if available
            if (alt.eco_factors && alt.eco_factors.length > 0) {
                const ecoFactors = document.createElement('div');
                ecoFactors.className = 'eco-factors';
                
                const ecoList = document.createElement('ul');
                alt.eco_factors.forEach(factor => {
                    const ecoItem = document.createElement('li');
                    ecoItem.textContent = factor;
                    ecoList.appendChild(ecoItem);
                });
                
                ecoFactors.appendChild(ecoList);
                altInfo.appendChild(ecoFactors);
            }
            
            // Add info to item
            altItem.appendChild(altInfo);
            
            // Add item to container
            container.appendChild(altItem);
        });
    }
    
    // Function to analyze the current product
    function analyzeCurrentProduct() {
        getCurrentTabUrl(function(url) {
            // Check if this is a product page
            if (!isProductPage(url)) {
                errorMessage.textContent = 'This does not appear to be a supported product page. Please navigate to a product on Amazon, eBay, Walmart, Best Buy, Target, or Staples.';
                errorMessage.style.display = 'block';
                loadingIndicator.style.display = 'none';
                return;
            }
            
            // Show loading indicator
            loadingIndicator.style.display = 'block';
            productInfo.style.display = 'none';
            errorMessage.style.display = 'none';
            alternativesContainer.style.display = 'none';
            
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
                loadingIndicator.style.display = 'none';
                
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
                loadingIndicator.style.display = 'none';
                errorMessage.textContent = error.message || 'Could not analyze this product. Please make sure the backend server is running.';
                errorMessage.style.display = 'block';
                console.error('Error:', error);
            });
        });
    }
    
    // Automatically analyze when popup opens
    analyzeCurrentProduct();
    
    // Add click event for manual analysis
    analyzeButton.addEventListener('click', analyzeCurrentProduct);
}); 