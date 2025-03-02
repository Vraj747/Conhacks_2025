"""
Utility functions for the API.
"""

def extract_main_product_name(title):
    """
    Extract the main product name from a title, ignoring specifications and features.
    
    This function attempts to identify the core product name from a potentially
    long product title that includes specifications, features, and other details.
    
    Args:
        title (str): The full product title
        
    Returns:
        str: The extracted main product name
    """
    # Remove common separators that often appear before specifications
    separators = [',', '-', '|', '•', ':', ';', '(', '[', '{']
    
    # First try to get the part before the first separator
    for sep in separators:
        if sep in title:
            main_part = title.split(sep)[0].strip()
            # If the main part is reasonably sized, return it
            if len(main_part.split()) >= 2 and len(main_part.split()) <= 6:
                return main_part
    
    # If no separator or the part before separator is too short/long,
    # try to extract the first 3-5 words which often contain the brand and model
    words = title.split()
    if len(words) <= 5:
        return title
    
    # Look for common brand names at the beginning
    common_brands = ["Apple", "Samsung", "Sony", "LG", "Dell", "HP", "Lenovo", 
                    "Asus", "Acer", "Microsoft", "Google", "Amazon", "Bose", 
                    "JBL", "Logitech", "Philips", "Panasonic", "Toshiba", "Canon", 
                    "Nikon", "Dyson", "KitchenAid", "Ninja", "Instant Pot", "Keurig"]
    
    # If title starts with a known brand, include up to 5 words
    for brand in common_brands:
        if title.startswith(brand):
            return " ".join(words[:min(5, len(words))])
    
    # Default to first 3-4 words
    return " ".join(words[:min(4,len(words))])