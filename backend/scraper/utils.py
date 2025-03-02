# backend/scraper/utils.py

def clean_data(text):
    """Cleans any unwanted characters from scraped text."""
    return text.strip().replace('\n', '').replace('\r', '')
