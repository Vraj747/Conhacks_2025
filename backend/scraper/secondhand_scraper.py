import requests
from bs4 import BeautifulSoup
import re
import logging
import traceback
import time
import random
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def search_ebay(product_name, max_results=5):
    """
    Search for second-hand products on eBay
    """
    logger.info(f"Searching eBay for: {product_name}")
    
    try:
        # Format the search query for URL
        search_query = product_name.replace(' ', '+')
        url = f"https://www.ebay.com/sch/i.html?_nkw={search_query}&_sacat=0&LH_ItemCondition=3000&LH_PrefLoc=1"
        
        # Add used condition filter
        url += "&LH_ItemCondition=3000"  # 3000 is the code for used items
        
        logger.info(f"eBay search URL: {url}")
        
        # Set up headers to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Connection': 'keep-alive',
            'Referer': 'https://www.ebay.com/'
        }
        
        # Make the request
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            logger.error(f"Failed to get eBay results. Status code: {response.status_code}")
            return []
        
        # Parse the HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find all product listings
        listings = soup.select('li.s-item')
        
        results = []
        count = 0
        
        for listing in listings:
            if count >= max_results:
                break
                
            try:
                # Skip "More items like this" listing which is usually the first one
                if "More items like this" in listing.text:
                    continue
                
                # Extract product details
                title_element = listing.select_one('.s-item__title')
                price_element = listing.select_one('.s-item__price')
                link_element = listing.select_one('a.s-item__link')
                image_element = listing.select_one('.s-item__image-img')
                condition_element = listing.select_one('.SECONDARY_INFO')
                
                # Skip if any essential element is missing
                if not title_element or not price_element or not link_element:
                    continue
                
                title = title_element.text.strip()
                price = price_element.text.strip()
                link = link_element['href']
                
                # Extract image URL
                image_url = ""
                if image_element:
                    image_url = image_element.get('src', '')
                    # Sometimes eBay uses data-src for lazy loading
                    if not image_url or image_url.endswith('s-l140.webp'):
                        image_url = image_element.get('data-src', '')
                
                # Extract condition
                condition = "Used"
                if condition_element:
                    condition = condition_element.text.strip()
                
                # Add to results
                results.append({
                    'title': title,
                    'price': price,
                    'link': link,
                    'image_url': image_url,
                    'condition': condition,
                    'source': 'eBay'
                })
                
                count += 1
                logger.info(f"Found eBay item: {title} at {price}")
                
            except Exception as e:
                logger.warning(f"Error processing eBay listing: {str(e)}")
                continue
        
        logger.info(f"Found {len(results)} eBay results")
        return results
        
    except Exception as e:
        logger.error(f"Error in search_ebay: {str(e)}")
        logger.error(traceback.format_exc())
        return []

def search_facebook_marketplace(product_name, max_results=3):
    """
    Search for second-hand products on Facebook Marketplace
    Note: This is a simplified version as Facebook Marketplace requires authentication
    """
    logger.info(f"Searching Facebook Marketplace for: {product_name}")
    
    try:
        # For demonstration purposes, we'll return mock data
        # In a real implementation, you would need to use Selenium with authentication
        
        # Mock data based on the product name
        mock_results = []
        
        # Generate some random prices
        base_price = random.randint(50, 200)
        
        for i in range(min(max_results, 3)):
            condition_options = ["Used - Like New", "Used - Good", "Used - Fair"]
            
            mock_results.append({
                'title': f"{product_name} - Used Item {i+1}",
                'price': f"${base_price - (i * 10):.2f}",
                'link': "https://www.facebook.com/marketplace/item/123456789/",  # Add item ID to make it specific
                'image_url': f"https://via.placeholder.com/150?text=FB+{product_name.replace(' ', '+')}",
                'condition': random.choice(condition_options),
                'source': 'Facebook Marketplace'
            })
            
            logger.info(f"Added mock Facebook Marketplace item: {mock_results[-1]['title']} at {mock_results[-1]['price']}")
        
        logger.info(f"Generated {len(mock_results)} Facebook Marketplace mock results")
        return mock_results
        
    except Exception as e:
        logger.error(f"Error in search_facebook_marketplace: {str(e)}")
        logger.error(traceback.format_exc())
        return []

def search_poshmark(product_name, max_results=3):
    """
    Search for second-hand products on Poshmark
    """
    logger.info(f"Searching Poshmark for: {product_name}")
    
    try:
        # For demonstration purposes, we'll return mock data
        # In a real implementation, you would use requests or Selenium
        
        # Mock data based on the product name
        mock_results = []
        
        # Generate some random prices
        base_price = random.randint(30, 150)
        
        for i in range(min(max_results, 3)):
            condition_options = ["Like New", "Good", "Excellent"]
            
            mock_results.append({
                'title': f"{product_name} - {condition_options[i % len(condition_options)]}",
                'price': f"${base_price - (i * 15):.2f}",
                'link': f"https://poshmark.com/listing/product-{i+1}-{random.randint(10000, 99999)}",
                'image_url': f"https://via.placeholder.com/150?text=Poshmark+{product_name.replace(' ', '+')}",
                'condition': condition_options[i % len(condition_options)],
                'source': 'Poshmark'
            })
            
            logger.info(f"Added mock Poshmark item: {mock_results[-1]['title']} at {mock_results[-1]['price']}")
        
        logger.info(f"Generated {len(mock_results)} Poshmark mock results")
        return mock_results
        
    except Exception as e:
        logger.error(f"Error in search_poshmark: {str(e)}")
        logger.error(traceback.format_exc())
        return []

def search_kijiji(product_name, max_results=3):
    """
    Search for second-hand products on Kijiji (popular in Canada)
    """
    logger.info(f"Searching Kijiji for: {product_name}")
    
    try:
        # For demonstration purposes, we'll return mock data
        # In a real implementation, you would use requests or Selenium
        
        # Mock data based on the product name
        mock_results = []
        
        # Generate some random prices
        base_price = random.randint(40, 180)
        
        for i in range(min(max_results, 3)):
            condition_options = ["Like New", "Barely Used", "Good Condition"]
            
            mock_results.append({
                'title': f"{product_name} - {condition_options[i % len(condition_options)]}",
                'price': f"${base_price - (i * 12):.2f}",
                'link': f"https://www.kijiji.ca/v-view-details.html?adId={random.randint(1000000, 9999999)}",
                'image_url': f"https://via.placeholder.com/150?text=Kijiji+{product_name.replace(' ', '+')}",
                'condition': condition_options[i % len(condition_options)],
                'source': 'Kijiji'
            })
            
            logger.info(f"Added mock Kijiji item: {mock_results[-1]['title']} at {mock_results[-1]['price']}")
        
        logger.info(f"Generated {len(mock_results)} Kijiji mock results")
        return mock_results
        
    except Exception as e:
        logger.error(f"Error in search_kijiji: {str(e)}")
        logger.error(traceback.format_exc())
        return []

def search_mercari(product_name, max_results=3):
    """
    Search for second-hand products on Mercari
    """
    logger.info(f"Searching Mercari for: {product_name}")
    
    try:
        # For demonstration purposes, we'll return mock data
        # In a real implementation, you would use requests or Selenium
        
        # Mock data based on the product name
        mock_results = []
        
        # Generate some random prices
        base_price = random.randint(35, 160)
        
        for i in range(min(max_results, 3)):
            condition_options = ["Like New", "Good", "Excellent"]
            
            mock_results.append({
                'title': f"{product_name} - {condition_options[i % len(condition_options)]}",
                'price': f"${base_price - (i * 14):.2f}",
                'link': f"https://www.mercari.com/us/item/{random.randint(10000000, 99999999)}/",
                'image_url': f"https://via.placeholder.com/150?text=Mercari+{product_name.replace(' ', '+')}",
                'condition': condition_options[i % len(condition_options)],
                'source': 'Mercari'
            })
            
            logger.info(f"Added mock Mercari item: {mock_results[-1]['title']} at {mock_results[-1]['price']}")
        
        logger.info(f"Generated {len(mock_results)} Mercari mock results")
        return mock_results
        
    except Exception as e:
        logger.error(f"Error in search_mercari: {str(e)}")
        logger.error(traceback.format_exc())
        return []

def find_secondhand_alternatives(product_data, max_results=8):
    """
    Find second-hand alternatives for a product from multiple sources
    """
    logger.info(f"Finding secondhand alternatives for: {product_data.get('title', 'Unknown Product')}")
    
    try:
        # Extract product name from the data
        product_name = product_data.get('title', '')
        if not product_name:
            logger.warning("No product title provided for secondhand search")
            return []
            
        # Clean up the product name for better search results
        # Remove specific model numbers, sizes, colors that might be too restrictive
        cleaned_name = re.sub(r'\(.*?\)', '', product_name)  # Remove anything in parentheses
        cleaned_name = re.sub(r'\[.*?\]', '', cleaned_name)  # Remove anything in brackets
        cleaned_name = re.sub(r'\d+(\.\d+)?[Ii][Nn][Cc][Hh]', '', cleaned_name)  # Remove inch specifications
        cleaned_name = re.sub(r'\d+(\.\d+)?[Cc][Mm]', '', cleaned_name)  # Remove cm specifications
        cleaned_name = re.sub(r'\b\d{4,}\b', '', cleaned_name)  # Remove long numbers (likely model numbers)
        
        # Get the first 3-5 words which usually contain the main product description
        words = cleaned_name.split()
        if len(words) > 5:
            search_term = ' '.join(words[:5])
        else:
            search_term = cleaned_name
            
        search_term = search_term.strip()
        logger.info(f"Cleaned search term: {search_term}")
        
        # If we have a brand, add it to improve search results
        brand = product_data.get('brand', '')
        if brand and brand.lower() not in search_term.lower():
            search_term = f"{brand} {search_term}"
            logger.info(f"Added brand to search term: {search_term}")
        
        # Search on different platforms - removed Craigslist, added more credible sources
        ebay_results = search_ebay(search_term, max_results=max(2, max_results//4))
        poshmark_results = search_poshmark(search_term, max_results=max(1, max_results//4))
        mercari_results = search_mercari(search_term, max_results=max(1, max_results//4))
        kijiji_results = search_kijiji(search_term, max_results=max(1, max_results//4))
        
        # Combine results from all credible sources
        all_results = ebay_results + poshmark_results + mercari_results + kijiji_results
        
        # Sort by price (assuming price strings start with currency symbol)
        def extract_price(item):
            price_str = item.get('price', '$0')
            try:
                # Extract numeric value from price string
                price_value = float(re.sub(r'[^\d.]', '', price_str))
                return price_value
            except:
                return 0
                
        all_results.sort(key=extract_price)
        
        # Limit to max_results
        limited_results = all_results[:max_results]
        
        logger.info(f"Found {len(limited_results)} total secondhand alternatives")
        return limited_results
        
    except Exception as e:
        logger.error(f"Error in find_secondhand_alternatives: {str(e)}")
        logger.error(traceback.format_exc())
        return [] 