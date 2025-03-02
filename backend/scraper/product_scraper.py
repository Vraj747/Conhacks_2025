from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import logging
import traceback
import re
import time

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def scrape_product_data(url):
    """
    Scrape product data from various e-commerce websites.
    Currently supports Amazon, eBay, Walmart, and Best Buy.
    """
    # Set up Selenium WebDriver with headless mode
    options = Options()
    options.add_argument("--headless")  # Run in the background
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-infobars")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-notifications")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36")

    # Install and start Chrome WebDriver
    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        logger.info(f"WebDriver initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing WebDriver: {str(e)}")
        return {"error": f"Failed to initialize WebDriver: {str(e)}"}

    try:
        # Load the page
        logger.info(f"Loading URL: {url}")
        driver.get(url)
        time.sleep(3)  # Wait for page to load
        
        # Determine which website we're scraping
        if "amazon." in url:
            logger.info("Detected Amazon product page")
            product_data = scrape_amazon(driver)
        elif "ebay.com" in url:
            logger.info("Detected eBay product page")
            product_data = scrape_ebay(driver)
        elif "walmart." in url:
            logger.info("Detected Walmart product page")
            product_data = scrape_walmart(driver)
        elif "bestbuy." in url:
            logger.info("Detected Best Buy product page")
            product_data = scrape_bestbuy(driver)
        else:
            logger.warning(f"Unsupported website: {url}")
            driver.quit()
            logger.info("WebDriver closed successfully")
            raise ValueError("Unsupported website. Currently supports Amazon, eBay, Walmart, and Best Buy.")
        
        # Add the URL to the product data
        product_data["url"] = url
        
        # Log the extracted data
        logger.info(f"Extracted product data: {product_data}")
        
        return product_data

    except Exception as e:
        logger.error(f"Error scraping product data: {str(e)}")
        logger.error(traceback.format_exc())
        return {"error": str(e)}
    
    finally:
        # Always close the driver
        try:
            driver.quit()
            logger.info("WebDriver closed successfully")
        except:
            pass

def scrape_amazon(driver):
    """Scrape product data from Amazon"""
    wait = WebDriverWait(driver, 5)
    product_data = {}
    
    try:
        # Extract Title
        try:
            title_element = wait.until(EC.presence_of_element_located((By.ID, "productTitle")))
            product_data["title"] = title_element.text.strip()
            logger.info(f"Extracted title: {product_data['title']}")
        except Exception as e:
            logger.warning(f"Failed to extract title: {str(e)}")
            product_data["title"] = "Unknown Product"

        # Extract Price
        try:
            # Try different price selectors
            price_selectors = [
                "span.a-price .a-offscreen",
                "#priceblock_ourprice",
                "#priceblock_dealprice",
                ".a-price .a-offscreen",
                ".a-price"
            ]
            
            for selector in price_selectors:
                try:
                    price_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["price"] = price_element.text.strip()
                    if not product_data["price"] and selector == ".a-price .a-offscreen":
                        product_data["price"] = price_element.get_attribute("innerHTML").strip()
                    
                    if product_data["price"]:
                        logger.info(f"Extracted price: {product_data['price']}")
                        break
                except:
                    continue
            
            if "price" not in product_data or not product_data["price"]:
                product_data["price"] = "$0.00"
                logger.warning("Could not extract price, using default")
        except Exception as e:
            logger.warning(f"Failed to extract price: {str(e)}")
            product_data["price"] = "$0.00"

        # Extract Image URL
        try:
            image_selectors = ["#landingImage", "#imgBlkFront", ".a-dynamic-image"]
            
            for selector in image_selectors:
                try:
                    image_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["image_url"] = image_element.get_attribute("src")
                    if product_data["image_url"]:
                        logger.info(f"Extracted image URL: {product_data['image_url']}")
                        break
                except:
                    continue
        except Exception as e:
            logger.warning(f"Failed to extract image URL: {str(e)}")
            product_data["image_url"] = ""

        # Extract Ratings
        try:
            rating_selectors = [".a-icon-alt", "#acrPopover"]
            
            for selector in rating_selectors:
                try:
                    rating_element = driver.find_element(By.CSS_SELECTOR, selector)
                    rating_text = rating_element.get_attribute("title") or rating_element.text
                    if rating_text:
                        product_data["rating"] = rating_text.strip()
                        logger.info(f"Extracted rating: {product_data['rating']}")
                        break
                except:
                    continue
        except Exception as e:
            logger.warning(f"Failed to extract rating: {str(e)}")
            product_data["rating"] = ""

        # Extract Brand Name
        try:
            brand_selectors = ["#bylineInfo", ".a-link-normal.contributorNameID"]
            
            for selector in brand_selectors:
                try:
                    brand_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["brand"] = brand_element.text.strip()
                    if product_data["brand"]:
                        # Clean up brand text
                        product_data["brand"] = re.sub(r'^(Brand|Visit the|Store|by):\s*', '', product_data["brand"])
                        logger.info(f"Extracted brand: {product_data['brand']}")
                        break
                except:
                    continue
                    
            if "brand" not in product_data or not product_data["brand"]:
                # Try to extract brand from title
                if "title" in product_data and product_data["title"]:
                    title_parts = product_data["title"].split()
                    if len(title_parts) > 0:
                        product_data["brand"] = title_parts[0]
                        logger.info(f"Extracted brand from title: {product_data['brand']}")
        except Exception as e:
            logger.warning(f"Failed to extract brand: {str(e)}")
            product_data["brand"] = ""

        # Extract Product Description
        try:
            description_selectors = ["#feature-bullets", "#productDescription", ".a-expander-content"]
            
            for selector in description_selectors:
                try:
                    description_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["description"] = description_element.text.strip()
                    if product_data["description"]:
                        logger.info(f"Extracted description (first 50 chars): {product_data['description'][:50]}...")
                        break
                except:
                    continue
        except Exception as e:
            logger.warning(f"Failed to extract description: {str(e)}")
            product_data["description"] = ""

        return product_data

    except Exception as e:
        logger.error(f"Error in scrape_amazon: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "title": "Unknown Product",
            "price": "$0.00",
            "image_url": "",
            "rating": "",
            "brand": "",
            "description": ""
        }

def scrape_ebay(driver):
    """Scrape product data from eBay"""
    wait = WebDriverWait(driver, 5)
    product_data = {}
    
    try:
        # Extract Title
        try:
            title_selectors = ["#itemTitle", ".x-item-title__mainTitle .ux-textspans"]
            
            for selector in title_selectors:
                try:
                    title_element = driver.find_element(By.CSS_SELECTOR, selector)
                    title_text = title_element.text.strip()
                    # Remove "Details about" prefix if present
                    title_text = re.sub(r'^Details about\s*', '', title_text)
                    product_data["title"] = title_text
                    if product_data["title"]:
                        logger.info(f"Extracted title: {product_data['title']}")
                        break
                except:
                    continue
        except Exception as e:
            logger.warning(f"Failed to extract title: {str(e)}")
            product_data["title"] = "Unknown Product"

        # Extract Price
        try:
            price_selectors = ["#prcIsum", ".x-price-primary .ux-textspans"]
            
            for selector in price_selectors:
                try:
                    price_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["price"] = price_element.text.strip()
                    if product_data["price"]:
                        logger.info(f"Extracted price: {product_data['price']}")
                        break
                except:
                    continue
        except Exception as e:
            logger.warning(f"Failed to extract price: {str(e)}")
            product_data["price"] = "$0.00"

        # Extract Image URL
        try:
            image_selectors = ["#icImg", ".ux-image-carousel-item img"]
            
            for selector in image_selectors:
                try:
                    image_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["image_url"] = image_element.get_attribute("src")
                    if product_data["image_url"]:
                        logger.info(f"Extracted image URL: {product_data['image_url']}")
                        break
                except:
                    continue
        except Exception as e:
            logger.warning(f"Failed to extract image URL: {str(e)}")
            product_data["image_url"] = ""

        # Extract Brand
        try:
            # eBay often has brand in item specifics
            brand_selectors = [".ux-labels-values__values:contains('Brand')", "span:contains('Brand')"]
            
            for selector in brand_selectors:
                try:
                    brand_row = driver.find_element(By.XPATH, f"//div[contains(text(), 'Brand')]/following-sibling::div")
                    product_data["brand"] = brand_row.text.strip()
                    if product_data["brand"]:
                        logger.info(f"Extracted brand: {product_data['brand']}")
                        break
                except:
                    continue
                    
            if "brand" not in product_data or not product_data["brand"]:
                # Try to extract brand from title
                if "title" in product_data and product_data["title"]:
                    title_parts = product_data["title"].split()
                    if len(title_parts) > 0:
                        product_data["brand"] = title_parts[0]
                        logger.info(f"Extracted brand from title: {product_data['brand']}")
        except Exception as e:
            logger.warning(f"Failed to extract brand: {str(e)}")
            product_data["brand"] = ""

        # Extract Description
        try:
            description_selectors = ["#desc", ".ux-layout-section__item--table-view"]
            
            for selector in description_selectors:
                try:
                    description_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["description"] = description_element.text.strip()
                    if product_data["description"]:
                        logger.info(f"Extracted description (first 50 chars): {product_data['description'][:50]}...")
                        break
                except:
                    continue
        except Exception as e:
            logger.warning(f"Failed to extract description: {str(e)}")
            product_data["description"] = ""

        return product_data

    except Exception as e:
        logger.error(f"Error in scrape_ebay: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "title": "Unknown Product",
            "price": "$0.00",
            "image_url": "",
            "rating": "",
            "brand": "",
            "description": ""
        }

def scrape_walmart(driver):
    """Scrape product data from Walmart"""
    wait = WebDriverWait(driver, 5)
    product_data = {}
    
    try:
        # Extract Title
        try:
            title_selectors = ["h1.prod-ProductTitle", ".prod-ProductTitle"]
            
            for selector in title_selectors:
                try:
                    title_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["title"] = title_element.text.strip()
                    if product_data["title"]:
                        logger.info(f"Extracted title: {product_data['title']}")
                        break
                except:
                    continue
        except Exception as e:
            logger.warning(f"Failed to extract title: {str(e)}")
            product_data["title"] = "Unknown Product"

        # Extract Price
        try:
            price_selectors = [".prod-PriceSection .price-characteristic", ".price-characteristic"]
            
            for selector in price_selectors:
                try:
                    price_element = driver.find_element(By.CSS_SELECTOR, selector)
                    price_whole = price_element.get_attribute("content") or price_element.text.strip()
                    
                    # Try to get cents
                    try:
                        cents_element = driver.find_element(By.CSS_SELECTOR, ".price-mantissa")
                        cents = cents_element.get_attribute("content") or cents_element.text.strip()
                        product_data["price"] = f"${price_whole}.{cents}"
                    except:
                        product_data["price"] = f"${price_whole}.00"
                        
                    if product_data["price"]:
                        logger.info(f"Extracted price: {product_data['price']}")
                        break
                except:
                    continue
        except Exception as e:
            logger.warning(f"Failed to extract price: {str(e)}")
            product_data["price"] = "$0.00"

        # Extract Image URL
        try:
            image_selectors = [".prod-hero-image img", ".prod-HeroImage img"]
            
            for selector in image_selectors:
                try:
                    image_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["image_url"] = image_element.get_attribute("src")
                    if product_data["image_url"]:
                        logger.info(f"Extracted image URL: {product_data['image_url']}")
                        break
                except:
                    continue
        except Exception as e:
            logger.warning(f"Failed to extract image URL: {str(e)}")
            product_data["image_url"] = ""

        # Extract Brand
        try:
            brand_selectors = [".prod-ProductBrand", ".prod-brandName"]
            
            for selector in brand_selectors:
                try:
                    brand_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["brand"] = brand_element.text.strip()
                    if product_data["brand"]:
                        logger.info(f"Extracted brand: {product_data['brand']}")
                        break
                except:
                    continue
                    
            if "brand" not in product_data or not product_data["brand"]:
                # Try to extract brand from title
                if "title" in product_data and product_data["title"]:
                    title_parts = product_data["title"].split()
                    if len(title_parts) > 0:
                        product_data["brand"] = title_parts[0]
                        logger.info(f"Extracted brand from title: {product_data['brand']}")
        except Exception as e:
            logger.warning(f"Failed to extract brand: {str(e)}")
            product_data["brand"] = ""

        # Extract Description
        try:
            description_selectors = [".about-desc", ".prod-ProductDescription"]
            
            for selector in description_selectors:
                try:
                    description_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["description"] = description_element.text.strip()
                    if product_data["description"]:
                        logger.info(f"Extracted description (first 50 chars): {product_data['description'][:50]}...")
                        break
                except:
                    continue
        except Exception as e:
            logger.warning(f"Failed to extract description: {str(e)}")
            product_data["description"] = ""

        return product_data

    except Exception as e:
        logger.error(f"Error in scrape_walmart: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "title": "Unknown Product",
            "price": "$0.00",
            "image_url": "",
            "rating": "",
            "brand": "",
            "description": ""
        }

def scrape_bestbuy(driver):
    """Scrape product data from Best Buy"""
    wait = WebDriverWait(driver, 5)
    product_data = {}
    
    try:
        # Extract Title
        try:
            title_selectors = [".sku-title h1", ".heading-5"]
            
            for selector in title_selectors:
                try:
                    title_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["title"] = title_element.text.strip()
                    if product_data["title"]:
                        logger.info(f"Extracted title: {product_data['title']}")
                        break
                except:
                    continue
        except Exception as e:
            logger.warning(f"Failed to extract title: {str(e)}")
            product_data["title"] = "Unknown Product"

        # Extract Price
        try:
            price_selectors = [".priceView-customer-price span", ".priceView-purchase-price"]
            
            for selector in price_selectors:
                try:
                    price_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["price"] = price_element.text.strip()
                    if product_data["price"]:
                        logger.info(f"Extracted price: {product_data['price']}")
                        break
                except:
                    continue
        except Exception as e:
            logger.warning(f"Failed to extract price: {str(e)}")
            product_data["price"] = "$0.00"

        # Extract Image URL
        try:
            image_selectors = [".primary-image", ".picture-wrapper img"]
            
            for selector in image_selectors:
                try:
                    image_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["image_url"] = image_element.get_attribute("src")
                    if product_data["image_url"]:
                        logger.info(f"Extracted image URL: {product_data['image_url']}")
                        break
                except:
                    continue
        except Exception as e:
            logger.warning(f"Failed to extract image URL: {str(e)}")
            product_data["image_url"] = ""

        # Extract Brand
        try:
            brand_selectors = [".brand-link", ".product-data-value"]
            
            for selector in brand_selectors:
                try:
                    brand_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["brand"] = brand_element.text.strip()
                    if product_data["brand"]:
                        logger.info(f"Extracted brand: {product_data['brand']}")
                        break
                except:
                    continue
                    
            if "brand" not in product_data or not product_data["brand"]:
                # Try to extract brand from title
                if "title" in product_data and product_data["title"]:
                    title_parts = product_data["title"].split()
                    if len(title_parts) > 0:
                        product_data["brand"] = title_parts[0]
                        logger.info(f"Extracted brand from title: {product_data['brand']}")
        except Exception as e:
            logger.warning(f"Failed to extract brand: {str(e)}")
            product_data["brand"] = ""

        # Extract Description
        try:
            description_selectors = [".long-description", ".product-description"]
            
            for selector in description_selectors:
                try:
                    description_element = driver.find_element(By.CSS_SELECTOR, selector)
                    product_data["description"] = description_element.text.strip()
                    if product_data["description"]:
                        logger.info(f"Extracted description (first 50 chars): {product_data['description'][:50]}...")
                        break
                except:
                    continue
        except Exception as e:
            logger.warning(f"Failed to extract description: {str(e)}")
            product_data["description"] = ""

        return product_data

    except Exception as e:
        logger.error(f"Error in scrape_bestbuy: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "title": "Unknown Product",
            "price": "$0.00",
            "image_url": "",
            "rating": "",
            "brand": "",
            "description": ""
        }
