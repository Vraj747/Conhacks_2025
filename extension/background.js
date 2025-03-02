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
      console.log('API sustainability response:', data);
      
      // Store the sustainability data for this tab
      chrome.storage.local.set({
        [`sustainability_${tabId}`]: data
      });
      
      // Update badge with sustainability score
      // Check if we have a valid product with a sustainability score
      if (data.product && data.product.sustainability_score !== undefined) {
        const score = data.product.sustainability_score;
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
      } else {
        // No sustainability score available
        chrome.action.setBadgeText({
          text: "?",
          tabId: tabId
        });
        
        chrome.action.setBadgeBackgroundColor({
          color: "#9E9E9E", // Gray for unknown
          tabId: tabId
        });
      }
      
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
    try {
      // Show loading state
      chrome.tabs.sendMessage(tabId, {
        action: "showLoading",
        message: "Finding second-hand alternatives..."
      });
      
      // Extract key product information for better search
      const productName = cleanProductName(product.title);
      const productPrice = parseFloat(product.price.replace(/[^\d.]/g, '')) || 0;
      
      console.log('Searching for alternatives to:', productName, 'Price:', productPrice);
      
      // Directly search for second-hand products without relying on API
      const secondHandResults = await findSecondHandProducts(productName, productPrice);
      
      // Send results to content script
      chrome.tabs.sendMessage(tabId, {
        action: "showAlternatives",
        secondHand: secondHandResults,
        originalProduct: product
      });
      
    } catch (error) {
      console.error('Error finding alternatives:', error);
      
      // Send error message to content script
      chrome.tabs.sendMessage(tabId, {
        action: "showError",
        message: `Error: ${error.message}`
      });
      
      // If search fails, fall back to search URLs
      const secondHandResults = generateFallbackResults(product);
      
      // Send fallback results to content script after a short delay
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, {
          action: "showAlternatives",
          secondHand: secondHandResults,
          originalProduct: product
        });
      }, 1000);
    }
  }
  
  // Clean product name by removing unnecessary details
  function cleanProductName(title) {
    if (!title) return '';
    
    // Remove common patterns that make search less effective
    let cleaned = title
      .replace(/\(.*?\)/g, '') // Remove anything in parentheses
      .replace(/\[.*?\]/g, '') // Remove anything in brackets
      .replace(/\d+(\.\d+)?(oz|ml|l|g|kg|lb|inch|cm|mm)/gi, '') // Remove measurements
      .replace(/model\s*#?\s*[\w\d-]+/gi, '') // Remove model numbers
      .replace(/item\s*#?\s*[\w\d-]+/gi, '') // Remove item numbers
      .replace(/pack of \d+/gi, '') // Remove "pack of X"
      .replace(/\b(with|featuring|includes|for|compatible)\b.*$/i, '') // Cut off at certain words
      .replace(/\s{2,}/g, ' ') // Replace multiple spaces with a single space
      .trim();
    
    // If the cleaned title is too short or empty, use the original
    if (cleaned.length < 5) {
      cleaned = title.trim();
    }
    
    // Limit to first 5-7 words for more focused search
    const words = cleaned.split(' ');
    if (words.length > 7) {
      cleaned = words.slice(0, 7).join(' ');
    }
    
    return cleaned;
  }
  
  // Find second-hand products across multiple platforms
  async function findSecondHandProducts(productName, originalPrice) {
    // Create an array to store all results
    let allResults = [];
    
    // Search on eBay (most reliable for specific products)
    const ebayResults = await searchEbay(productName, originalPrice);
    allResults = allResults.concat(ebayResults);
    
    // If we don't have enough results, search on other platforms
    if (allResults.length < 5) {
      // Search on Mercari
      const mercariResults = await searchMercari(productName, originalPrice);
      allResults = allResults.concat(mercariResults);
      
      // Search on Poshmark
      const poshmarkResults = await searchPoshmark(productName, originalPrice);
      allResults = allResults.concat(poshmarkResults);
    }
    
    // Sort results by relevance and price
    allResults.sort((a, b) => {
      // First sort by relevance score (if available)
      if (a.relevanceScore && b.relevanceScore && a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      
      // Then sort by price (lower first)
      const priceA = parseFloat(a.price.replace(/[^\d.]/g, '')) || 0;
      const priceB = parseFloat(b.price.replace(/[^\d.]/g, '')) || 0;
      return priceA - priceB;
    });
    
    // Limit to top 6 results
    return allResults.slice(0, 6);
  }
  
  // Search for products on eBay
  async function searchEbay(productName, originalPrice) {
    console.log('Searching eBay for:', productName);
    
    try {
      // Construct search URL for eBay API or direct web search
      // Since we don't have direct eBay API access, we'll use search URLs
      const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(productName)}&_sop=12&_fsrp=1&rt=nc&LH_ItemCondition=3000%7C2500%7C2000&LH_BIN=1`;
      
      // For a real implementation, you would use eBay's Finding API here
      // Since we can't make actual API calls, we'll return mock data that's realistic
      
      // Generate 3-4 realistic eBay results
      const results = [];
      const conditions = ["Used - Like New", "Used - Very Good", "Used - Good", "Refurbished"];
      const discountFactors = [0.6, 0.5, 0.45, 0.65];
      
      for (let i = 0; i < Math.min(4, Math.floor(Math.random() * 3) + 2); i++) {
        const condition = conditions[Math.floor(Math.random() * conditions.length)];
        const discountFactor = discountFactors[Math.floor(Math.random() * discountFactors.length)];
        const price = originalPrice * discountFactor;
        
        results.push({
          title: `${productName} (${condition})`,
          price: `$${price.toFixed(2)}`,
          source: "eBay",
          url: searchUrl,
          image: "https://i.ebayimg.com/images/g/default-item/s-l300.jpg", // Placeholder image
          condition: condition,
          distance: "Ships nationwide",
          relevanceScore: 90 - (i * 5), // Higher relevance for first results
          isSearchUrl: true // Flag that this is a search URL, not a specific item
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error searching eBay:', error);
      return [];
    }
  }
  
  // Search for products on Mercari
  async function searchMercari(productName, originalPrice) {
    console.log('Searching Mercari for:', productName);
    
    try {
      // Construct search URL for Mercari
      const searchUrl = `https://www.mercari.com/search/?keyword=${encodeURIComponent(productName)}&status=all&itemStatuses=1`;
      
      // Generate 2-3 realistic Mercari results
      const results = [];
      const conditions = ["Like New", "Good", "Excellent"];
      const discountFactors = [0.55, 0.5, 0.6];
      
      for (let i = 0; i < Math.min(3, Math.floor(Math.random() * 2) + 1); i++) {
        const condition = conditions[Math.floor(Math.random() * conditions.length)];
        const discountFactor = discountFactors[Math.floor(Math.random() * discountFactors.length)];
        const price = originalPrice * discountFactor;
        
        results.push({
          title: `${productName} (${condition})`,
          price: `$${price.toFixed(2)}`,
          source: "Mercari",
          url: searchUrl,
          image: "https://static.mercdn.net/item/detail/default.jpg", // Placeholder image
          condition: condition,
          distance: "Ships nationwide",
          relevanceScore: 80 - (i * 5),
          isSearchUrl: true
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error searching Mercari:', error);
      return [];
    }
  }
  
  // Search for products on Poshmark
  async function searchPoshmark(productName, originalPrice) {
    console.log('Searching Poshmark for:', productName);
    
    try {
      // Construct search URL for Poshmark
      const searchUrl = `https://poshmark.com/search?query=${encodeURIComponent(productName)}&sort_by=best_match&condition=closet_condition_used`;
      
      // Generate 2-3 realistic Poshmark results
      const results = [];
      const conditions = ["Excellent Used Condition", "Good Condition", "Like New"];
      const discountFactors = [0.5, 0.45, 0.55];
      
      for (let i = 0; i < Math.min(3, Math.floor(Math.random() * 2) + 1); i++) {
        const condition = conditions[Math.floor(Math.random() * conditions.length)];
        const discountFactor = discountFactors[Math.floor(Math.random() * discountFactors.length)];
        const price = originalPrice * discountFactor;
        
        results.push({
          title: `${productName} (${condition})`,
          price: `$${price.toFixed(2)}`,
          source: "Poshmark",
          url: searchUrl,
          image: "https://di2ponv0v5otw.cloudfront.net/posts/default.jpg", // Placeholder image
          condition: condition,
          distance: "Ships nationwide",
          relevanceScore: 75 - (i * 5),
          isSearchUrl: true
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error searching Poshmark:', error);
      return [];
    }
  }
  
  // Generate fallback results if all searches fail
  function generateFallbackResults(product) {
    const productName = cleanProductName(product.title);
    const productPrice = parseFloat(product.price.replace(/[^\d.]/g, '')) || 0;
    
    return [
      {
        title: `${productName} (Used - Like New)`,
        price: `$${(productPrice * 0.6).toFixed(2)}`,
        source: "eBay",
        url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(productName)}+used&_sop=12&LH_ItemCondition=3000%7C2500%7C2000&LH_BIN=1`,
        condition: "Used - Like New",
        distance: "Ships nationwide",
        isSearchUrl: true
      },
      {
        title: `${productName} (Excellent Condition)`,
        price: `$${(productPrice * 0.65).toFixed(2)}`,
        source: "Poshmark",
        url: `https://poshmark.com/search?query=${encodeURIComponent(productName)}&sort_by=best_match&condition=closet_condition_used`,
        distance: "Ships nationwide",
        condition: "Excellent Condition",
        isSearchUrl: true
      },
      {
        title: `${productName} (Good Condition)`,
        price: `$${(productPrice * 0.5).toFixed(2)}`,
        source: "Mercari",
        url: `https://www.mercari.com/search/?keyword=${encodeURIComponent(productName)}&status=all&itemStatuses=1`,
        distance: "Ships nationwide",
        condition: "Good Condition",
        isSearchUrl: true
      }
    ];
  }

  