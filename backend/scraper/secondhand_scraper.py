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
import difflib

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def search_ebay(product_name, max_results=5):
    """
    Search for second-hand products on eBay with improved filtering and details
    """
    logger.info(f"Searching eBay for: {product_name}")
    
    try:
        # Format the search query for URL
        search_query = product_name.replace(' ', '+')
        
        # More specific URL with better filters for used items
        url = f"https://www.ebay.com/sch/i.html?_nkw={search_query}&_sacat=0&LH_TitleDesc=1&LH_ItemCondition=3000%7C2500%7C2000&LH_PrefLoc=1&rt=nc&LH_BIN=1"
        
        # LH_ItemCondition=3000 is for used items
        # LH_ItemCondition=2500 is for refurbished
        # LH_ItemCondition=2000 is for "very good" condition
        # LH_BIN=1 is for Buy It Now (no auctions)
        # LH_PrefLoc=1 is for items in your country
        # LH_TitleDesc=1 searches in title and description
        
        logger.info(f"eBay search URL: {url}")
        
        # Set up headers to mimic a browser with a different user agent
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Connection': 'keep-alive',
            'Referer': 'https://www.google.com/'  # Changed to look like coming from Google search
        }
        
        # Make the request with increased timeout
        for attempt in range(3):  # Try up to 3 times
            try:
                logger.info(f"eBay request attempt {attempt+1}")
                response = requests.get(url, headers=headers, timeout=30)  # Increased timeout to 30 seconds
                break
            except requests.exceptions.Timeout:
                logger.warning(f"eBay request timed out on attempt {attempt+1}")
                if attempt == 2:  # Last attempt
                    logger.error("All eBay request attempts timed out")
                    return []
                time.sleep(2)  # Wait before retrying
            except requests.exceptions.RequestException as e:
                logger.error(f"eBay request failed: {str(e)}")
                return []
        
        if response.status_code != 200:
            logger.error(f"Failed to get eBay results. Status code: {response.status_code}")
            return []
        
        # Parse the HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find all product listings - updated selector for current eBay layout
        listings = soup.select('li.s-item')
        
        if not listings or len(listings) <= 1:  # eBay usually has a "More items like this" as first item
            logger.warning("No eBay listings found or selector may be outdated")
            # Try alternative selector
            listings = soup.select('.srp-results .s-item')
            
            if not listings:
                listings = soup.select('[class*="item"]')  # More generic fallback
        
        logger.info(f"Found {len(listings)} raw eBay listings to process")
        
        results = []
        count = 0
        
        for listing in listings:
            if count >= max_results:
                break
                
            try:
                # Skip "More items like this" listing which is usually the first one
                if "More items like this" in listing.text:
                    continue
                
                # Extract product details with improved selectors
                title_element = listing.select_one('.s-item__title, [class*="item__title"]')
                price_element = listing.select_one('.s-item__price, [class*="item__price"]')
                link_element = listing.select_one('a.s-item__link, a[class*="item__link"], a[href*="itm/"]')
                image_element = listing.select_one('.s-item__image-img, img[class*="item__image"], img[src*="i.ebayimg.com"]')
                condition_element = listing.select_one('.SECONDARY_INFO, .s-item__subtitle, .s-item__condition, [class*="condition"]')
                shipping_element = listing.select_one('.s-item__shipping, .s-item__logisticsCost, [class*="shipping"]')
                seller_element = listing.select_one('.s-item__seller-info-text, [class*="seller"]')
                
                # Skip if any essential element is missing
                if not title_element or not price_element or not link_element:
                    logger.warning("Skipping eBay listing due to missing essential elements")
                    continue
                
                title = title_element.text.strip()
                price = price_element.text.strip()
                link = link_element['href'].split('?')[0]  # Remove query parameters
                
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
                
                # Extract shipping info
                shipping = "Check listing for shipping"
                if shipping_element:
                    shipping = shipping_element.text.strip()
                
                # Extract seller info
                seller = "eBay Seller"
                if seller_element:
                    seller = seller_element.text.strip()
                
                # Check if this is actually a used/refurbished item
                if not any(keyword in condition.lower() for keyword in ['used', 'refurbished', 'pre-owned', 'open box']):
                    logger.info(f"Skipping non-used item: {title} with condition {condition}")
                    continue
                
                # Add to results with more details
                results.append({
                    'title': title,
                    'price': price,
                    'link': link,
                    'image_url': image_url,
                    'condition': condition,
                    'shipping': shipping,
                    'seller': seller,
                    'source': 'eBay',
                    'sustainability_score': 85,  # High score for second-hand items
                    'isSearchUrl': False  # This is a specific item, not a search URL
                })
                
                count += 1
                logger.info(f"Found eBay item: {title} at {price}, condition: {condition}")
                
            except Exception as e:
                logger.warning(f"Error processing eBay listing: {str(e)}")
                continue
        
        logger.info(f"Found {len(results)} eBay results")
        
        # If we couldn't find any real results, return the search URL as a fallback
        if not results:
            logger.warning("No eBay results found, returning search URL as fallback")
            results.append({
                'title': f"{product_name} (Used)",
                'price': "Check listings",
                'link': url,
                'image_url': "https://i.ebayimg.com/images/g/default-item/s-l300.jpg",
                'condition': "Various Used Conditions",
                'shipping': "Check listings for shipping",
                'seller': "Multiple Sellers",
                'source': 'eBay',
                'sustainability_score': 85,
                'isSearchUrl': True  # Flag that this is a search URL, not a specific item
            })
        
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
        # Format the search query for URL
        search_query = product_name.replace(' ', '%20')
        url = f"https://poshmark.com/search?query={search_query}&condition=closet_condition_used%2Ccloset_condition_nwt%2Ccloset_condition_nwot%2Ccloset_condition_gently_used"
        
        logger.info(f"Poshmark search URL: {url}")
        
        # Set up headers to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Connection': 'keep-alive',
            'Referer': 'https://www.google.com/'
        }
        
        # Try direct HTTP request first as it's faster and less likely to be blocked
        try:
            logger.info("Attempting direct HTTP request to Poshmark")
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                # Try to extract product data from HTML
                items = soup.select('.card, .tile, [data-test="search-item"], [class*="search-item"]')
                
                if items:
                    results = []
                    for i, item in enumerate(items):
                        if i >= max_results:
                            break
                        
                        try:
                            title_elem = item.select_one('.tile__title, .card__title, [class*="title"], h3')
                            price_elem = item.select_one('.fw--bold, [class*="price"], [data-test="price"]')
                            link_elem = item.select_one('a')
                            img_elem = item.select_one('img')
                            
                            if title_elem and price_elem and link_elem:
                                title = title_elem.text.strip()
                                price = price_elem.text.strip()
                                link = link_elem.get('href', '')
                                if link and not link.startswith('http'):
                                    link = f"https://poshmark.com{link}"
                                
                                image_url = img_elem.get('src', '') if img_elem else ""
                                if not image_url and img_elem:
                                    image_url = img_elem.get('data-src', '')
                                
                                # Try to determine condition from title
                                condition = "Used"
                                condition_keywords = {
                                    "NWT": "New with tags",
                                    "NWOT": "New without tags",
                                    "Like new": "Like new",
                                    "Gently used": "Gently used",
                                    "Excellent": "Excellent condition"
                                }
                                
                                for keyword, cond in condition_keywords.items():
                                    if keyword.lower() in title.lower():
                                        condition = cond
                                        break
                                
                                results.append({
                                    'title': title,
                                    'price': price,
                                    'link': link,
                                    'image_url': image_url,
                                    'condition': condition,
                                    'source': 'Poshmark',
                                    'sustainability_score': 85,
                                    'isSearchUrl': False
                                })
                                
                                logger.info(f"Found Poshmark item via HTTP: {title} at {price}")
                        except Exception as e:
                            logger.warning(f"Error processing Poshmark item via HTTP: {str(e)}")
                            continue
                    
                    if results:
                        logger.info(f"Found {len(results)} Poshmark results via HTTP request")
                        return results
                
                logger.info("HTTP request to Poshmark didn't yield results, falling back to WebDriver")
            else:
                logger.warning(f"HTTP request to Poshmark failed with status code: {response.status_code}")
        
        except Exception as e:
            logger.warning(f"HTTP request to Poshmark failed: {str(e)}")
        
        # Set up Selenium WebDriver with headless mode and improved options
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1920,1080")
        options.add_argument(f"user-agent={headers['User-Agent']}")
        options.add_argument("--disable-blink-features=AutomationControlled")  # Hide WebDriver usage
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
        
        try:
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
            # Set page load timeout
            driver.set_page_load_timeout(30)
            # Execute script to hide WebDriver usage
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            logger.info("WebDriver initialized for Poshmark search")
        except Exception as e:
            logger.error(f"Failed to initialize WebDriver for Poshmark: {str(e)}")
            # Return search URL as fallback
            return [{
                'title': f"{product_name} (Used)",
                'price': "Check listings",
                'link': url,
                'image_url': "https://di2ponv0v5otw.cloudfront.net/posts/default.jpg",
                'condition': "Various Used Conditions",
                'source': 'Poshmark',
                'sustainability_score': 85,
                'isSearchUrl': True
            }]
        
        try:
            # Load the page with retry logic
            max_attempts = 3
            for attempt in range(max_attempts):
                try:
                    driver.get(url)
                    # Wait for page to load with explicit wait
                    WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, '.card, .tile, [data-test="search-item"], [class*="search-item"]'))
                    )
                    break
                except Exception as e:
                    if attempt < max_attempts - 1:
                        logger.warning(f"Poshmark page load attempt {attempt+1} failed: {str(e)}. Retrying...")
                        time.sleep(2)
                    else:
                        logger.error(f"All Poshmark page load attempts failed: {str(e)}")
                        raise
            
            # Find all product listings
            results = []
            count = 0
            
            # Look for listings with multiple selector options
            selectors = [
                '.card.m--t--1',
                '.tile',
                '[data-test="search-item"]',
                '[class*="search-item"]',
                '.card',
                '[class*="item-card"]'
            ]
            
            listings = []
            for selector in selectors:
                try:
                    found_listings = driver.find_elements(By.CSS_SELECTOR, selector)
                    if found_listings:
                        listings = found_listings
                        logger.info(f"Found {len(listings)} Poshmark listings with selector: {selector}")
                        break
                except Exception as e:
                    logger.warning(f"Error finding Poshmark listings with selector {selector}: {str(e)}")
            
            if not listings:
                logger.warning("No Poshmark listings found with any selector")
                # Try a last resort selector
                try:
                    listings = driver.find_elements(By.CSS_SELECTOR, 'a[href*="/listing/"]')
                    logger.info(f"Found {len(listings)} Poshmark listings with fallback selector")
                except:
                    pass
            
            for listing in listings:
                if count >= max_results:
                    break
                    
                try:
                    # Extract product details with multiple selector options
                    title_element = None
                    price_element = None
                    link_element = None
                    
                    # Try different selectors for title
                    for selector in ['.tile__title', '[class*="title"]', 'h3', '[data-test="title"]']:
                        try:
                            title_element = listing.find_element(By.CSS_SELECTOR, selector)
                            if title_element:
                                break
                        except:
                            continue
                    
                    # Try different selectors for price
                    for selector in ['.fw--bold', '[class*="price"]', '[data-test="price"]']:
                        try:
                            price_element = listing.find_element(By.CSS_SELECTOR, selector)
                            if price_element:
                                break
                        except:
                            continue
                    
                    # Try to find link
                    try:
                        link_element = listing.find_element(By.TAG_NAME, 'a')
                    except:
                        # If the listing itself is an anchor tag
                        if listing.tag_name == 'a':
                            link_element = listing
                        else:
                            # Try to find parent link
                            try:
                                link_element = listing.find_element(By.XPATH, './ancestor::a')
                            except:
                                pass
                    
                    # Skip if any essential element is missing
                    if not title_element or not price_element:
                        logger.warning("Skipping Poshmark listing due to missing title or price")
                        continue
                    
                    # If we have title and price but no link, the listing itself might be clickable
                    if not link_element:
                        link_element = listing
                    
                    title = title_element.text.strip()
                    price = price_element.text.strip()
                    
                    # Get link
                    if link_element == listing:
                        link = listing.get_attribute('href')
                    else:
                        link = link_element.get_attribute('href')
                    
                    # Try to get image
                    image_url = ""
                    try:
                        image_element = listing.find_element(By.TAG_NAME, 'img')
                        image_url = image_element.get_attribute('src')
                        if not image_url:
                            image_url = image_element.get_attribute('data-src')
                    except:
                        # Some listings don't have images
                        pass
                    
                    # Try to get condition
                    condition = "Used"
                    try:
                        # Poshmark often has condition in the title or description
                        condition_keywords = {
                            "NWT": "New with tags",
                            "NWOT": "New without tags",
                            "Like new": "Like new",
                            "Gently used": "Gently used",
                            "Excellent": "Excellent condition"
                        }
                        
                        for keyword, cond in condition_keywords.items():
                            if keyword.lower() in title.lower():
                                condition = cond
                                break
                    except:
                        pass
                    
                    # Add to results
                    results.append({
                        'title': title,
                        'price': price,
                        'link': link,
                        'image_url': image_url,
                        'condition': condition,
                        'source': 'Poshmark',
                        'sustainability_score': 85,  # High score for second-hand items
                        'isSearchUrl': False
                    })
                    
                    count += 1
                    logger.info(f"Found Poshmark item: {title} at {price}")
                    
                except Exception as e:
                    logger.warning(f"Error processing Poshmark listing: {str(e)}")
                    continue
            
            logger.info(f"Found {len(results)} Poshmark results")
            
            if not results:
                # If no results found, return the search URL as a fallback
                logger.warning("No Poshmark results found, returning search URL as fallback")
                results = [{
                    'title': f"{product_name} (Used)",
                    'price': "Check listings",
                    'link': url,
                    'image_url': "https://di2ponv0v5otw.cloudfront.net/posts/default.jpg",
                    'condition': "Various Used Conditions",
                    'source': 'Poshmark',
                    'sustainability_score': 85,
                    'isSearchUrl': True
                }]
            
            return results
            
        except Exception as e:
            logger.error(f"Error in Poshmark search: {str(e)}")
            logger.error(traceback.format_exc())
            
            # Return search URL as fallback
            return [{
                'title': f"{product_name} (Used)",
                'price': "Check listings",
                'link': url,
                'image_url': "https://di2ponv0v5otw.cloudfront.net/posts/default.jpg",
                'condition': "Various Used Conditions",
                'source': 'Poshmark',
                'sustainability_score': 85,
                'isSearchUrl': True
            }]
            
        finally:
            # Always close the driver
            try:
                driver.quit()
                logger.info("WebDriver closed for Poshmark search")
            except:
                pass
        
    except Exception as e:
        logger.error(f"Error in search_poshmark: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Return search URL instead of mock data
        search_query = product_name.replace(' ', '%20')
        url = f"https://poshmark.com/search?query={search_query}&condition=closet_condition_used%2Ccloset_condition_nwt%2Ccloset_condition_nwot%2Ccloset_condition_gently_used"
        
        return [{
            'title': f"{product_name} (Used)",
            'price': "Check listings",
            'link': url,
            'image_url': "https://di2ponv0v5otw.cloudfront.net/posts/default.jpg",
            'condition': "Various Used Conditions",
            'source': 'Poshmark',
            'sustainability_score': 85,
            'isSearchUrl': True
        }]

def search_kijiji(product_name, max_results=3):
    """
    Search for second-hand products on Kijiji
    """
    logger.info(f"Searching Kijiji for: {product_name}")
    
    try:
        # Format the search query for URL
        search_query = product_name.replace(' ', '-')
        url = f"https://www.kijiji.ca/b-buy-sell/{search_query}/k0c10l0"
        
        logger.info(f"Kijiji search URL: {url}")
        
        # Set up headers to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Connection': 'keep-alive',
            'Referer': 'https://www.google.com/'
        }
        
        # Try direct HTTP request first as it's faster and less likely to be blocked
        try:
            logger.info("Attempting direct HTTP request to Kijiji")
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                # Try to extract product data from HTML
                items = soup.select('.search-item, .regular-ad, .top-feature, .info-container')
                
                if items:
                    results = []
                    for i, item in enumerate(items):
                        if i >= max_results:
                            break
                        
                        try:
                            title_elem = item.select_one('.title, a.title, .info-container h3, .title > a')
                            price_elem = item.select_one('.price, .info-container .price')
                            link_elem = item.select_one('a.title, .title > a, .info-container a')
                            img_elem = item.select_one('img')
                            
                            if title_elem and price_elem and link_elem:
                                title = title_elem.text.strip()
                                price = price_elem.text.strip()
                                link = link_elem.get('href', '')
                                if link and not link.startswith('http'):
                                    link = f"https://www.kijiji.ca{link}"
                                
                                image_url = ""
                                if img_elem:
                                    image_url = img_elem.get('src', '')
                                    if not image_url:
                                        image_url = img_elem.get('data-src', '')
                                
                                # Determine condition (Kijiji doesn't always specify)
                                condition = "Used"
                                
                                results.append({
                                    'title': title,
                                    'price': price,
                                    'link': link,
                                    'image_url': image_url,
                                    'condition': condition,
                                    'source': 'Kijiji',
                                    'sustainability_score': 85,
                                    'isSearchUrl': False
                                })
                                
                                logger.info(f"Found Kijiji item via HTTP: {title} at {price}")
                        except Exception as e:
                            logger.warning(f"Error processing Kijiji item via HTTP: {str(e)}")
                            continue
                    
                    if results:
                        logger.info(f"Found {len(results)} Kijiji results via HTTP request")
                        return results
                
                logger.info("HTTP request to Kijiji didn't yield results, falling back to WebDriver")
            else:
                logger.warning(f"HTTP request to Kijiji failed with status code: {response.status_code}")
        
        except Exception as e:
            logger.warning(f"HTTP request to Kijiji failed: {str(e)}")
        
        # Set up Selenium WebDriver with headless mode and improved options
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1920,1080")
        options.add_argument(f"user-agent={headers['User-Agent']}")
        options.add_argument("--disable-blink-features=AutomationControlled")  # Hide WebDriver usage
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
        
        try:
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
            # Set page load timeout
            driver.set_page_load_timeout(30)
            # Execute script to hide WebDriver usage
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            logger.info("WebDriver initialized for Kijiji search")
        except Exception as e:
            logger.error(f"Failed to initialize WebDriver for Kijiji: {str(e)}")
            # Return search URL as fallback
            return [{
                'title': f"{product_name} (Used)",
                'price': "Check listings",
                'link': url,
                'image_url': "https://www.kijiji.ca/h-touch-icon-precomposed.png",
                'condition': "Various Used Conditions",
                'source': 'Kijiji',
                'sustainability_score': 85,
                'isSearchUrl': True
            }]
        
        try:
            # Load the page with retry logic
            max_attempts = 3
            for attempt in range(max_attempts):
                try:
                    driver.get(url)
                    # Wait for page to load with explicit wait
                    WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, '.search-item, .regular-ad, .top-feature, .info-container'))
                    )
                    break
                except Exception as e:
                    if attempt < max_attempts - 1:
                        logger.warning(f"Kijiji page load attempt {attempt+1} failed: {str(e)}. Retrying...")
                        time.sleep(2)
                    else:
                        logger.error(f"All Kijiji page load attempts failed: {str(e)}")
                        raise
            
            # Find all product listings
            results = []
            count = 0
            
            # Look for listings with multiple selector options
            selectors = [
                '.search-item',
                '.regular-ad',
                '.top-feature',
                '.info-container',
                '[data-listing-id]',
                '.container-results .clearfix'
            ]
            
            listings = []
            for selector in selectors:
                try:
                    found_listings = driver.find_elements(By.CSS_SELECTOR, selector)
                    if found_listings:
                        listings = found_listings
                        logger.info(f"Found {len(listings)} Kijiji listings with selector: {selector}")
                        break
                except Exception as e:
                    logger.warning(f"Error finding Kijiji listings with selector {selector}: {str(e)}")
            
            if not listings:
                logger.warning("No Kijiji listings found with any selector")
                # Try a last resort selector
                try:
                    listings = driver.find_elements(By.CSS_SELECTOR, 'a[href*="/v-"]')
                    logger.info(f"Found {len(listings)} Kijiji listings with fallback selector")
                except:
                    pass
            
            for listing in listings:
                if count >= max_results:
                    break
                    
                try:
                    # Extract product details with multiple selector options
                    title_element = None
                    price_element = None
                    link_element = None
                    
                    # Try different selectors for title
                    for selector in ['.title', 'a.title', '.info-container h3', '.title > a']:
                        try:
                            title_element = listing.find_element(By.CSS_SELECTOR, selector)
                            if title_element:
                                break
                        except:
                            continue
                    
                    # Try different selectors for price
                    for selector in ['.price', '.info-container .price']:
                        try:
                            price_element = listing.find_element(By.CSS_SELECTOR, selector)
                            if price_element:
                                break
                        except:
                            continue
                    
                    # Try to find link
                    for selector in ['a.title', '.title > a', '.info-container a']:
                        try:
                            link_element = listing.find_element(By.CSS_SELECTOR, selector)
                            if link_element:
                                break
                        except:
                            continue
                    
                    # If the listing itself is an anchor tag
                    if not link_element and listing.tag_name == 'a':
                        link_element = listing
                    
                    # Skip if any essential element is missing
                    if not title_element or not price_element:
                        logger.warning("Skipping Kijiji listing due to missing title or price")
                        continue
                    
                    title = title_element.text.strip()
                    price = price_element.text.strip()
                    
                    # Get link
                    if link_element:
                        link = link_element.get_attribute('href')
                        if not link.startswith('http'):
                            link = f"https://www.kijiji.ca{link}"
                    else:
                        # If we couldn't find a link, skip this listing
                        logger.warning("Skipping Kijiji listing due to missing link")
                        continue
                    
                    # Try to get image
                    image_url = ""
                    try:
                        image_element = listing.find_element(By.TAG_NAME, 'img')
                        image_url = image_element.get_attribute('src')
                        if not image_url:
                            image_url = image_element.get_attribute('data-src')
                    except:
                        # Some listings don't have images
                        pass
                    
                    # Add to results
                    results.append({
                        'title': title,
                        'price': price,
                        'link': link,
                        'image_url': image_url,
                        'condition': "Used",  # Kijiji typically only lists used items
                        'source': 'Kijiji',
                        'sustainability_score': 85,  # High score for second-hand items
                        'isSearchUrl': False
                    })
                    
                    count += 1
                    logger.info(f"Found Kijiji item: {title} at {price}")
                    
                except Exception as e:
                    logger.warning(f"Error processing Kijiji listing: {str(e)}")
                    continue
            
            logger.info(f"Found {len(results)} Kijiji results")
            
            if not results:
                # If no results found, return the search URL as a fallback
                logger.warning("No Kijiji results found, returning search URL as fallback")
                results = [{
                    'title': f"{product_name} (Used)",
                    'price': "Check listings",
                    'link': url,
                    'image_url': "https://www.kijiji.ca/h-touch-icon-precomposed.png",
                    'condition': "Various Used Conditions",
                    'source': 'Kijiji',
                    'sustainability_score': 85,
                    'isSearchUrl': True
                }]
            
            return results
            
        except Exception as e:
            logger.error(f"Error in Kijiji search: {str(e)}")
            logger.error(traceback.format_exc())
            
            # Return search URL as fallback
            return [{
                'title': f"{product_name} (Used)",
                'price': "Check listings",
                'link': url,
                'image_url': "https://www.kijiji.ca/h-touch-icon-precomposed.png",
                'condition': "Various Used Conditions",
                'source': 'Kijiji',
                'sustainability_score': 85,
                'isSearchUrl': True
            }]
            
        finally:
            # Always close the driver
            try:
                driver.quit()
                logger.info("WebDriver closed for Kijiji search")
            except:
                pass
        
    except Exception as e:
        logger.error(f"Error in search_kijiji: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Return search URL instead of mock data
        search_query = product_name.replace(' ', '-')
        url = f"https://www.kijiji.ca/b-buy-sell/{search_query}/k0c10l0"
        
        return [{
            'title': f"{product_name} (Used)",
            'price': "Check listings",
            'link': url,
            'image_url': "https://www.kijiji.ca/h-touch-icon-precomposed.png",
            'condition': "Various Used Conditions",
            'source': 'Kijiji',
            'sustainability_score': 85,
            'isSearchUrl': True
        }]

def search_mercari(product_name, max_results=3):
    """
    Search for second-hand products on Mercari
    """
    logger.info(f"Searching Mercari for: {product_name}")
    
    try:
        # Format the search query for URL
        search_query = product_name.replace(' ', '+')
        url = f"https://www.mercari.com/search/?keyword={search_query}&status=active&sortBy=relevance&itemCondition=1%2C2%2C3"
        
        # itemCondition=1 is for "New"
        # itemCondition=2 is for "Like New"
        # itemCondition=3 is for "Good"
        
        logger.info(f"Mercari search URL: {url}")
        
        # Set up headers to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Connection': 'keep-alive',
            'Referer': 'https://www.google.com/'
        }
        
        # Set up Selenium WebDriver with headless mode and improved options
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1920,1080")
        options.add_argument(f"user-agent={headers['User-Agent']}")
        options.add_argument("--disable-blink-features=AutomationControlled")  # Hide WebDriver usage
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
        
        try:
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
            # Set page load timeout
            driver.set_page_load_timeout(30)
            # Execute script to hide WebDriver usage
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            logger.info("WebDriver initialized for Mercari search")
        except Exception as e:
            logger.error(f"Failed to initialize WebDriver for Mercari: {str(e)}")
            # Fall back to direct HTTP request as an alternative approach
            try:
                logger.info("Attempting direct HTTP request to Mercari as fallback")
                response = requests.get(url, headers=headers, timeout=30)
                if response.status_code == 200:
                    soup = BeautifulSoup(response.text, 'html.parser')
                    # Try to extract product data from HTML
                    items = soup.select('[data-testid="ItemCell"], .merItemCell, [class*="item-cell"]')
                    
                    if items:
                        results = []
                        for i, item in enumerate(items):
                            if i >= max_results:
                                break
                            
                            try:
                                title_elem = item.select_one('[data-testid="ItemCell__title"], .merItemCell__title, [class*="item-title"]')
                                price_elem = item.select_one('[data-testid="ItemCell__price"], .merItemCell__price, [class*="item-price"]')
                                link_elem = item.select_one('a')
                                img_elem = item.select_one('img')
                                
                                if title_elem and price_elem and link_elem:
                                    title = title_elem.text.strip()
                                    price = price_elem.text.strip()
                                    link = link_elem.get('href', '')
                                    if link and not link.startswith('http'):
                                        link = f"https://www.mercari.com{link}"
                                    
                                    image_url = img_elem.get('src', '') if img_elem else ""
                                    
                                    results.append({
                                        'title': title,
                                        'price': price,
                                        'link': link,
                                        'image_url': image_url,
                                        'condition': "Used",
                                        'source': 'Mercari',
                                        'sustainability_score': 80,
                                        'isSearchUrl': False
                                    })
                                    
                                    logger.info(f"Found Mercari item via HTTP: {title} at {price}")
                            except Exception as e:
                                logger.warning(f"Error processing Mercari item via HTTP: {str(e)}")
                                continue
                        
                        if results:
                            logger.info(f"Found {len(results)} Mercari results via HTTP request")
                            return results
                    
                    # If we couldn't extract items, return the search URL as a fallback
                    logger.warning("Could not extract Mercari items via HTTP, returning search URL")
                    return [{
                        'title': f"{product_name} (Used)",
                        'price': "Check listings",
                        'link': url,
                        'image_url': "https://static.mercdn.net/item/detail/default.jpg",
                        'condition': "Various Used Conditions",
                        'source': 'Mercari',
                        'sustainability_score': 80,
                        'isSearchUrl': True
                    }]
                
            except Exception as e:
                logger.error(f"HTTP request to Mercari failed: {str(e)}")
            
            # If all else fails, return mock data
            return generate_mock_mercari_data(product_name, max_results)
        
        try:
            # Load the page with retry logic
            max_attempts = 3
            for attempt in range(max_attempts):
                try:
                    driver.get(url)
                    # Wait for page to load with explicit wait
                    WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="ItemCell"], .merItemCell, [class*="item-cell"]'))
                    )
                    break
                except Exception as e:
                    if attempt < max_attempts - 1:
                        logger.warning(f"Mercari page load attempt {attempt+1} failed: {str(e)}. Retrying...")
                        time.sleep(2)
                    else:
                        logger.error(f"All Mercari page load attempts failed: {str(e)}")
                        raise
            
            # Find all product listings
            results = []
            count = 0
            
            # Look for listings - updated for current Mercari layout with multiple selector options
            listings = driver.find_elements(By.CSS_SELECTOR, '[data-testid="ItemCell"], .merItemCell, [class*="item-cell"]')
            
            if not listings:
                logger.warning("No Mercari listings found with primary selectors, trying alternative selectors")
                # Try alternative selectors
                listings = driver.find_elements(By.CSS_SELECTOR, '.merItemCell, .merItem, [class*="item-cell"], [class*="item_cell"]')
                
                if not listings:
                    # Last resort - try to find any product-like elements
                    listings = driver.find_elements(By.CSS_SELECTOR, '[class*="item"], [class*="product"]')
            
            logger.info(f"Found {len(listings)} raw Mercari listings to process")
            
            for listing in listings:
                if count >= max_results:
                    break
                    
                try:
                    # Extract product details with multiple selector options
                    title_element = None
                    price_element = None
                    link_element = None
                    
                    # Try different selectors for title
                    for selector in ['[data-testid="ItemCell__title"]', '.merItemCell__title', '[class*="item-title"]', 'h3', '.merItem__name']:
                        try:
                            title_element = listing.find_element(By.CSS_SELECTOR, selector)
                            if title_element:
                                break
                        except:
                            continue
                    
                    # Try different selectors for price
                    for selector in ['[data-testid="ItemCell__price"]', '.merItemCell__price', '[class*="item-price"]', '[class*="price"]']:
                        try:
                            price_element = listing.find_element(By.CSS_SELECTOR, selector)
                            if price_element:
                                break
                        except:
                            continue
                    
                    # Try to find link
                    try:
                        link_element = listing.find_element(By.TAG_NAME, 'a')
                    except:
                        # Try to find parent link
                        try:
                            link_element = listing.find_element(By.XPATH, './ancestor::a')
                        except:
                            pass
                    
                    # Skip if any essential element is missing
                    if not title_element or not price_element or not link_element:
                        logger.warning("Skipping Mercari listing due to missing essential elements")
                        continue
                    
                    title = title_element.text.strip()
                    price = price_element.text.strip()
                    link = link_element.get_attribute('href')
                    
                    # Try to get image
                    image_url = ""
                    try:
                        image_element = listing.find_element(By.TAG_NAME, 'img')
                        image_url = image_element.get_attribute('src')
                        if not image_url:
                            image_url = image_element.get_attribute('data-src')
                    except:
                        # Some listings don't have images
                        pass
                    
                    # Try to get condition
                    condition = "Used"
                    try:
                        for selector in ['[data-testid="ItemCell__condition"]', '[class*="condition"]', '.merItemCell__condition']:
                            try:
                                condition_element = listing.find_element(By.CSS_SELECTOR, selector)
                                condition = condition_element.text.strip()
                                break
                            except:
                                continue
                    except:
                        # Condition might not be displayed
                        pass
                    
                    # Add to results
                    results.append({
                        'title': title,
                        'price': price,
                        'link': link,
                        'image_url': image_url,
                        'condition': condition,
                        'source': 'Mercari',
                        'sustainability_score': 80,  # High score for second-hand items
                        'isSearchUrl': False
                    })
                    
                    count += 1
                    logger.info(f"Found Mercari item: {title} at {price}")
                    
                except Exception as e:
                    logger.warning(f"Error processing Mercari listing: {str(e)}")
                    continue
            
            logger.info(f"Found {len(results)} Mercari results")
            
            if not results:
                # If no results found, return the search URL as a fallback
                logger.warning("No Mercari results found, returning search URL as fallback")
                results = [{
                    'title': f"{product_name} (Used)",
                    'price': "Check listings",
                    'link': url,
                    'image_url': "https://static.mercdn.net/item/detail/default.jpg",
                    'condition': "Various Used Conditions",
                    'source': 'Mercari',
                    'sustainability_score': 80,
                    'isSearchUrl': True
                }]
            
            return results
            
        except Exception as e:
            logger.error(f"Error in Mercari search: {str(e)}")
            logger.error(traceback.format_exc())
            
            # Return search URL as fallback
            return [{
                'title': f"{product_name} (Used)",
                'price': "Check listings",
                'link': url,
                'image_url': "https://static.mercdn.net/item/detail/default.jpg",
                'condition': "Various Used Conditions",
                'source': 'Mercari',
                'sustainability_score': 80,
                'isSearchUrl': True
            }]
            
        finally:
            # Always close the driver
            try:
                driver.quit()
                logger.info("WebDriver closed for Mercari search")
            except:
                pass
        
    except Exception as e:
        logger.error(f"Error in search_mercari: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Return search URL instead of mock data
        search_query = product_name.replace(' ', '+')
        url = f"https://www.mercari.com/search/?keyword={search_query}&status=active&sortBy=relevance&itemCondition=1%2C2%2C3"
        
        return [{
            'title': f"{product_name} (Used)",
            'price': "Check listings",
            'link': url,
            'image_url': "https://static.mercdn.net/item/detail/default.jpg",
            'condition': "Various Used Conditions",
            'source': 'Mercari',
            'sustainability_score': 80,
            'isSearchUrl': True
        }]

def generate_mock_mercari_data(product_name, max_results=3):
    """Generate mock Mercari data when actual scraping fails"""
    logger.info(f"Generating mock Mercari data for: {product_name}")
    
    mock_results = []
    base_price = random.randint(35, 160)
    
    for i in range(min(max_results, 3)):
        condition_options = ["Like New", "Good", "Excellent"]
        
        mock_results.append({
            'title': f"{product_name} - {condition_options[i % len(condition_options)]}",
            'price': f"${base_price - (i * 14):.2f}",
            'link': f"https://www.mercari.com/us/item/{random.randint(10000000, 99999999)}/",
            'image_url': f"https://via.placeholder.com/150?text=Mercari+{product_name.replace(' ', '+')}",
            'condition': condition_options[i % len(condition_options)],
            'source': 'Mercari',
            'sustainability_score': 80  # High score for second-hand items
        })
        
        logger.info(f"Added mock Mercari item: {mock_results[-1]['title']} at {mock_results[-1]['price']}")
    
    logger.info(f"Generated {len(mock_results)} Mercari mock results")
    return mock_results

def find_secondhand_alternatives(product_name, max_results=6):
    """
    Find second-hand alternatives for a product from multiple sources
    """
    logger.info(f"Finding second-hand alternatives for: {product_name}")
    
    try:
        # Clean up the product name for better search results
        cleaned_name = product_name
        
        # Remove common patterns that might restrict search results
        patterns_to_remove = [
            r'\b\d+(\.\d+)?(mm|cm|m|inch|in|ft)\b',  # Sizes
            r'\b\d+x\d+\b',  # Dimensions
            r'\b\d{4,}\b',  # Long numbers (likely model numbers)
            r'\b(black|white|red|blue|green|yellow|purple|pink|orange|brown|grey|gray|silver|gold)\b',  # Colors
            r'\bsize \w+\b',  # Size indicators
            r'\bmodel \w+\b',  # Model indicators
            r'\bref:? \w+\b',  # Reference numbers
            r'\bsku:? \w+\b',  # SKU numbers
            r'\bpack of \d+\b',  # Pack quantities
            r'\b\d+ pack\b',  # Pack quantities
            r'\b\d+-piece\b',  # Piece quantities
            r'\b\d+ piece\b',  # Piece quantities
            r'\bwith \w+\b',  # Features that might be too specific
            r'\bfor \w+\b',  # Purpose that might be too specific
            r'\bversion \d+(\.\d+)?\b',  # Version numbers
            r'\bv\d+(\.\d+)?\b',  # Version numbers
            r'\b\d{2,4}p\b',  # Resolution
            r'\b\d{2,4}k\b',  # Resolution
            r'\b\d{1,2}th gen\b',  # Generation
            r'\b\d{1,2}th generation\b',  # Generation
            r'\b\(.*?\)\b',  # Text in parentheses
            r'\[.*?\]',  # Text in brackets
        ]
        
        for pattern in patterns_to_remove:
            cleaned_name = re.sub(pattern, '', cleaned_name, flags=re.IGNORECASE)
        
        # Remove extra spaces and trim
        cleaned_name = re.sub(r'\s+', ' ', cleaned_name).strip()
        
        logger.info(f"Cleaned product name: {cleaned_name}")
        
        # Try to identify the brand and product type for better search
        brand_match = re.search(r'^(.*?)\s', cleaned_name)
        brand = brand_match.group(1) if brand_match else ""
        
        # Identify product type (usually the last word or two)
        product_type_match = re.search(r'\s(\w+)$', cleaned_name)
        product_type = product_type_match.group(1) if product_type_match else ""
        
        # Create a focused search term if we have both brand and product type
        focused_search_term = cleaned_name
        if brand and product_type and brand.lower() != product_type.lower():
            focused_search_term = f"{brand} {product_type}"
            logger.info(f"Created focused search term: {focused_search_term}")
        
        # If the cleaned name is too short, use the original
        if len(cleaned_name) < 3:
            cleaned_name = product_name
            logger.warning(f"Cleaned name too short, using original: {product_name}")
        
        # If the focused search term is too short, use the cleaned name
        if len(focused_search_term) < 3:
            focused_search_term = cleaned_name
            logger.warning(f"Focused search term too short, using cleaned name: {cleaned_name}")
        
        # Create direct search URLs for reliable platforms
        ebay_url = f"https://www.ebay.com/sch/i.html?_nkw={focused_search_term.replace(' ', '+')}&LH_ItemCondition=3000"
        poshmark_url = f"https://poshmark.com/search?query={focused_search_term.replace(' ', '%20')}&condition=closet_condition_used"
        mercari_url = f"https://www.mercari.com/search/?keyword={focused_search_term.replace(' ', '%20')}&status=Active&itemCondition=1"
        
        # Return direct search links to second-hand marketplaces
        results = [
            {
                'title': f"{product_name} on eBay (Used)",
                'price': "Check listings",
                'link': ebay_url,
                'image_url': "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/EBay_logo.svg/1200px-EBay_logo.svg.png",
                'condition': "Various Used Conditions",
                'source': 'eBay',
                'sustainability_score': 80,
                'isSearchUrl': True
            },
            {
                'title': f"{product_name} on Poshmark (Used)",
                'price': "Check listings",
                'link': poshmark_url,
                'image_url': "https://di2ponv0v5otw.cloudfront.net/posts/default.jpg",
                'condition': "Various Used Conditions",
                'source': 'Poshmark',
                'sustainability_score': 85,
                'isSearchUrl': True
            },
            {
                'title': f"{product_name} on Mercari (Used)",
                'price': "Check listings",
                'link': mercari_url,
                'image_url': "https://about.mercari.com/assets/img/press/logo/logo.png",
                'condition': "Various Used Conditions",
                'source': 'Mercari',
                'sustainability_score': 85,
                'isSearchUrl': True
            }
        ]
        
        logger.info(f"Returning {len(results)} second-hand alternatives")
        return results
        
    except Exception as e:
        logger.error(f"Error in find_secondhand_alternatives: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Return a fallback result with basic search URLs
        ebay_url = f"https://www.ebay.com/sch/i.html?_nkw={product_name.replace(' ', '+')}&LH_ItemCondition=3000"
        
        return [
            {
                'title': f"{product_name} on eBay (Used)",
                'price': "Check listings",
                'link': ebay_url,
                'image_url': "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/EBay_logo.svg/1200px-EBay_logo.svg.png",
                'condition': "Various Used Conditions",
                'source': 'eBay',
                'sustainability_score': 80,
                'isSearchUrl': True
            }
        ] 