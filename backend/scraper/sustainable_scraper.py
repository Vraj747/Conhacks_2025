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

# Dictionary of sustainable brands by category
SUSTAINABLE_BRANDS = {
    "electronics": [
        {"name": "Fairphone", "url": "https://www.fairphone.com/", "eco_factors": ["Ethical Supply Chain", "Repairable Design", "Long Lifespan"]},
        {"name": "Framework", "url": "https://frame.work/", "eco_factors": ["Modular Design", "Repairable", "Upgradable"]},
        {"name": "House of Marley", "url": "https://www.thehouseofmarley.com/", "eco_factors": ["Sustainable Materials", "Recyclable"]},
        {"name": "Nimble", "url": "https://www.gonimble.com/", "eco_factors": ["Recycled Materials", "Plastic-Free Packaging"]},
        {"name": "Pela", "url": "https://pelacase.com/", "eco_factors": ["Compostable Products", "Carbon Neutral"]},
    ],
    "clothing": [
        {"name": "Patagonia", "url": "https://www.patagonia.com/", "eco_factors": ["Organic Materials", "Fair Trade", "Recycled Fabrics"]},
        {"name": "Everlane", "url": "https://www.everlane.com/", "eco_factors": ["Ethical Factories", "Transparent Pricing", "Recycled Materials"]},
        {"name": "Reformation", "url": "https://www.thereformation.com/", "eco_factors": ["Carbon Neutral", "Water Saving", "Sustainable Fabrics"]},
        {"name": "Allbirds", "url": "https://www.allbirds.com/", "eco_factors": ["Natural Materials", "Carbon Neutral", "B Corp Certified"]},
        {"name": "Eileen Fisher", "url": "https://www.eileenfisher.com/", "eco_factors": ["Organic Fabrics", "Take-Back Program", "Reduced Waste"]},
    ],
    "home": [
        {"name": "West Elm", "url": "https://www.westelm.com/", "eco_factors": ["Fair Trade", "Organic Options", "FSC-Certified Wood"]},
        {"name": "Avocado Green Mattress", "url": "https://www.avocadogreenmattress.com/", "eco_factors": ["Organic Materials", "Carbon Negative", "Handmade"]},
        {"name": "Coyuchi", "url": "https://www.coyuchi.com/", "eco_factors": ["Organic Cotton", "Circular Design", "Recycled Packaging"]},
        {"name": "Buffy", "url": "https://buffy.co/", "eco_factors": ["Recycled Materials", "Cruelty-Free", "Water Conservation"]},
        {"name": "Etsy", "url": "https://www.etsy.com/", "eco_factors": ["Handmade", "Small Businesses", "Carbon Neutral Shipping"]},
    ],
    "beauty": [
        {"name": "Lush", "url": "https://www.lush.com/", "eco_factors": ["Packaging-Free", "Handmade", "Cruelty-Free"]},
        {"name": "Beautycounter", "url": "https://www.beautycounter.com/", "eco_factors": ["Clean Ingredients", "Sustainable Packaging", "Transparent"]},
        {"name": "Ethique", "url": "https://ethique.com/", "eco_factors": ["Plastic-Free", "Palm Oil-Free", "Carbon Neutral"]},
        {"name": "Elate Cosmetics", "url": "https://elatebeauty.com/", "eco_factors": ["Vegan", "Zero-Waste Packaging", "Organic Ingredients"]},
        {"name": "RMS Beauty", "url": "https://www.rmsbeauty.com/", "eco_factors": ["Organic Ingredients", "Minimal Packaging", "Cruelty-Free"]},
    ],
    "food": [
        {"name": "Imperfect Foods", "url": "https://www.imperfectfoods.com/", "eco_factors": ["Reduces Food Waste", "Sustainable Sourcing", "Carbon Neutral"]},
        {"name": "Thrive Market", "url": "https://thrivemarket.com/", "eco_factors": ["Carbon Neutral", "Zero-Waste Warehouses", "Ethical Sourcing"]},
        {"name": "Equal Exchange", "url": "https://equalexchange.coop/", "eco_factors": ["Fair Trade", "Worker-Owned", "Organic"]},
        {"name": "Numi Tea", "url": "https://numitea.com/", "eco_factors": ["Organic", "Fair Trade", "Plant-Based Packaging"]},
        {"name": "Dr. Bronner's", "url": "https://www.drbronner.com/", "eco_factors": ["Organic", "Fair Trade", "Regenerative Agriculture"]},
    ],
    "default": [
        {"name": "Etsy", "url": "https://www.etsy.com/", "eco_factors": ["Handmade", "Small Businesses", "Carbon Neutral Shipping"]},
        {"name": "Patagonia", "url": "https://www.patagonia.com/", "eco_factors": ["Organic Materials", "Fair Trade", "Recycled Fabrics"]},
        {"name": "Thrive Market", "url": "https://thrivemarket.com/", "eco_factors": ["Carbon Neutral", "Zero-Waste Warehouses", "Ethical Sourcing"]},
    ]
}

def categorize_product(product_data):
    """
    Categorize a product based on its title and description
    """
    logger.info(f"Categorizing product: {product_data.get('title', 'Unknown Product')}")
    
    try:
        title = product_data.get('title', '').lower()
        description = product_data.get('description', '').lower()
        combined_text = f"{title} {description}"
        
        # Define category keywords
        electronics_keywords = ['phone', 'laptop', 'computer', 'tablet', 'headphone', 'earbud', 'speaker', 
                              'camera', 'tv', 'television', 'monitor', 'keyboard', 'mouse', 'charger', 
                              'battery', 'airpod', 'watch', 'smart watch', 'gaming', 'console', 'playstation', 
                              'xbox', 'nintendo', 'electronic', 'device', 'gadget', 'tech', 'technology']
        
        clothing_keywords = ['shirt', 'pant', 'dress', 'jacket', 'coat', 'sweater', 'hoodie', 'jeans', 
                           'sock', 'underwear', 'shoe', 'boot', 'sneaker', 'hat', 'cap', 'scarf', 
                           'glove', 'clothing', 'apparel', 'wear', 'fashion', 'garment', 'outfit', 
                           't-shirt', 'tshirt', 'sweatshirt', 'shorts']
        
        home_keywords = ['furniture', 'chair', 'table', 'desk', 'sofa', 'couch', 'bed', 'mattress', 
                       'pillow', 'blanket', 'sheet', 'towel', 'curtain', 'rug', 'carpet', 'lamp', 
                       'light', 'decor', 'decoration', 'kitchen', 'appliance', 'cookware', 'utensil', 
                       'plate', 'bowl', 'cup', 'mug', 'home', 'house']
        
        beauty_keywords = ['makeup', 'cosmetic', 'skincare', 'lotion', 'cream', 'serum', 'face', 'hair', 
                         'shampoo', 'conditioner', 'soap', 'body wash', 'perfume', 'cologne', 'fragrance', 
                         'beauty', 'lipstick', 'mascara', 'eyeshadow', 'nail polish', 'deodorant']
        
        food_keywords = ['food', 'snack', 'drink', 'beverage', 'coffee', 'tea', 'water', 'juice', 
                       'soda', 'alcohol', 'wine', 'beer', 'grocery', 'organic', 'fruit', 'vegetable', 
                       'meat', 'dairy', 'milk', 'cheese', 'yogurt', 'chocolate', 'candy', 'cereal']
        
        # Check for category matches
        for keyword in electronics_keywords:
            if keyword in combined_text:
                logger.info(f"Categorized as electronics based on keyword: {keyword}")
                return "electronics"
                
        for keyword in clothing_keywords:
            if keyword in combined_text:
                logger.info(f"Categorized as clothing based on keyword: {keyword}")
                return "clothing"
                
        for keyword in home_keywords:
            if keyword in combined_text:
                logger.info(f"Categorized as home based on keyword: {keyword}")
                return "home"
                
        for keyword in beauty_keywords:
            if keyword in combined_text:
                logger.info(f"Categorized as beauty based on keyword: {keyword}")
                return "beauty"
                
        for keyword in food_keywords:
            if keyword in combined_text:
                logger.info(f"Categorized as food based on keyword: {keyword}")
                return "food"
        
        # Default category if no match found
        logger.info("No category match found, using default")
        return "default"
        
    except Exception as e:
        logger.error(f"Error in categorize_product: {str(e)}")
        logger.error(traceback.format_exc())
        return "default"

def search_sustainable_alternatives(product_data, max_results=5):
    """
    Find sustainable alternatives for a product based on its category
    """
    logger.info(f"Searching sustainable alternatives for: {product_data.get('title', 'Unknown Product')}")
    
    try:
        # Categorize the product
        category = categorize_product(product_data)
        
        # Get sustainable brands for the category
        brands = SUSTAINABLE_BRANDS.get(category, SUSTAINABLE_BRANDS["default"])
        
        # Limit to max_results
        selected_brands = brands[:max_results]
        
        # Create results with product-specific information
        results = []
        
        for brand in selected_brands:
            # Extract product type from title
            product_title = product_data.get('title', '').lower()
            product_type = extract_product_type(product_title, category)
            
            # Create a title that combines the brand and product type
            if product_type:
                title = f"{brand['name']} {product_type}"
            else:
                title = f"{brand['name']} Sustainable Alternative"
            
            # Generate a price that's comparable to the original
            original_price = product_data.get('price', '$0.00')
            try:
                price_value = float(re.sub(r'[^\d.]', '', original_price))
                # Sustainable products often cost a bit more
                sustainable_price = price_value * random.uniform(1.0, 1.3)
                price = f"${sustainable_price:.2f}"
            except:
                price = original_price
            
            # Create the result
            results.append({
                'title': title,
                'price': price,
                'link': brand['url'],
                'image_url': f"https://via.placeholder.com/150?text={brand['name'].replace(' ', '+')}",
                'eco_factors': brand['eco_factors'],
                'source': 'Sustainable Brand'
            })
            
            logger.info(f"Added sustainable alternative: {title} at {price}")
        
        logger.info(f"Found {len(results)} sustainable alternatives")
        return results
        
    except Exception as e:
        logger.error(f"Error in search_sustainable_alternatives: {str(e)}")
        logger.error(traceback.format_exc())
        return []

def extract_product_type(title, category):
    """
    Extract the product type from the title based on category
    """
    try:
        # Electronics
        if category == "electronics":
            for product_type in ['phone', 'laptop', 'headphones', 'earbuds', 'speaker', 'camera', 'tv', 'monitor', 'watch']:
                if product_type in title:
                    return product_type
            return "Electronic"
            
        # Clothing
        elif category == "clothing":
            for product_type in ['shirt', 'pants', 'dress', 'jacket', 'sweater', 'hoodie', 'jeans', 'shoes', 'boots', 'hat']:
                if product_type in title:
                    return product_type
            return "Apparel"
            
        # Home
        elif category == "home":
            for product_type in ['chair', 'table', 'desk', 'sofa', 'bed', 'mattress', 'pillow', 'blanket', 'lamp', 'rug']:
                if product_type in title:
                    return product_type
            return "Home Item"
            
        # Beauty
        elif category == "beauty":
            for product_type in ['makeup', 'skincare', 'lotion', 'shampoo', 'conditioner', 'soap', 'perfume']:
                if product_type in title:
                    return product_type
            return "Beauty Product"
            
        # Food
        elif category == "food":
            for product_type in ['coffee', 'tea', 'snack', 'chocolate', 'cereal']:
                if product_type in title:
                    return product_type
            return "Food Item"
            
        # Default
        else:
            # Extract the first noun or noun phrase
            words = title.split()
            if len(words) > 1:
                return words[1]  # Often the second word is the product type
            elif len(words) == 1:
                return words[0]
            else:
                return "Product"
                
    except Exception as e:
        logger.warning(f"Error extracting product type: {str(e)}")
        return "Product"

def find_sustainable_alternatives(product_data, max_results=5):
    """
    Main function to find sustainable alternatives for a product
    """
    logger.info(f"Finding sustainable alternatives for: {product_data.get('title', 'Unknown Product')}")
    
    try:
        # Get sustainable brand alternatives
        sustainable_results = search_sustainable_alternatives(product_data, max_results)
        
        # Sort by eco_factors length (more eco factors = better)
        sustainable_results.sort(key=lambda x: len(x.get('eco_factors', [])), reverse=True)
        
        logger.info(f"Returning {len(sustainable_results)} sustainable alternatives")
        return sustainable_results
        
    except Exception as e:
        logger.error(f"Error in find_sustainable_alternatives: {str(e)}")
        logger.error(traceback.format_exc())
        return [] 