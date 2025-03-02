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
     console.log("Fetching sustainability metrics for:", product);
     
     // Since we don't have a real API, we'll generate mock data
     const mockData = generateMockSustainabilityData(product);
     
     // Store the sustainability data for this tab
     chrome.storage.local.set({
       [`sustainability_${tabId}`]: mockData
     });
     
     // Update badge with sustainability score
     const score = mockData.sustainability?.score || 0;
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
     console.error('Error generating sustainability metrics:', error);
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
 
 function generateMockSustainabilityData(product) {
   // Generate a score based on product title (for demo purposes)
   let score = Math.floor(Math.random() * 100);
   
   // Determine level based on score
   let level = "Poor";
   if (score >= 80) level = "Excellent";
   else if (score >= 60) level = "Good";
   else if (score >= 40) level = "Medium";
   else if (score >= 20) level = "Below Average";
   
   // Generate some factors that affect the score
   const factors = [
     "Product materials and manufacturing",
     "Company sustainable practices",
     "Packaging efficiency",
     "Product lifetime and repairability",
     "Energy efficiency during use"
   ];
   
   return {
     product: product,
     sustainability: {
       score: score,
       level: level,
       factors: factors.slice(0, Math.floor(Math.random() * 3) + 2)
     }
   };
 }
 
 async function searchAlternatives(product, tabId) {
   try {
     console.log("Searching alternatives for:", product);
     
     // Parse price for generating alternatives
     let basePrice = 100; // Default price
     if (product.price) {
       const priceStr = product.price.replace(/[^\d.]/g, '');
       const parsedPrice = parseFloat(priceStr);
       if (!isNaN(parsedPrice)) {
         basePrice = parsedPrice;
       }
     }
     
     // Build sample results based on product info
     const secondHandResults = [
       {
         title: `${product.title ? product.title.split(' ').slice(0, 4).join(' ') : 'Product'} (Used - Like New)`,
         price: `$${(basePrice * 0.6).toFixed(2)}`,
         source: "Facebook Marketplace",
         url: "https://www.facebook.com/marketplace/",
         distance: "5 miles away"
       },
       {
         title: `${product.title ? product.title.split(' ').slice(0, 4).join(' ') : 'Product'} (Refurbished)`,
         price: `$${(basePrice * 0.7).toFixed(2)}`,
         source: "ThriftShop",
         url: "https://www.thriftshop.com/",
         distance: "12 miles away"
       }
     ];
     
     const sustainableResults = [
       {
         title: `Eco-friendly ${product.title ? product.title.split(' ').slice(0, 3).join(' ') : 'Alternative'}`,
         price: `$${(basePrice * 1.1).toFixed(2)}`,
         source: "EcoStore",
         url: "https://www.ecostore.com/",
         ecoRating: "A+ (Recycled materials, carbon neutral shipping)"
       },
       {
         title: `Sustainable ${product.title ? product.title.split(' ').slice(0, 3).join(' ') : 'Alternative'}`,
         price: `$${(basePrice * 1.2).toFixed(2)}`,
         source: "GreenTech",
         url: "https://www.greentech.com/",
         ecoRating: "A (Fair trade certified, organic materials)"
       }
     ];
     
     console.log("Sending alternatives to tab:", tabId);
     
     // Send results to content script
     chrome.tabs.sendMessage(tabId, {
       action: "showAlternatives",
       secondHand: secondHandResults,
       sustainable: sustainableResults,
       originalProduct: product
     });
   } catch (error) {
     console.error("Error generating alternatives:", error);
     
     // Send error to content script
     chrome.tabs.sendMessage(tabId, {
       action: "showAlternatives",
       error: "Failed to find alternatives",
       secondHand: [],
       sustainable: [],
       originalProduct: product
     });
   }
 }