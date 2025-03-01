from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

def scrape_product_data(url):
    # Set up Selenium WebDriver with headless mode
    options = Options()
    options.add_argument("--headless")  # Run in the background
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-infobars")
    options.add_argument("--disable-dev-shm-usage")

    # Install and start Chrome WebDriver
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)

    try:
        driver.get(url)
        wait = WebDriverWait(driver, 5)  # Wait up to 5 seconds for elements

        # Extract Title
        try:
            title = wait.until(EC.presence_of_element_located((By.ID, "productTitle"))).text.strip()
        except:
            title = None

        # Extract Price
        try:
            price = driver.find_element(By.CSS_SELECTOR, "span.a-price-whole").text.strip()
        except:
            price = None

        # Extract Image URL
        try:
            image_url = driver.find_element(By.ID, "landingImage").get_attribute("src")
        except:
            image_url = None

        # Extract Ratings
        try:
            rating = driver.find_element(By.CLASS_NAME, "a-icon-alt").text.strip()
        except:
            rating = None

        # Extract Number of Reviews
        try:
            reviews = driver.find_element(By.ID, "acrCustomerReviewText").text.strip()
        except:
            reviews = None

        # Extract Availability
        try:
            availability = driver.find_element(By.ID, "availability").text.strip()
        except:
            availability = None

        # Extract Brand Name
        try:
            brand = driver.find_element(By.ID, "bylineInfo").text.strip()
        except:
            brand = None

        # Extract Product Description
        try:
            description = driver.find_element(By.ID, "feature-bullets").text.strip()
        except:
            description = None

        driver.quit()

        if not title or not price:
            return {"error": "Failed to extract product details"}

        return {
            "title": title,
            "price": price,
            "image_url": image_url,
            "rating": rating,
            "reviews": reviews,
            "availability": availability,
            "brand": brand,
            "description": description
        }

    except Exception as e:
        driver.quit()
        return {"error": str(e)}
