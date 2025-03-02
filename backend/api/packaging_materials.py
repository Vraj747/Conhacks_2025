import logging

logger = logging.getLogger(__name__)

def get_packaging_materials_by_category(category, product_data):
    """
    Get packaging materials based on product category and data
    In a production environment, this would use real data from Amazon's API
    """
    # Default packaging materials
    default_materials = {
        "materials": ["Cardboard", "Plastic film"],
        "recyclability_score": 65
    }
    
    # Category-specific packaging materials based on Amazon's typical packaging practices
    category_materials = {
        "large_appliance": {
            "materials": ["Cardboard", "Styrofoam", "Plastic film", "Metal straps", "Wood pallet"],
            "recyclability_score": 40  # Lower recyclability due to mixed materials
        },
        "tv": {
            "materials": ["Cardboard", "Styrofoam corners", "Plastic film", "Cable ties"],
            "recyclability_score": 55
        },
        "furniture": {
            "materials": ["Cardboard", "Styrofoam", "Plastic film", "Tape", "Bubble wrap"],
            "recyclability_score": 50
        },
        "electronics": {
            "materials": ["Cardboard", "Molded pulp", "Plastic film", "Anti-static bags"],
            "recyclability_score": 60
        },
        "books": {
            "materials": ["Cardboard", "Paper", "Shrink wrap"],
            "recyclability_score": 85
        },
        "clothing": {
            "materials": ["Plastic polybag", "Cardboard tags", "Tissue paper"],
            "recyclability_score": 55
        },
        "toys": {
            "materials": ["Cardboard", "Plastic blister", "Twist ties", "Plastic film"],
            "recyclability_score": 45
        },
        "beauty": {
            "materials": ["Cardboard", "Plastic container", "Foam inserts"],
            "recyclability_score": 50
        },
        "food": {
            "materials": ["Cardboard", "Food-safe plastic", "Insulation (if perishable)"],
            "recyclability_score": 60
        },
        "small_items": {
            "materials": ["Paper envelope", "Bubble mailer"],
            "recyclability_score": 75
        }
    }
    
    # Check for eco-friendly packaging mentions in product description
    description = product_data.get('description', '').lower()
    eco_packaging_keywords = [
        'recyclable packaging', 'plastic-free packaging', 'sustainable packaging',
        'minimal packaging', 'eco-friendly packaging', 'biodegradable packaging',
        'compostable packaging', 'recycled packaging', 'frustration-free packaging'
    ]
    
    has_eco_packaging = any(keyword in description for keyword in eco_packaging_keywords)
    
    # Get materials based on category
    materials_data = category_materials.get(category, default_materials).copy()
    
    # Adjust for eco-friendly packaging
    if has_eco_packaging:
        if "Styrofoam" in materials_data["materials"]:
            materials_data["materials"].remove("Styrofoam")
            materials_data["materials"].append("Recycled paper pulp")
        
        if "Plastic film" in materials_data["materials"]:
            materials_data["materials"].remove("Plastic film")
            materials_data["materials"].append("Biodegradable film")
            
        materials_data["recyclability_score"] += 15
        materials_data["recyclability_score"] = min(materials_data["recyclability_score"], 95)
    
    return materials_data

def calculate_carbon_footprint(materials, waste_weight_g):
    """
    Calculate carbon footprint based on packaging materials and weight
    Different materials have different carbon footprints per gram
    """
    carbon_factors = {
        "Cardboard": 1.5,     # 1.5g CO2 per 1g of cardboard
        "Paper": 1.3,         # 1.3g CO2 per 1g of paper
        "Plastic": 3.0,       # 3.0g CO2 per 1g of plastic
        "Styrofoam": 4.0,     # 4.0g CO2 per 1g of styrofoam
        "Wood": 0.5,          # 0.5g CO2 per 1g of wood
        "Metal": 5.0,         # 5.0g CO2 per 1g of metal
        "Biodegradable": 1.0, # 1.0g CO2 per 1g of biodegradable material
        "Recycled": 0.8       # 0.8g CO2 per 1g of recycled material
    }
    
    # Estimate carbon footprint based on materials
    carbon_footprint = 0
    material_count = len(materials)
    
    for material in materials:
        material_weight = waste_weight_g / material_count  # Assume equal distribution
        material_factor = 2.0  # Default factor
        
        for key, factor in carbon_factors.items():
            if key.lower() in material.lower():
                material_factor = factor
                break
        
        carbon_footprint += material_weight * material_factor
    
    return round(carbon_footprint)

def calculate_water_usage(materials, waste_weight_g):
    """
    Calculate water usage based on packaging materials and weight
    Different materials have different water footprints
    """
    water_factors = {
        "Cardboard": 0.1,     # 0.1L per 1g of cardboard
        "Paper": 0.15,        # 0.15L per 1g of paper
        "Plastic": 0.08,      # 0.08L per 1g of plastic
        "Styrofoam": 0.12,    # 0.12L per 1g of styrofoam
        "Wood": 0.05,         # 0.05L per 1g of wood
        "Metal": 0.2,         # 0.2L per 1g of metal
        "Biodegradable": 0.07,# 0.07L per 1g of biodegradable material
        "Recycled": 0.05      # 0.05L per 1g of recycled material
    }
    
    # Estimate water usage based on materials
    water_usage = 0
    material_count = len(materials)
    
    for material in materials:
        material_weight = waste_weight_g / material_count  # Assume equal distribution
        material_factor = 0.1  # Default factor
        
        for key, factor in water_factors.items():
            if key.lower() in material.lower():
                material_factor = factor
                break
        
        water_usage += material_weight * material_factor
    
    return round(water_usage,1)
