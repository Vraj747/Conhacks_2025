chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "findAlternatives") {
      searchAlternatives(request.product, sender.tab.id);
    }
    else if (request.action === "onProductPage") {
      // Set badge to indicate we're on a product page
      chrome.action.setBadgeText({
        text: "✓",
        tabId: sender.tab.id
      });
      
      chrome.action.setBadgeBackgroundColor({
        color: "#4CAF50",
        tabId: sender.tab.id
      });
      
      // Store the product info for this tab
      chrome.storage.local.set({
        [`product_${sender.tab.id}`]: request.product
      });
      
      // Fetch sustainability metrics for this product
      fetchSustainabilityMetrics(request.product, sender.tab.id);
    }
    return true;
  });
  
  async function fetchSustainabilityMetrics(product, tabId) {
    try {
      // API endpoint
      const apiUrl = 'http://127.0.0.1:8000/api/analyze';
      
      // Fetch product info
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: product.url })
      });
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      const data = await response.json();
      
      // Store the sustainability data for this tab
      chrome.storage.local.set({
        [`sustainability_${tabId}`]: data
      });
      
      // Update badge with sustainability score
      const score = data.sustainability?.score || 0;
      let badgeColor = "#F44336"; // Red for low score
      
      if (score >= 80) badgeColor = "#4CAF50"; // Green for high
      else if (score >= 60) badgeColor = "#8BC34A"; // Light green
      else if (score >= 40) badgeColor = "#FFC107"; // Yellow/amber for medium
      else if (score >= 20) badgeColor = "#FF9800"; // Orange
      
      chrome.action.setBadgeText({
        text: score.toString(),
        tabId: tabId
      });
      
      chrome.action.setBadgeBackgroundColor({
        color: badgeColor,
        tabId: tabId
      });
      
    } catch (error) {
      console.error('Error fetching sustainability metrics:', error);
      // Set badge to indicate error
      chrome.action.setBadgeText({
        text: "!",
        tabId: tabId
      });
      
      chrome.action.setBadgeBackgroundColor({
        color: "#F44336",
        tabId: tabId
      });
    }
  }
  
  async function searchAlternatives(product, tabId) {
    // This would normally use actual APIs, but for demonstration we'll simulate results
    
    // Wait a bit to simulate search
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Build sample results with more credible sources and specific product URLs
    const secondHandResults = [
      {
        title: `${product.title} (Used - Like New)`,
        price: `$${(parseFloat(product.price.replace(/[^\d.]/g, '')) * 0.6).toFixed(2)}`,
        source: "eBay",
        url: `https://www.ebay.com/itm/${Math.floor(Math.random() * 1000000000)}`,
        distance: "Ships nationwide"
      },
      {
        title: `${product.title} (Excellent Condition)`,
        price: `$${(parseFloat(product.price.replace(/[^\d.]/g, '')) * 0.65).toFixed(2)}`,
        source: "Poshmark",
        url: `https://poshmark.com/listing/${product.title.substring(0, 10).replace(/\s+/g, '-').toLowerCase()}-${Math.floor(Math.random() * 10000000)}`,
        distance: "Ships nationwide"
      },
      {
        title: `${product.title} (Refurbished)`,
        price: `$${(parseFloat(product.price.replace(/[^\d.]/g, '')) * 0.7).toFixed(2)}`,
        source: "Mercari",
        url: `https://www.mercari.com/us/item/${Math.floor(Math.random() * 100000000)}/`,
        distance: "Ships nationwide"
      }
    ];
    
    const sustainableResults = [
      {
        title: `Eco-friendly ${product.title}`,
        price: `$${(parseFloat(product.price.replace(/[^\d.]/g, '')) * 1.1).toFixed(2)}`,
        source: "EarthHero",
        url: `https://earthhero.com/products/${product.title.substring(0, 15).replace(/\s+/g, '-').toLowerCase()}`,
        ecoRating: "A+ (Recycled materials, carbon neutral shipping)"
      },
      {
        title: `Sustainable ${product.title}`,
        price: `$${(parseFloat(product.price.replace(/[^\d.]/g, '')) * 1.2).toFixed(2)}`,
        source: "Patagonia",
        url: `https://www.patagonia.com/product/${product.title.substring(0, 10).replace(/\s+/g, '-').toLowerCase()}.html`,
        ecoRating: "A (Fair trade certified, organic materials)"
      }
    ];
    
    // Send results to content script
    chrome.tabs.sendMessage(tabId, {
      action: "showAlternatives",
      secondHand: secondHandResults,
      sustainable: sustainableResults,
      originalProduct: product
    });
  }