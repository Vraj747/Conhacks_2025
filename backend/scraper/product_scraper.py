from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

def scrape_product_data(url):
    """
    Scrape product data from the provided URL
    """
    # Configure Chrome options
    options = Options()
    options.add_argument("--headless")  # Run in headless mode (no browser UI)
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    # Fix for Mac M1/M2 chips (Apple Silicon)
    options.add_argument("--disable-gpu")
    
    try:
        # Use ChromeDriverManager with explicit version for Mac ARM architecture
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        
        # Navigate to the URL
        driver.get(url)
        
        # Wait for the page to load
        wait = WebDriverWait(driver, 10)
        
        # Extract product information
        try:
            product_title = wait.until(EC.presence_of_element_located((By.ID, "productTitle"))).text
        except:
            product_title = "Title not found"
        
        try:
            price_element = driver.find_element(By.CSS_SELECTOR, ".a-price .a-offscreen")
            price = price_element.get_attribute("textContent")
        except:
            try:
                price_element = driver.find_element(By.CSS_SELECTOR, "#priceblock_ourprice")
                price = price_element.text
            except:
                price = "Price not found"
        
        try:
            rating_element = driver.find_element(By.CSS_SELECTOR, "span.a-icon-alt")
            rating = rating_element.get_attribute("textContent")
        except:
            rating = "Rating not found"
        
        try:
            reviews_count_element = driver.find_element(By.ID, "acrCustomerReviewText")
            reviews_count = reviews_count_element.text
        except:
            reviews_count = "Review count not found"
        
        # Get product details
        product_details = {}
        try:
            details_table = driver.find_element(By.ID, "productDetails_detailBullets_sections1")
            rows = details_table.find_elements(By.TAG_NAME, "tr")
            for row in rows:
                try:
                    key = row.find_element(By.TAG_NAME, "th").text.strip()
                    value = row.find_element(By.TAG_NAME, "td").text.strip()
                    product_details[key] = value
                except:
                    continue
        except:
            product_details = {"details": "Details not found"}
        
        # Get product description
        try:
            description_element = driver.find_element(By.ID, "productDescription")
            description = description_element.text
        except:
            description = "Description not found"
        
        # Combine data
        product_data = {
            "title": product_title,
            "price": price,
            "rating": rating,
            "reviews_count": reviews_count,
            "details": product_details,
            "description": description,
            "url": url
        }
        
        return product_data
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return {"error": str(e)}
    
    finally:
        # Always close the driver
        try:
            driver.quit()
        except:
            pass