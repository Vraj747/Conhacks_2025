import sys
import os
# Fix import paths
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from flask import Flask, jsonify, request
from flask_cors import CORS
from backend.scraper.product_scraper import scrape_product_data

app = Flask(__name__)
# Enable CORS for all routes
CORS(app)

# Sustainability Metric Calculation
def calculate_sustainability_metric(product_data):
    """
    Calculate sustainability score based on product data.
    
    Returns a score from 0-100 and explanatory factors.
    """
    score = 50  # Default neutral score
    factors = []
    
    # Brand reputation check
    if product_data.get("brand"):
        brand = product_data["brand"].lower()
        sustainable_brands = ["patagonia", "allbirds", "tentree", "everlane", "pact"]
        fast_fashion_brands = ["shein", "fashion nova", "boohoo", "prettylittlething"]
        
        if any(b in brand for b in sustainable_brands):
            score += 15
            factors.append("Sustainable brand reputation")
        elif any(b in brand for b in fast_fashion_brands):
            score -= 15
            factors.append("Fast fashion brand")
    
    # Check product description for sustainable materials
    if product_data.get("description"):
        description = product_data["description"].lower()
        
        sustainable_terms = [
            "organic", "recycled", "biodegradable", "compostable", "eco-friendly",
            "sustainable", "fair trade", "renewable", "bamboo", "hemp"
        ]
        
        negative_terms = [
            "polyester", "acrylic", "nylon", "synthetic", "plastic"
        ]
        
        found_sustainable = False
        for term in sustainable_terms:
            if term in description:
                score += 10
                factors.append(f"Uses {term} materials")
                found_sustainable = True
                break
                
        if not found_sustainable:
            for term in negative_terms:
                if term in description:
                    score -= 10
                    factors.append(f"Uses {term} (less sustainable material)")
                    break
    
    # Price factor - very low price often indicates unsustainable production
    if product_data.get("price"):
        try:
            price_value = float(product_data["price"].replace("$", "").replace(",", ""))
            if price_value < 10:
                score -= 10
                factors.append("Very low price indicates potential sustainability concerns")
        except:
            pass  # Skip price analysis if price can't be parsed
    
    # Cap score between 0 and 100
    score = max(0, min(100, score))
    
    return {
        "score": score,
        "factors": factors,
        "level": "high" if score >= 75 else "medium" if score >= 50 else "low"
    }

@app.route('/api/product/analyze', methods=['GET'])
def analyze_product():
    """
    Analyze a product page and return product details with sustainability metrics.
    
    Query Parameters:
        url (string): The URL of the product page to analyze
    
    Returns:
        JSON: Product information with sustainability metrics
    """
    product_url = request.args.get('url')
    
    if not product_url:
        return jsonify({'error': 'Missing URL parameter'}), 400
    
    # Call the scraping function to get product data
    product_data = scrape_product_data(product_url)
    
    if "error" in product_data:
        return jsonify(product_data), 500
    
    # Calculate sustainability metrics
    sustainability = calculate_sustainability_metric(product_data)
    
    # Find similar products that are more sustainable (placeholder)
    alternatives = [
        {
            "title": "Eco-friendly alternative",
            "price": product_data.get("price", "$0.00"), 
            "source": "EcoStore",
            "sustainability_score": min(sustainability["score"] + 30, 100),
            "url": "https://example.com/eco-product"
        },
        {
            "title": "Second-hand option",
            "price": f"${float(product_data.get('price', '$0').replace('$', '').replace(',', '')) * 0.5:.2f}",
            "source": "ThriftShop",
            "sustainability_score": min(sustainability["score"] + 40, 100),
            "url": "https://example.com/used-product" 
        }
    ]
    
    # Combine all data for response
    response_data = {
        "product": {
            "title": product_data.get("title", ""),
            "price": product_data.get("price", ""),
            "image_url": product_data.get("image_url", ""),
            "rating": product_data.get("rating", ""),
            "brand": product_data.get("brand", ""),
            "description": product_data.get("description", "")[:200] + "..." if product_data.get("description") else "",
        },
        "sustainability": {
            "score": sustainability["score"],
            "level": sustainability["level"],
            "factors": sustainability["factors"]
        },
        "alternatives": alternatives
    }
    
    return jsonify(response_data), 200

@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({"status": "ok"}), 200

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)