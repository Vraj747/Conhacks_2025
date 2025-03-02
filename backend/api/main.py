import sys
import os
import traceback
import logging
import time
import json
import re
import random
import hashlib
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('api.log')
    ]
)
logger = logging.getLogger(__name__)

# Fix import paths
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from flask import Flask, jsonify, request
from flask_cors import CORS
from backend.scraper.product_scraper import scrape_product_data
from backend.scraper.secondhand_scraper import find_secondhand_alternatives
from backend.api.packaging_materials import get_packaging_materials_by_category, calculate_carbon_footprint, calculate_water_usage
from backend.api.catalog_api import get_simulated_product_data
from backend.api.utils import extract_main_product_name

app = Flask(__name__)
# Enable CORS for all routes
CORS(app)

def extract_product_dimensions(product_data):
    """Extract product dimensions from product data"""
    description = product_data.get('description', '').lower()
    details = product_data.get('details', {})
    title = product_data.get('title', '').lower()
    
    logger.info(f"Extracting dimensions for product: {product_data.get('title', 'Unknown')}")
    logger.info(f"Details available: {bool(details)}, Description length: {len(description)}")
    
    # Look for dimensions in product details
    dimensions_str = None
    dimension_keywords = ['dimensions', 'size', 'package dimensions', 'product dimensions', 'item dimensions', 'Product Dimensions']
    
    # Check in structured details first
    if isinstance(details, dict):
        logger.info(f"Detail keys: {list(details.keys())}")
        for key in details:
            if any(keyword in key.lower() for keyword in dimension_keywords):
                dimensions_str = details[key]
                logger.info(f"Found dimensions in details: {dimensions_str}")
                break
    
    # If not found, try to extract from description using regex
    if not dimensions_str:
        logger.info("No dimensions found in details, searching in description")
        # Look for patterns like "10 x 8 x 2 inches" or "10 x 8 x 2 cm"
        dimension_patterns = [
            r'(\d+\.?\d*)\s*x\s*(\d+\.?\d*)\s*x\s*(\d+\.?\d*)\s*(inches|in|cm|mm)',
            r'dimensions:\s*(\d+\.?\d*)\s*x\s*(\d+\.?\d*)\s*x\s*(\d+\.?\d*)',
            r'size:\s*(\d+\.?\d*)\s*x\s*(\d+\.?\d*)\s*x\s*(\d+\.?\d*)',
            r'(\d+\.?\d*)\s*inches\s*x\s*(\d+\.?\d*)\s*inches\s*x\s*(\d+\.?\d*)\s*inches',
            r'(\d+\.?\d*)\s*cm\s*x\s*(\d+\.?\d*)\s*cm\s*x\s*(\d+\.?\d*)\s*cm',
            r'(\d+\.?\d*)\s*"\s*x\s*(\d+\.?\d*)\s*"\s*x\s*(\d+\.?\d*)\s*"'
        ]
        
        for pattern in dimension_patterns:
            match = re.search(pattern, description, re.IGNORECASE)
            if match:
                # Extract the dimensions and unit
                if len(match.groups()) >= 4:
                    length, width, height, unit = match.groups()
                else:
                    length, width, height = match.groups()
                    unit = 'inches'  # Default unit
                
                dimensions_str = f"{length} x {width} x {height} {unit}"
                logger.info(f"Found dimensions in description: {dimensions_str}")
                break
    
    # If still not found, check the title for common product sizes
    if not dimensions_str:
        logger.info("No dimensions found in description, checking title for size indicators")
        
        # Check for TV/monitor sizes like "50-inch", "32 inch", "24\"", etc.
        tv_size_pattern = r'(\d+)[\s-]*(inch|in|\"|\'\')'
        tv_match = re.search(tv_size_pattern, title, re.IGNORECASE)
        if tv_match:
            size = tv_match.group(1)
            # Estimate dimensions based on TV size (diagonal)
            # Typical 16:9 aspect ratio TV
            diagonal = float(size)
            width = 0.87 * diagonal  # Width is about 87% of diagonal in 16:9
            height = 0.49 * diagonal  # Height is about 49% of diagonal in 16:9
            depth = 2  # Assume 2 inches depth for modern TVs
            
            dimensions_str = f"{width:.1f} x {height:.1f} x {depth} inches"
            logger.info(f"Estimated TV dimensions from {size}-inch diagonal: {dimensions_str}")
            return dimensions_str
        
        # Check for specific product categories and assign typical dimensions
        if 'headphones' in title or 'headset' in title or 'earphones' in title:
            dimensions_str = "8 x 7 x 3 inches"  # Typical headphone box
            logger.info(f"Using typical dimensions for headphones: {dimensions_str}")
            return dimensions_str
        
        if 'earbuds' in title or 'airpods' in title:
            dimensions_str = "3 x 2 x 1 inches"  # Typical earbuds box
            logger.info(f"Using typical dimensions for earbuds: {dimensions_str}")
            return dimensions_str
        
        if 'laptop' in title:
            if '17 inch' in title or '17"' in title:
                dimensions_str = "16.5 x 11 x 2 inches"
            elif '15 inch' in title or '15"' in title:
                dimensions_str = "14.5 x 10 x 1.5 inches"
            elif '13 inch' in title or '13"' in title:
                dimensions_str = "12.5 x 8.5 x 1 inches"
            else:
                dimensions_str = "14 x 10 x 2 inches"  # Default laptop size
            
            logger.info(f"Using typical dimensions for laptop: {dimensions_str}")
            return dimensions_str
    
    if not dimensions_str:
        logger.warning("No dimensions found for product")
    
    return dimensions_str

def calculate_package_size(dimensions_str):
    """Calculate Amazon package size based on product dimensions"""
    if not dimensions_str:
        logger.info("No dimensions found, using default package size")
        return "unknown"
        
    # Extract numeric dimensions and unit
    match = re.search(r'(\d+\.?\d*)\s*x\s*(\d+\.?\d*)\s*x\s*(\d+\.?\d*)\s*(inches|in|cm|mm)?', dimensions_str, re.IGNORECASE)
    if not match:
        logger.info(f"Could not parse dimensions: {dimensions_str}")
        return "unknown"
    
    # Parse dimensions
    try:
        length = float(match.group(1))
        width = float(match.group(2))
        height = float(match.group(3))
        unit = match.group(4) if len(match.groups()) >= 4 else 'inches'
        
        # Convert to inches if needed
        if unit and unit.lower() in ['cm', 'centimeters']:
            length /= 2.54
            width /= 2.54
            height /= 2.54
        elif unit and unit.lower() in ['mm', 'millimeters']:
            length /= 25.4
            width /= 25.4
            height /= 25.4
        
        # Sort dimensions (Amazon will use the most efficient orientation)
        dimensions = sorted([length, width, height], reverse=True)
        length, width, height = dimensions
        
        # Calculate volume in cubic inches
        volume = length * width * height
        
        # Amazon standard package sizes (approximate)
        # Format: name, max_length, max_width, max_height, volume
        amazon_packages = [
            ("Small Envelope", 11.5, 6.0, 0.25, 17.25),  # For documents, thin items
            ("Standard Envelope", 15.0, 12.0, 0.75, 135.0),  # For small flat items
            ("Small Box", 8.5, 5.5, 1.5, 70.125),  # For small items
            ("Standard Box", 14.0, 11.0, 2.0, 308.0),  # Common box size
            ("Medium Box", 17.0, 11.0, 5.5, 1028.5),  # Medium items
            ("Large Box", 18.0, 14.0, 8.0, 2016.0),  # Larger items
            ("Extra Large Box", 24.0, 18.0, 16.0, 6912.0)  # Very large items
        ]
        
        # Find the smallest package that fits the item
        for package_name, pkg_length, pkg_width, pkg_height, pkg_volume in amazon_packages:
            if length <= pkg_length and width <= pkg_width and height <= pkg_height:
                logger.info(f"Selected package size: {package_name} for dimensions {dimensions_str}")
                return package_name
        
        # If no standard package fits, it's an oversized item
        logger.info(f"Item is oversized for dimensions {dimensions_str}")
        return "Oversized"
    except Exception as e:
        logger.error(f"Error calculating package size: {str(e)}")
        return "unknown"

def get_product_data_from_catalog(product_data):
    """
    Generate simulated product data for packaging impact calculation
    
    This function creates realistic product data based on the product title,
    description, and other available information. It simulates what would be
    returned by Amazon's Product Advertising API in a production environment.
    """
    try:
        logger.info(f"Generating simulated catalog data for: {product_data.get('title', 'Unknown Product')}")
        
        # Use the simulated product data function
        return get_simulated_product_data(product_data)
        
    except Exception as e:
        logger.error(f"Error generating simulated product data: {str(e)}")
        logger.error(traceback.format_exc())
        return None

def calculate_packaging_impact(product_data):
    """
    Calculate the environmental impact of product packaging based on product dimensions
    Returns a dictionary with packaging impact metrics
    
    This function uses simulated product data to calculate packaging impact metrics.
    """
    try:
        logger.info(f"Calculating packaging impact for: {product_data.get('title', 'Unknown Product')}")
        
        # Default values
        packaging_impact = {
            "materials": ["Cardboard", "Plastic"],
            "waste_weight_g": 200,
            "recyclability_score": 65,
            "carbon_footprint_g": 300,
            "water_usage_l": 15,
            "impact_score": 50,  # Default neutral score
            "impact_level": "Medium",
            "impact_factors": ["Estimated based on product category"]
        }
        
        # Get product data from catalog API (simulated or real)
        catalog_data = get_product_data_from_catalog(product_data)
        
        if not catalog_data:
            logger.warning("Could not get catalog data, using fallback method")
            # Use the existing dimension extraction as fallback
            dimensions_str = extract_product_dimensions(product_data)
            package_size = calculate_package_size(dimensions_str)
            
            # Determine materials based on package size
            if package_size == "Small Envelope":
                packaging_impact["materials"] = ["Paper envelope"]
                packaging_impact["waste_weight_g"] = 10
                packaging_impact["carbon_footprint_g"] = 20
                packaging_impact["water_usage_l"] = 2
                packaging_impact["recyclability_score"] = 85
            elif package_size == "Standard Envelope":
                packaging_impact["materials"] = ["Cardboard envelope", "Plastic film"]
                packaging_impact["waste_weight_g"] = 30
                packaging_impact["carbon_footprint_g"] = 50
                packaging_impact["water_usage_l"] = 4
                packaging_impact["recyclability_score"] = 75
            elif package_size == "Small Box":
                packaging_impact["materials"] = ["Cardboard", "Paper filler"]
                packaging_impact["waste_weight_g"] = 75
                packaging_impact["carbon_footprint_g"] = 100
                packaging_impact["water_usage_l"] = 6
                packaging_impact["recyclability_score"] = 80
            elif package_size == "Medium Box":
                packaging_impact["materials"] = ["Cardboard", "Air pillows", "Plastic film"]
                packaging_impact["waste_weight_g"] = 300
                packaging_impact["carbon_footprint_g"] = 400
                packaging_impact["water_usage_l"] = 15
                packaging_impact["recyclability_score"] = 65
            elif package_size == "Large Box" or package_size == "Extra Large Box":
                packaging_impact["materials"] = ["Cardboard", "Air pillows", "Plastic film", "Tape"]
                packaging_impact["waste_weight_g"] = 600
                packaging_impact["carbon_footprint_g"] = 800
                packaging_impact["water_usage_l"] = 30
                packaging_impact["recyclability_score"] = 60
            elif package_size == "Oversized":
                packaging_impact["materials"] = ["Cardboard", "Air pillows", "Plastic film", "Tape", "Styrofoam"]
                packaging_impact["waste_weight_g"] = 1000
                packaging_impact["carbon_footprint_g"] = 1300
                packaging_impact["water_usage_l"] = 50
                packaging_impact["recyclability_score"] = 50
        else:
            # Use catalog data for more accurate impact calculation
            packaging_impact["waste_weight_g"] = catalog_data["packaging_weight_g"]
            
            # Get materials based on product category
            category = catalog_data.get("category", "unknown")
            materials_data = get_packaging_materials_by_category(category, product_data)
            
            packaging_impact["materials"] = materials_data["materials"]
            packaging_impact["recyclability_score"] = materials_data["recyclability_score"]
            
            # Special handling for large appliances
            if category == "large_appliance":
                # Ensure minimum values for large appliances
                packaging_impact["waste_weight_g"] = max(packaging_impact["waste_weight_g"], 5000)  # At least 5kg of packaging
                
                # Add specific impact factors
                packaging_impact["impact_factors"].append("Large appliance with substantial packaging")
                packaging_impact["impact_factors"].append("Requires special disposal considerations")
            
            # Calculate carbon footprint using our specialized function
            packaging_impact["carbon_footprint_g"] = calculate_carbon_footprint(
                packaging_impact["materials"], 
                packaging_impact["waste_weight_g"]
            )
            
            # Calculate water usage using our specialized function
            packaging_impact["water_usage_l"] = calculate_water_usage(
                packaging_impact["materials"], 
                packaging_impact["waste_weight_g"]
            )
            
            # Adjust recyclability based on packaging efficiency
            if "packaging_efficiency" in catalog_data:
                efficiency_factor = (catalog_data["packaging_efficiency"] - 50) / 5
                packaging_impact["recyclability_score"] = min(100, max(0, packaging_impact["recyclability_score"] + efficiency_factor))
        
        # Calculate impact score based on materials, waste weight, and recyclability
        # Start with a base score of 100 (best possible)
        impact_score = 100
        
        # Deduct points based on waste weight - more waste = lower score
        # Each 25g of waste reduces score by 5 points
        waste_penalty = (packaging_impact["waste_weight_g"] / 25) * 5
        impact_score -= waste_penalty
        logger.info(f"After waste penalty (-{waste_penalty:.1f}): {impact_score:.1f}")
        
        # Adjust for carbon footprint - higher footprint = lower score
        # Each 25g of CO2 reduces score by 3 points
        carbon_penalty = (packaging_impact["carbon_footprint_g"] / 25) * 3
        impact_score -= carbon_penalty
        logger.info(f"After carbon penalty (-{carbon_penalty:.1f}): {impact_score:.1f}")
        
        # Adjust for water usage - higher usage = lower score
        # Each 2.5L of water reduces score by 3 points
        water_penalty = (packaging_impact["water_usage_l"] / 2.5) * 3
        impact_score -= water_penalty
        logger.info(f"After water penalty (-{water_penalty:.1f}): {impact_score:.1f}")
        
        # Adjust for recyclability - higher recyclability = higher score
        # Scale from -15 to +15 points based on recyclability score
        recyclability_adjustment = ((packaging_impact["recyclability_score"] - 50) / 50) * 15
        impact_score += recyclability_adjustment
        logger.info(f"After recyclability adjustment ({recyclability_adjustment:+.1f}): {impact_score:.1f}")
        
        # Special handling for large items
        if catalog_data and catalog_data.get("category") in ["large_appliance", "furniture", "tv"]:
            # Apply additional penalty for large items
            size_penalty = 20
            impact_score -= size_penalty
            logger.info(f"Applied large item penalty (-{size_penalty}): {impact_score:.1f}")
            packaging_impact["impact_factors"].append("Large item with significant packaging impact")
        
        # If we have catalog data, add packaging efficiency factor
        if catalog_data and "packaging_efficiency" in catalog_data:
            efficiency = catalog_data["packaging_efficiency"]
            if efficiency > 80:
                impact_score += 15
                logger.info(f"Applied high efficiency bonus (+15): {impact_score:.1f}")
                packaging_impact["impact_factors"].append("Efficient packaging design")
            elif efficiency < 30:
                impact_score -= 15
                logger.info(f"Applied low efficiency penalty (-15): {impact_score:.1f}")
                packaging_impact["impact_factors"].append("Inefficient packaging design")
        
        # Check for eco-friendly packaging keywords in description
        description = product_data.get('description', '').lower()
        eco_packaging_keywords = [
            'recyclable packaging', 'plastic-free packaging', 'sustainable packaging',
            'minimal packaging', 'eco-friendly packaging', 'biodegradable packaging',
            'compostable packaging', 'recycled packaging', 'frustration-free packaging'
        ]
        
        for keyword in eco_packaging_keywords:
            if keyword in description:
                impact_score += 10
                packaging_impact["impact_factors"].append(f"Product mentions {keyword}")
                logger.info(f"Found eco-friendly packaging mention: {keyword}, adding 10 points")
                break  # Only apply bonus once
        
        # Ensure score is within 0-100 range
        packaging_impact["impact_score"] = max(0, min(round(impact_score), 100))
        logger.info(f"Final impact score (clamped to 0-100): {packaging_impact['impact_score']}")
        
        # Update impact level based on final score
        if packaging_impact["impact_score"] >= 75:
            packaging_impact["impact_level"] = "Low"
        elif packaging_impact["impact_score"] >= 50:
            packaging_impact["impact_level"] = "Medium"
        else:
            packaging_impact["impact_level"] = "High"
        
        # Add catalog data source if available
        if catalog_data:
            packaging_impact["impact_factors"].insert(0, "Based on simulated Amazon catalog data")
                
            if "packaging_efficiency" in catalog_data:
                packaging_impact["impact_factors"].append(f"Packaging efficiency: {catalog_data['packaging_efficiency']}%")
            if catalog_data.get("category"):
                packaging_impact["impact_factors"].append(f"Product category: {catalog_data['category']}")
        
        logger.info(f"Calculated packaging impact score: {packaging_impact['impact_score']} with level: {packaging_impact['impact_level']}")
        logger.info(f"Impact factors: {packaging_impact['impact_factors']}")
        return packaging_impact
        
    except Exception as e:
        logger.error(f"Error calculating packaging impact: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "materials": ["Cardboard", "Plastic"],
            "waste_weight_g": 200,
            "recyclability_score": 65,
            "carbon_footprint_g": 300,
            "water_usage_l": 15,
            "impact_score": 50,
            "impact_level": "Medium",
            "impact_factors": ["Error calculating detailed packaging impact"]
        }

# Sustainability Metric Calculation
def calculate_sustainability_metric(product_data):
    """
    Calculate sustainability metrics for a product based on various factors.
    Returns a score (0-100) and factors that influenced the score.
    """
    try:
        logger.info(f"Calculating sustainability metrics for: {product_data.get('title', 'Unknown Product')}")
        
        # Default values if calculation fails
        default_score = 50
        default_factors = ["Limited product information available"]
        
        # Extract product information
        title = product_data.get('title', '').lower()
        description = product_data.get('description', '').lower()
        brand = product_data.get('brand', '').lower()
        
        if not title:
            logger.warning("No product title available for sustainability calculation")
            return default_score, default_factors
        
        # Initialize score and factors
        score = 50  # Start with neutral score
        factors = []
        
        # Check for sustainable brands
        sustainable_brands = [
            'patagonia', 'everlane', 'reformation', 'allbirds', 'fairphone', 
            'framework', 'house of marley', 'west elm', 'avocado', 'coyuchi',
            'lush', 'beautycounter', 'ethique', 'seventh generation', 'method',
            'pela', 'nimble', 'thrive market', 'imperfect foods', 'dr. bronner'
        ]
        
        if any(b in brand for b in sustainable_brands):
            score += 25
            factors.append("Sustainable brand")
            logger.info(f"Identified sustainable brand: {brand}")
        
        # Check for eco-friendly keywords in title and description
        eco_keywords = [
            'sustainable', 'eco-friendly', 'organic', 'recycled', 'upcycled',
            'biodegradable', 'compostable', 'fair trade', 'ethical', 'green',
            'natural', 'renewable', 'energy efficient', 'water saving', 'low impact'
        ]
        
        eco_count = 0
        for keyword in eco_keywords:
            if keyword in title or keyword in description:
                eco_count += 1
        
        if eco_count > 0:
            score += min(eco_count * 5, 20)  # Max 20 points for eco keywords
            factors.append(f"Contains {eco_count} eco-friendly features")
            logger.info(f"Found {eco_count} eco-friendly keywords")
        
        # Check for negative keywords
        negative_keywords = [
            'single-use', 'disposable', 'plastic', 'non-recyclable', 'petroleum',
            'chemical', 'toxic', 'harmful', 'polluting', 'wasteful', 'fast fashion'
        ]
        
        negative_count = 0
        for keyword in negative_keywords:
            if keyword in title or keyword in description:
                negative_count += 1
        
        if negative_count > 0:
            score -= min(negative_count * 5, 20)  # Max 20 points deduction
            factors.append(f"Contains {negative_count} non-sustainable features")
            logger.info(f"Found {negative_count} negative sustainability keywords")
        
        # Check for electronics (generally less sustainable)
        electronics_keywords = ['phone', 'laptop', 'computer', 'tablet', 'tv', 'electronic']
        if any(keyword in title for keyword in electronics_keywords):
            score -= 10
            factors.append("Electronic product (higher environmental impact)")
            logger.info("Identified as electronic product")
        
        # Check for second-hand/refurbished (more sustainable)
        secondhand_keywords = ['used', 'refurbished', 'renewed', 'pre-owned', 'second hand', 'secondhand']
        if any(keyword in title for keyword in secondhand_keywords):
            score += 20
            factors.append("Second-hand or refurbished product")
            logger.info("Identified as second-hand product")
        
        # Ensure score is within 0-100 range
        score = max(0, min(score, 100))
        
        # If no factors were identified, add a default one
        if not factors:
            factors.append("Based on general product assessment")
        
        logger.info(f"Calculated sustainability score: {score} with factors: {factors}")
        return score, factors
        
    except Exception as e:
        logger.error(f"Error calculating sustainability metrics: {str(e)}")
        logger.error(traceback.format_exc())
        return default_score, default_factors

def find_alternatives(product_data):
    """
    Find alternative products based on the product data.
    
    Args:
        product_data (dict): The product data including title, description, etc.
        
    Returns:
        list: A list of alternative products
    """
    try:
        title = product_data.get('title', '')
        if not title:
            logger.warning("No title provided for finding alternatives")
            return []
        
        # Extract the main product name instead of using the full title
        search_term = extract_main_product_name(title)
        logger.info(f"Searching for alternatives using term: '{search_term}'")
        
        # Simulate alternative products
        alternatives = []
        seed_value = search_term
        random.seed(int(hashlib.md5(seed_value.encode()).hexdigest(), 16) % (2**32))
        
        # Generate 3-5 alternatives
        num_alternatives = random.randint(3, 5)
        
        for i in range(num_alternatives):
            # Create a simulated alternative with slight variations
            alt_title = f"Alternative {i+1} for {search_term}"
            alt_price = round(random.uniform(0.7, 1.3) * product_data.get('price', 100), 2)
            
            alternative = {
                'title': alt_title,
                'url': f"https://example.com/product/{i}",
                'price': alt_price,
                'rating': round(random.uniform(3.0, 5.0), 1),
                'reviews': random.randint(10, 1000),
                'image_url': f"https://example.com/images/{i}.jpg",
                'is_simulated': True
            }
            alternatives.append(alternative)
        
        return alternatives
    except Exception as e:
        logger.error(f"Error finding alternatives: {str(e)}")
        return []

@app.route('/api/analyze', methods=['POST'])
def analyze_product():
    try:
        data = request.get_json()
        
        if not data or 'url' not in data:
            return jsonify({"error": "Missing URL parameter"}), 400
            
        url = data['url']
        
        # Log the request
        app.logger.info(f"Analyzing product URL: {url}")
        
        start_time = time.time()
        
        # Extract product information
        product_info = scrape_product_data(url)
        
        if not product_info:
            return jsonify({"error": "Could not extract product information"}), 400
            
        # Find second-hand alternatives
        product_name = product_info.get('title', '')
        if not product_name:
            return jsonify({"error": "Could not extract product name"}), 400
            
        secondhand_alternatives = find_secondhand_alternatives(product_name, max_results=6)
        
        # Calculate eco-factors
        eco_factors = calculate_sustainability_metric(product_info)
        
        # Calculate packaging impact
        packaging_impact = calculate_packaging_impact(product_info)
        
        # Add alternatives, eco-factors, and packaging impact to the response
        product_info['secondhand_alternatives'] = secondhand_alternatives
        product_info['eco_factors'] = eco_factors
        product_info['packaging_impact'] = packaging_impact
        
        # Calculate processing time
        processing_time = time.time() - start_time
        product_info['processing_time'] = f"{processing_time:.2f} seconds"
        
        return jsonify(product_info)
        
    except Exception as e:
        app.logger.error(f"Error analyzing product: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({"error": f"Could not analyze this product. Please make sure the backend server is running. Error: {str(e)}"}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint to verify the API is running.
    """
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    })

if __name__ == "_main_":
    logger.info("Starting Do I Need That? API server")
    app.run(debug=True, host='127.0.0.1',port=8000)
