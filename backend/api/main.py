import sys
import os
import traceback
import logging
import time
import json
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

app = Flask(__name__)
# Enable CORS for all routes
CORS(app)

def calculate_packaging_impact(product_data):
    """
    Calculate the environmental impact of product packaging
    Returns a dictionary with packaging impact metrics
    """
    try:
        logger.info(f"Calculating packaging impact for: {product_data.get('title', 'Unknown Product')}")
        
        # Default values
        packaging_impact = {
            "materials": [],
            "waste_weight_g": 0,
            "recyclability_score": 0,
            "carbon_footprint_g": 0,
            "water_usage_l": 0,
            "impact_score": 50,  # Default neutral score
            "impact_level": "Medium",
            "impact_factors": ["Estimated based on product category and size"]
        }
        
        # Extract product information
        title = product_data.get('title', '').lower()
        description = product_data.get('description', '').lower()
        category = product_data.get('category', '').lower()
        
        # Determine product category if not provided
        if not category:
            electronics_keywords = ['phone', 'laptop', 'computer', 'tablet', 'tv', 'electronic', 'headphone', 'earbud', 'camera']
            clothing_keywords = ['shirt', 'pants', 'dress', 'jacket', 'sweater', 'hoodie', 'jeans', 'shoes', 'boots', 'hat']
            home_keywords = ['chair', 'table', 'desk', 'sofa', 'bed', 'mattress', 'pillow', 'blanket', 'lamp', 'rug']
            beauty_keywords = ['makeup', 'skincare', 'lotion', 'shampoo', 'conditioner', 'soap', 'perfume']
            food_keywords = ['coffee', 'tea', 'snack', 'chocolate', 'cereal', 'food']
            
            if any(keyword in title for keyword in electronics_keywords):
                category = 'electronics'
            elif any(keyword in title for keyword in clothing_keywords):
                category = 'clothing'
            elif any(keyword in title for keyword in home_keywords):
                category = 'home'
            elif any(keyword in title for keyword in beauty_keywords):
                category = 'beauty'
            elif any(keyword in title for keyword in food_keywords):
                category = 'food'
            else:
                category = 'other'
        
        # Estimate packaging materials based on category
        if category == 'electronics':
            packaging_impact["materials"] = ["Cardboard", "Plastic", "Foam"]
            packaging_impact["waste_weight_g"] = 250
            packaging_impact["recyclability_score"] = 60
            packaging_impact["carbon_footprint_g"] = 500
            packaging_impact["water_usage_l"] = 20
            packaging_impact["impact_score"] = 30
            packaging_impact["impact_level"] = "High"
            packaging_impact["impact_factors"] = [
                "Electronics typically use mixed materials that are harder to recycle",
                "Protective foam packaging has high environmental impact",
                "Plastic film and ties contribute to waste"
            ]
        elif category == 'clothing':
            packaging_impact["materials"] = ["Plastic bag", "Cardboard tags"]
            packaging_impact["waste_weight_g"] = 50
            packaging_impact["recyclability_score"] = 40
            packaging_impact["carbon_footprint_g"] = 100
            packaging_impact["water_usage_l"] = 5
            packaging_impact["impact_score"] = 40
            packaging_impact["impact_level"] = "Medium"
            packaging_impact["impact_factors"] = [
                "Plastic polybags are often not recycled",
                "Multiple clothing items may be individually wrapped"
            ]
        elif category == 'home':
            packaging_impact["materials"] = ["Cardboard", "Plastic", "Styrofoam"]
            packaging_impact["waste_weight_g"] = 500
            packaging_impact["recyclability_score"] = 70
            packaging_impact["carbon_footprint_g"] = 800
            packaging_impact["water_usage_l"] = 30
            packaging_impact["impact_score"] = 25
            packaging_impact["impact_level"] = "High"
            packaging_impact["impact_factors"] = [
                "Large items require substantial packaging materials",
                "Styrofoam protection is difficult to recycle",
                "Multiple cardboard layers for protection"
            ]
        elif category == 'beauty':
            packaging_impact["materials"] = ["Plastic", "Cardboard", "Paper"]
            packaging_impact["waste_weight_g"] = 100
            packaging_impact["recyclability_score"] = 50
            packaging_impact["carbon_footprint_g"] = 200
            packaging_impact["water_usage_l"] = 10
            packaging_impact["impact_score"] = 45
            packaging_impact["impact_level"] = "Medium"
            packaging_impact["impact_factors"] = [
                "Mixed material packaging (plastic and cardboard)",
                "Small items often over-packaged for presentation"
            ]
        elif category == 'food':
            packaging_impact["materials"] = ["Cardboard", "Plastic film"]
            packaging_impact["waste_weight_g"] = 150
            packaging_impact["recyclability_score"] = 80
            packaging_impact["carbon_footprint_g"] = 150
            packaging_impact["water_usage_l"] = 8
            packaging_impact["impact_score"] = 60
            packaging_impact["impact_level"] = "Medium"
            packaging_impact["impact_factors"] = [
                "Food packaging is typically recyclable cardboard",
                "May include plastic film that's harder to recycle"
            ]
        else:
            packaging_impact["materials"] = ["Cardboard", "Plastic"]
            packaging_impact["waste_weight_g"] = 200
            packaging_impact["recyclability_score"] = 65
            packaging_impact["carbon_footprint_g"] = 300
            packaging_impact["water_usage_l"] = 15
            packaging_impact["impact_score"] = 50
            packaging_impact["impact_level"] = "Medium"
            packaging_impact["impact_factors"] = [
                "Standard Amazon packaging with cardboard and air pillows",
                "Mixed recyclability of materials"
            ]
        
        # Check for eco-friendly packaging keywords in description
        eco_packaging_keywords = [
            'recyclable packaging', 'plastic-free packaging', 'sustainable packaging',
            'minimal packaging', 'eco-friendly packaging', 'biodegradable packaging',
            'compostable packaging', 'recycled packaging', 'frustration-free packaging'
        ]
        
        for keyword in eco_packaging_keywords:
            if keyword in description:
                packaging_impact["impact_score"] += 15
                packaging_impact["recyclability_score"] += 20
                packaging_impact["impact_factors"].append(f"Product mentions {keyword}")
                logger.info(f"Found eco-friendly packaging mention: {keyword}")
                break  # Only apply bonus once
        
        # Check for excessive packaging keywords
        excessive_packaging_keywords = [
            'box in box', 'multiple boxes', 'excessive packaging',
            'over packaged', 'too much packaging'
        ]
        
        # Look for these keywords in reviews if available
        reviews = product_data.get('reviews', [])
        review_text = ' '.join(reviews).lower() if reviews else ''
        
        for keyword in excessive_packaging_keywords:
            if keyword in review_text or keyword in description:
                packaging_impact["impact_score"] -= 15
                packaging_impact["impact_factors"].append(f"Reviews mention {keyword}")
                logger.info(f"Found excessive packaging mention: {keyword}")
                break  # Only apply penalty once
        
        # Ensure score is within 0-100 range
        packaging_impact["impact_score"] = max(0, min(packaging_impact["impact_score"], 100))
        
        # Update impact level based on final score
        if packaging_impact["impact_score"] >= 75:
            packaging_impact["impact_level"] = "Low"
        elif packaging_impact["impact_score"] >= 50:
            packaging_impact["impact_level"] = "Medium"
        else:
            packaging_impact["impact_level"] = "High"
        
        logger.info(f"Calculated packaging impact score: {packaging_impact['impact_score']} with level: {packaging_impact['impact_level']}")
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

if __name__ == "__main__":
    logger.info("Starting Do I Need That? API server")
    app.run(debug=True, host='127.0.0.1', port=8000)