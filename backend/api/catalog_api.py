import logging
import re
import random
import hashlib
import json
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

def get_simulated_product_data(product_data):
    """
    Generate high-quality simulated product data
    
    This function creates realistic product data based on the product title,
    description, and other available information. It simulates what would be
    returned by Amazon's Product Advertising API.
    
    The data includes:
    - Product dimensions and weight
    - Product category
    - Packaging dimensions and weight
    - Packaging efficiency metrics
    
    All values are generated deterministically based on the product title or ASIN,
    ensuring consistent results for the same product.
    """
    try:
        logger.info(f"Generating simulated catalog data for: {product_data.get('title', 'Unknown Product')}")
        
        # Extract ASIN from URL if available
        url = product_data.get('url', '')
        asin = None
        asin_match = re.search(r'/dp/([A-Z0-9]{10})(?:/|$)', url)
        if asin_match:
            asin = asin_match.group(1)
            logger.info(f"Extracted ASIN: {asin}")
        else:
            logger.warning("Could not extract ASIN from URL")
        
        # For demonstration, we'll generate realistic data based on the product title
        title = product_data.get('title', '').lower()
        description = product_data.get('description', '').lower()
        
        # Use ASIN or title to generate deterministic random values
        # This ensures the same product always gets the same dimensions
        seed_value = asin if asin else title
        random.seed(int(hashlib.md5(seed_value.encode()).hexdigest(), 16) % (2**32))
        
        # Detect product category based on title and description
        category, dimensions, weight_g = detect_product_category(title, description)
        
        # Calculate packaging dimensions based on product dimensions
        packaging_dimensions, packaging_volume, packaging_efficiency = calculate_packaging_dimensions(dimensions, category)
        
        # Calculate packaging weight based on dimensions and material
        packaging_weight_g = calculate_packaging_weight(weight_g, category, packaging_volume)
        
        # Create catalog data response
        catalog_data = {
            "asin": asin,
            "category": category,
            "dimensions": {
                "length_cm": round(dimensions['length'], 1),
                "width_cm": round(dimensions['width'], 1),
                "height_cm": round(dimensions['height'], 1)
            },
            "weight_g": round(weight_g),
            "packaging_dimensions": {
                "length_cm": round(packaging_dimensions['length'], 1),
                "width_cm": round(packaging_dimensions['width'], 1),
                "height_cm": round(packaging_dimensions['height'], 1)
            },
            "packaging_volume_cm3": round(packaging_volume),
            "packaging_efficiency": round(packaging_efficiency, 1),
            "packaging_weight_g": round(packaging_weight_g),
            "is_simulated": True  # Flag to indicate this is simulated data
        }
        
        logger.info(f"Generated simulated catalog data for {category} product:")
        logger.info(f"  - Product dimensions: {catalog_data['dimensions']}")
        logger.info(f"  - Product weight: {catalog_data['weight_g']}g")
        logger.info(f"  - Package dimensions: {catalog_data['packaging_dimensions']}")
        logger.info(f"  - Package weight: {catalog_data['packaging_weight_g']}g")
        logger.info(f"  - Packaging efficiency: {catalog_data['packaging_efficiency']}%")
        
        return catalog_data
        
    except Exception as e:
        logger.error(f"Error generating simulated product data: {str(e)}")
        return None

def detect_product_category(title, description):
    """
    Detect product category, dimensions, and weight based on title and description
    
    Returns:
        tuple: (category, dimensions, weight_g)
    """
    # Check for large appliances
    large_appliance_keywords = [
        # Cooling appliances
        'refrigerator', 'fridge', 'freezer', 'mini fridge', 'wine cooler', 'beverage cooler',
        # Laundry appliances
        'washing machine', 'washer', 'dryer', 'washer dryer combo', 'clothes steamer',
        # Kitchen appliances
        'dishwasher', 'oven', 'stove', 'range', 'microwave', 'air fryer', 'slow cooker', 'pressure cooker',
        'instant pot', 'stand mixer', 'food processor', 'blender', 'juicer',
        # Heating and cooling
        'air conditioner', 'portable ac', 'heater', 'space heater', 'dehumidifier', 'humidifier',
        # Cleaning appliances
        'vacuum cleaner', 'robot vacuum', 'carpet cleaner', 'steam cleaner',
        # Other large appliances
        'water heater', 'water dispenser', 'trash compactor', 'garbage disposal'
    ]
    
    # Check for TVs
    tv_keywords = [
        'tv', 'television', 'monitor', 'smart tv', 'led tv', 'oled tv', 'qled tv', 'lcd tv', 
        'plasma tv', '4k tv', '8k tv', 'uhd tv', 'hd tv', 'curved tv', 'flat screen', 
        'home theater display', 'streaming tv', 'android tv', 'roku tv', 'fire tv', 
        'apple tv', 'projector', 'projection screen'
    ]
    
    # Check for furniture
    furniture_keywords = [
        # Seating
        'chair', 'sofa', 'couch', 'loveseat', 'sectional', 'recliner', 'ottoman', 'stool', 'bench',
        # Tables
        'table', 'desk', 'coffee table', 'end table', 'console table', 'dining table', 'nightstand',
        # Storage
        'bookcase', 'bookshelf', 'shelf', 'shelving', 'cabinet', 'dresser', 'chest of drawers', 'wardrobe',
        # Bedroom
        'bed', 'mattress', 'bed frame', 'headboard', 'bunk bed', 'futon', 'daybed', 'crib',
        # Office
        'office chair', 'computer desk', 'filing cabinet', 'workstation',
        # Other
        'entertainment center', 'tv stand', 'accent furniture', 'bean bag', 'hammock'
    ]
    
    # Check for electronics
    electronics_keywords = [
        # Computing
        'laptop', 'computer', 'desktop', 'chromebook', 'notebook', 'macbook', 'pc', 'server',
        'monitor', 'keyboard', 'mouse', 'webcam', 'hard drive', 'ssd', 'usb drive', 'memory card',
        # Mobile devices
        'phone', 'smartphone', 'iphone', 'android', 'tablet', 'ipad', 'e-reader', 'kindle',
        # Audio
        'headphones', 'earbuds', 'earphones', 'speaker', 'bluetooth speaker', 'soundbar', 'subwoofer',
        'amplifier', 'receiver', 'turntable', 'record player', 'mp3 player', 'ipod','earpods','airpods',
        # Photography
        'camera', 'digital camera', 'dslr', 'mirrorless camera', 'action camera', 'gopro', 'camcorder',
        'lens', 'tripod', 'flash', 'memory card',
        # Gaming
        'gaming', 'video game', 'console', 'playstation', 'xbox', 'nintendo', 'switch', 'controller',
        # Wearables
        'smartwatch', 'fitness tracker', 'apple watch', 'garmin', 'fitbit',
        # Other
        'router', 'modem', 'printer', 'scanner', 'drone', 'power bank', 'charger', 'adapter', 'cable',
        'smart home', 'alexa', 'echo', 'google home', 'ring', 'nest'
    ]
    
    # Check for books
    book_keywords = [
        'book', 'novel', 'textbook', 'cookbook', 'paperback', 'hardcover', 'ebook', 'audiobook',
        'journal', 'diary', 'comic book', 'manga', 'graphic novel', 'anthology', 'encyclopedia',
        'dictionary', 'thesaurus', 'biography', 'autobiography', 'fiction', 'non-fiction',
        'children\'s book', 'coloring book', 'workbook', 'guidebook', 'handbook', 'manual'
    ]
    
    # Check for clothing
    clothing_keywords = [
        # Tops
        'shirt', 't-shirt', 'tee', 'blouse', 'tank top', 'polo', 'sweater', 'sweatshirt', 'hoodie',
        'cardigan', 'tunic', 'jersey', 'button-up', 'button-down',
        # Bottoms
        'pants', 'jeans', 'shorts', 'skirt', 'leggings', 'joggers', 'sweatpants', 'chinos', 'khakis',
        'trousers', 'capris', 'cargo pants',
        # Dresses & Suits
        'dress', 'gown', 'suit', 'tuxedo', 'blazer', 'jumpsuit', 'romper', 'overalls',
        # Outerwear
        'jacket', 'coat', 'parka', 'windbreaker', 'raincoat', 'vest', 'poncho', 'cloak',
        # Underwear & Sleepwear
        'underwear', 'boxers', 'briefs', 'panties', 'bra', 'lingerie', 'pajamas', 'nightgown', 'robe',
        # Footwear
        'shoes', 'boots', 'sneakers', 'sandals', 'slippers', 'heels', 'flats', 'loafers', 'oxfords',
        'flip flops', 'running shoes', 'athletic shoes',
        # Accessories
        'hat', 'cap', 'beanie', 'scarf', 'gloves', 'mittens', 'socks', 'belt', 'tie', 'bow tie',
        'suspenders', 'wallet', 'purse', 'handbag', 'backpack', 'tote', 'watch', 'jewelry',
        # Specialty
        'swimsuit', 'swimwear', 'bikini', 'trunks', 'wetsuit', 'uniform', 'costume', 'formal wear',
        'activewear', 'sportswear', 'athleisure', 'maternity'
    ]
    
    # Check for toys
    toy_keywords = [
        # Traditional toys
        'toy', 'action figure', 'doll', 'stuffed animal', 'plush', 'teddy bear', 'building blocks',
        'lego', 'puzzle', 'board game', 'card game', 'dice game', 'game', 'playset', 'playhouse',
        'toy car', 'remote control', 'rc car', 'train set', 'model kit',
        # Educational toys
        'educational toy', 'learning toy', 'stem toy', 'science kit', 'chemistry set', 'microscope',
        'telescope', 'math toy', 'coding toy', 'robot kit',
        # Outdoor toys
        'outdoor toy', 'playground', 'swing set', 'slide', 'trampoline', 'pool toy', 'water toy',
        'beach toy', 'kite', 'frisbee', 'ball', 'bicycle', 'tricycle', 'scooter', 'skateboard',
        # Baby & toddler toys
        'baby toy', 'infant toy', 'toddler toy', 'rattle', 'teether', 'activity center', 'play mat',
        'stacking toy', 'shape sorter', 'push toy', 'pull toy',
        # Arts & crafts
        'arts and crafts', 'craft kit', 'art set', 'drawing set', 'painting set', 'clay', 'play-doh',
        'coloring set', 'bead kit', 'jewelry making kit',
        # Video games
        'video game', 'console game', 'pc game', 'mobile game', 'vr game', 'gaming accessory'
    ]
    
    # Check for beauty products
    beauty_keywords = [
        # Skincare
        'beauty', 'skincare', 'face wash', 'cleanser', 'moisturizer', 'serum', 'toner', 'face mask',
        'eye cream', 'sunscreen', 'lotion', 'cream', 'exfoliator', 'scrub', 'anti-aging',
        # Makeup
        'makeup', 'cosmetic', 'foundation', 'concealer', 'powder', 'blush', 'bronzer', 'highlighter',
        'eyeshadow', 'eyeliner', 'mascara', 'lipstick', 'lip gloss', 'lip balm', 'makeup remover',
        'makeup brush', 'beauty blender', 'primer', 'setting spray',
        # Hair care
        'shampoo', 'conditioner', 'hair mask', 'hair oil', 'hair serum', 'hair spray', 'dry shampoo',
        'hair gel', 'hair mousse', 'hair dye', 'hair color', 'hair treatment', 'hair styling',
        'hair dryer', 'straightener', 'curling iron', 'hair brush', 'comb',
        # Bath & body
        'body wash', 'shower gel', 'soap', 'bath bomb', 'bubble bath', 'body scrub', 'body lotion',
        'body oil', 'hand cream', 'foot cream', 'deodorant', 'antiperspirant',
        # Fragrance
        'perfume', 'cologne', 'fragrance', 'body spray', 'eau de toilette', 'eau de parfum',
        # Nail care
        'nail polish', 'nail care', 'nail file', 'nail clipper', 'cuticle oil', 'nail treatment',
        # Tools & accessories
        'beauty tool', 'facial roller', 'gua sha', 'jade roller', 'face massager', 'beauty device',
        'mirror', 'makeup bag', 'cosmetic case'
    ]
    
    # Check for food
    food_keywords = [
        # General food categories
        'food', 'snack', 'grocery', 'gourmet', 'organic', 'non-gmo', 'vegan', 'vegetarian', 'gluten-free',
        # Beverages
        'drink', 'beverage', 'coffee', 'tea', 'juice', 'soda', 'water', 'energy drink', 'sports drink',
        'milk', 'non-dairy milk', 'almond milk', 'oat milk', 'coconut milk', 'smoothie', 'shake',
        'wine', 'beer', 'liquor', 'spirits', 'cocktail mixer',
        # Snacks
        'chips', 'crackers', 'popcorn', 'pretzels', 'nuts', 'trail mix', 'granola', 'protein bar',
        'energy bar', 'cereal bar', 'chocolate', 'candy', 'gum', 'jerky', 'dried fruit',
        # Pantry items
        'cereal', 'oatmeal', 'pasta', 'rice', 'grain', 'flour', 'sugar', 'spice', 'herb', 'seasoning',
        'oil', 'vinegar', 'sauce', 'condiment', 'dressing', 'syrup', 'honey', 'jam', 'jelly',
        'peanut butter', 'spread', 'canned food', 'soup', 'broth', 'beans', 'vegetables', 'fruits',
        # Baking
        'baking', 'baking mix', 'cake mix', 'brownie mix', 'cookie mix', 'bread mix', 'yeast',
        'baking powder', 'baking soda', 'vanilla extract', 'food coloring',
        # Dairy & refrigerated
        'dairy', 'cheese', 'yogurt', 'butter', 'margarine', 'eggs', 'cream', 'sour cream', 'cream cheese',
        # Meat & seafood
        'meat', 'beef', 'chicken', 'pork', 'turkey', 'lamb', 'fish', 'seafood', 'shellfish',
        # Frozen foods
        'frozen', 'frozen meal', 'frozen pizza', 'ice cream', 'frozen yogurt', 'frozen vegetables',
        'frozen fruit', 'frozen dessert',
        # International foods
        'international food', 'asian food', 'mexican food', 'italian food', 'indian food', 'middle eastern food'
    ]
    
    # Determine category based on keywords
    if any(keyword in title for keyword in large_appliance_keywords):
        category = "large_appliance"
        
        # Different dimensions based on specific appliance type
        if 'refrigerator' in title or 'fridge' in title:
            dimensions = {
                'length': random.uniform(70, 90),  # cm
                'width': random.uniform(60, 80),   # cm
                'height': random.uniform(170, 190) # cm
            }
            weight_g = random.uniform(70000, 120000)  # 70-120 kg
        elif 'freezer' in title:
            dimensions = {
                'length': random.uniform(60, 80),  # cm
                'width': random.uniform(60, 70),   # cm
                'height': random.uniform(85, 160)  # cm
            }
            weight_g = random.uniform(40000, 80000)  # 40-80 kg
        elif 'mini fridge' in title or 'wine cooler' in title or 'beverage cooler' in title:
            dimensions = {
                'length': random.uniform(40, 55),  # cm
                'width': random.uniform(40, 50),   # cm
                'height': random.uniform(50, 85)   # cm
            }
            weight_g = random.uniform(15000, 30000)  # 15-30 kg
        elif 'washing machine' in title or 'washer' in title:
            dimensions = {
                'length': random.uniform(55, 65),  # cm
                'width': random.uniform(55, 65),   # cm
                'height': random.uniform(80, 90)   # cm
            }
            weight_g = random.uniform(60000, 80000)  # 60-80 kg
        elif 'dryer' in title:
            dimensions = {
                'length': random.uniform(55, 65),  # cm
                'width': random.uniform(55, 65),   # cm
                'height': random.uniform(80, 90)   # cm
            }
            weight_g = random.uniform(35000, 50000)  # 35-50 kg
        elif 'washer dryer combo' in title:
            dimensions = {
                'length': random.uniform(60, 70),  # cm
                'width': random.uniform(55, 65),   # cm
                'height': random.uniform(85, 95)   # cm
            }
            weight_g = random.uniform(70000, 90000)  # 70-90 kg
        elif 'dishwasher' in title:
            dimensions = {
                'length': random.uniform(55, 65),  # cm
                'width': random.uniform(55, 65),   # cm
                'height': random.uniform(80, 90)   # cm
            }
            weight_g = random.uniform(40000, 50000)  # 40-50 kg
        elif 'oven' in title or 'stove' in title or 'range' in title:
            dimensions = {
                'length': random.uniform(60, 80),  # cm
                'width': random.uniform(60, 70),   # cm
                'height': random.uniform(85, 95)   # cm
            }
            weight_g = random.uniform(45000, 70000)  # 45-70 kg
        elif 'microwave' in title:
            dimensions = {
                'length': random.uniform(45, 60),  # cm
                'width': random.uniform(35, 45),   # cm
                'height': random.uniform(25, 35)   # cm
            }
            weight_g = random.uniform(10000, 20000)  # 10-20 kg
        elif 'air conditioner' in title or 'portable ac' in title:
            dimensions = {
                'length': random.uniform(45, 65),  # cm
                'width': random.uniform(35, 50),   # cm
                'height': random.uniform(70, 85)   # cm
            }
            weight_g = random.uniform(20000, 35000)  # 20-35 kg
        elif 'vacuum cleaner' in title or 'robot vacuum' in title:
            dimensions = {
                'length': random.uniform(30, 45),  # cm
                'width': random.uniform(30, 45),   # cm
                'height': random.uniform(15, 30)   # cm
            }
            weight_g = random.uniform(3000, 8000)  # 3-8 kg
        elif 'air fryer' in title or 'slow cooker' in title or 'pressure cooker' in title or 'instant pot' in title:
            dimensions = {
                'length': random.uniform(30, 40),  # cm
                'width': random.uniform(30, 40),   # cm
                'height': random.uniform(30, 40)   # cm
            }
            weight_g = random.uniform(4000, 8000)  # 4-8 kg
        elif 'stand mixer' in title or 'food processor' in title or 'blender' in title:
            dimensions = {
                'length': random.uniform(25, 35),  # cm
                'width': random.uniform(25, 35),   # cm
                'height': random.uniform(30, 45)   # cm
            }
            weight_g = random.uniform(3000, 7000)  # 3-7 kg
        elif 'dehumidifier' in title or 'humidifier' in title:
            dimensions = {
                'length': random.uniform(30, 45),  # cm
                'width': random.uniform(20, 35),   # cm
                'height': random.uniform(45, 65)   # cm
            }
            weight_g = random.uniform(8000, 15000)  # 8-15 kg
        else:
            # Default large appliance dimensions
            dimensions = {
                'length': random.uniform(60, 80),  # cm
                'width': random.uniform(60, 70),   # cm
                'height': random.uniform(80, 100)  # cm
            }
            weight_g = random.uniform(30000, 60000)  # 30-60 kg
    
    elif any(keyword in title for keyword in tv_keywords):
        category = "tv"
        
        # Extract TV size if available
        tv_size_match = re.search(r'(\d+)[- ]?inch|(\d+)[- ]?"', title)
        if tv_size_match:
            size = int(tv_size_match.group(1) if tv_size_match.group(1) else tv_size_match.group(2))
            # Calculate dimensions based on TV size (diagonal)
            # Typical 16:9 aspect ratio
            width = size * 0.87  # Width is about 87% of diagonal in 16:9
            height = size * 0.49  # Height is about 49% of diagonal in 16:9
            depth = random.uniform(2, 8)  # cm
            
            dimensions = {
                'length': width * 2.54,  # Convert inches to cm
                'width': depth,          # cm
                'height': height * 2.54  # Convert inches to cm
            }
            weight_g = size * 300  # Rough estimate: 300g per inch of TV
        else:
            # Default to a 43" TV if size not specified
            dimensions = {
                'length': 97,  # cm
                'width': 8,    # cm
                'height': 57   # cm
            }
            weight_g = 10000  # 10 kg
    
    elif any(keyword in title for keyword in furniture_keywords):
        category = "furniture"
        
        if 'chair' in title:
            dimensions = {
                'length': random.uniform(50, 70),  # cm
                'width': random.uniform(50, 70),   # cm
                'height': random.uniform(80, 100)  # cm
            }
            weight_g = random.uniform(5000, 15000)  # 5-15 kg
        elif 'table' in title or 'desk' in title:
            dimensions = {
                'length': random.uniform(100, 180),  # cm
                'width': random.uniform(60, 90),     # cm
                'height': random.uniform(70, 80)     # cm
            }
            weight_g = random.uniform(15000, 40000)  # 15-40 kg
        elif 'sofa' in title or 'couch' in title:
            dimensions = {
                'length': random.uniform(180, 250),  # cm
                'width': random.uniform(80, 100),    # cm
                'height': random.uniform(80, 100)    # cm
            }
            weight_g = random.uniform(40000, 80000)  # 40-80 kg
        elif 'bed' in title or 'mattress' in title:
            dimensions = {
                'length': random.uniform(190, 210),  # cm
                'width': random.uniform(90, 180),    # cm
                'height': random.uniform(20, 50)     # cm
            }
            weight_g = random.uniform(20000, 50000)  # 20-50 kg
        else:
            dimensions = {
                'length': random.uniform(80, 120),  # cm
                'width': random.uniform(40, 60),    # cm
                'height': random.uniform(100, 180)  # cm
            }
            weight_g = random.uniform(20000, 40000)  # 20-40 kg
    
    elif any(keyword in title for keyword in electronics_keywords):
        category = "electronics"
        
        if 'laptop' in title:
            dimensions = {
                'length': random.uniform(30, 40),  # cm
                'width': random.uniform(20, 30),   # cm
                'height': random.uniform(1.5, 3)   # cm
            }
            weight_g = random.uniform(1200, 2500)  # 1.2-2.5 kg
        elif 'phone' in title or 'smartphone' in title:
            dimensions = {
                'length': random.uniform(14, 17),  # cm
                'width': random.uniform(6, 8),     # cm
                'height': random.uniform(0.7, 1)   # cm
            }
            weight_g = random.uniform(150, 250)  # 150-250 g
        elif 'tablet' in title:
            dimensions = {
                'length': random.uniform(20, 30),  # cm
                'width': random.uniform(15, 20),   # cm
                'height': random.uniform(0.6, 1)   # cm
            }
            weight_g = random.uniform(400, 800)  # 400-800 g
        elif 'headphones' in title:
            dimensions = {
                'length': random.uniform(15, 20),  # cm
                'width': random.uniform(15, 20),   # cm
                'height': random.uniform(5, 10)    # cm
            }
            weight_g = random.uniform(200, 400)  # 200-400 g
        else:
            dimensions = {
                'length': random.uniform(15, 30),  # cm
                'width': random.uniform(10, 20),   # cm
                'height': random.uniform(5, 15)    # cm
            }
            weight_g = random.uniform(500, 2000)  # 500-2000 g
    
    elif any(keyword in title for keyword in book_keywords):
        category = "books"
        dimensions = {
            'length': random.uniform(15, 25),  # cm
            'width': random.uniform(10, 20),   # cm
            'height': random.uniform(1, 5)     # cm
        }
        weight_g = random.uniform(200, 1000)  # 200-1000 g
    
    elif any(keyword in title for keyword in clothing_keywords):
        category = "clothing"
        
        if 'shoes' in title or 'boots' in title:
            dimensions = {
                'length': random.uniform(25, 35),  # cm
                'width': random.uniform(15, 25),   # cm
                'height': random.uniform(10, 15)   # cm
            }
            weight_g = random.uniform(700, 1500)  # 700-1500 g
        else:
            dimensions = {
                'length': random.uniform(20, 40),  # cm
                'width': random.uniform(15, 30),   # cm
                'height': random.uniform(2, 10)    # cm
            }
            weight_g = random.uniform(200, 800)  # 200-800 g
    
    elif any(keyword in title for keyword in toy_keywords):
        category = "toys"
        dimensions = {
            'length': random.uniform(20, 40),  # cm
            'width': random.uniform(15, 30),   # cm
            'height': random.uniform(5, 20)    # cm
        }
        weight_g = random.uniform(300, 2000)  # 300-2000 g
    
    elif any(keyword in title for keyword in beauty_keywords):
        category = "beauty"
        dimensions = {
            'length': random.uniform(5, 15),  # cm
            'width': random.uniform(5, 10),   # cm
            'height': random.uniform(10, 20)  # cm
        }
        weight_g = random.uniform(100, 500)  # 100-500 g
    
    elif any(keyword in title for keyword in food_keywords):
        category = "food"
        dimensions = {
            'length': random.uniform(10, 30),  # cm
            'width': random.uniform(5, 20),    # cm
            'height': random.uniform(5, 30)    # cm
        }
        weight_g = random.uniform(200, 2000)  # 200-2000 g
    
    # Default dimensions for unknown categories
    else:
        dimensions = {
            'length': random.uniform(15, 30),  # cm
            'width': random.uniform(10, 20),   # cm
            'height': random.uniform(5, 15)    # cm
        }
        weight_g = random.uniform(300, 1500)  # 300-1500 g
        category = "small_items" if weight_g < 500 else "unknown"
    
    return category, dimensions, weight_g

def calculate_packaging_dimensions(dimensions, category):
    """
    Calculate packaging dimensions based on product dimensions and category
    
    Returns:
        tuple: (packaging_dimensions, packaging_volume, packaging_efficiency)
    """
    # Different packaging factors based on product category
    if category == "large_appliance":
        packaging_factor = random.uniform(1.05, 1.15)  # Large appliances have tight packaging
    elif category == "electronics":
        packaging_factor = random.uniform(1.2, 1.4)    # Electronics often have extra protection
    elif category == "clothing":
        packaging_factor = random.uniform(1.1, 1.2)    # Clothing can be compressed
    elif category == "books":
        packaging_factor = random.uniform(1.05, 1.15)  # Books have standardized packaging
    elif category == "beauty":
        packaging_factor = random.uniform(1.3, 1.5)    # Beauty products often have fancy packaging
    else:
        packaging_factor = random.uniform(1.1, 1.3)    # Default packaging factor
    
    # Calculate packaging dimensions
    packaging_dimensions = {
        'length': dimensions['length'] * packaging_factor,
        'width': dimensions['width'] * packaging_factor,
        'height': dimensions['height'] * packaging_factor
    }
    
    # Calculate packaging volume
    product_volume = dimensions['length'] * dimensions['width'] * dimensions['height']
    packaging_volume = packaging_dimensions['length'] * packaging_dimensions['width'] * packaging_dimensions['height']
    
    # Calculate packaging efficiency (how much of the package is the product)
    packaging_efficiency = (product_volume / packaging_volume) * 100
    
    return packaging_dimensions, packaging_volume, packaging_efficiency

def calculate_packaging_weight(weight_g, category, packaging_volume):
    """
    Calculate packaging weight based on product weight, category, and packaging volume
    
    Returns:
        float: packaging_weight_g
    """
    # Different packaging weight factors based on product category
    if category == "large_appliance":
        packaging_weight_factor = random.uniform(0.05, 0.15)  # 5-15% of product weight
    elif category == "furniture":
        packaging_weight_factor = random.uniform(0.1, 0.2)    # 10-20% of product weight
    elif category == "electronics":
        packaging_weight_factor = random.uniform(0.15, 0.3)   # 15-30% of product weight
    elif category == "books":
        packaging_weight_factor = random.uniform(0.05, 0.1)   # 5-10% of product weight
    elif category == "clothing":
        packaging_weight_factor = random.uniform(0.1, 0.2)    # 10-20% of product weight
    else:
        packaging_weight_factor = random.uniform(0.1, 0.25)   # 10-25% of product weight
    
    # Calculate packaging weight
    packaging_weight_g = weight_g * packaging_weight_factor
    
    # Ensure minimum packaging weight based on volume
    min_packaging_weight = packaging_volume / 1000  # 1g per 1000 cubic cm as minimum
    packaging_weight_g = max(packaging_weight_g, min_packaging_weight)
    
    return packaging_weight_g

# For backward compatibility
get_product_data_from_catalog = get_simulated_product_data
