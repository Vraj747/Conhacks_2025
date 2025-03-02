# Do I Need That? - Sustainable Shopping Extension

A browser extension that helps users make more sustainable shopping decisions by analyzing products and suggesting eco-friendly and second-hand alternatives.

## Features

- Automatically detects when you're on a product page
- Analyzes product sustainability based on various factors
- Finds real second-hand alternatives from eBay and other marketplaces
- Suggests sustainable brand alternatives based on product category
- Tracks your impact with statistics on money saved and CO2 avoided

## Project Structure

- `extension/`: Chrome extension files
- `backend/`: Flask API for product analysis and alternative search
- `dashboard/`: Dashboard for viewing sustainability metrics (future development)

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   ```

3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`

4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

5. Run the Flask API:
   ```
   python api/main.py
   ```
   The API will be available at http://127.0.0.1:8000

### Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top-right corner)
3. Click "Load unpacked" and select the `extension` directory
4. The extension should now be installed and visible in your browser toolbar

## Usage

1. Visit a product page on a supported e-commerce site (Amazon, eBay, Walmart, Best Buy)
2. Click on the extension icon to see:
   - Product sustainability score
   - Factors affecting the score
   - Second-hand alternatives
   - Sustainable brand alternatives

3. Choose to continue with the purchase or explore alternatives

## Supported Sites

- Amazon
- eBay
- Walmart
- Best Buy
- Target
- Staples

## Technologies Used

- Frontend: HTML, CSS, JavaScript
- Backend: Python, Flask
- Web Scraping: Selenium, BeautifulSoup
- Browser Extension: Chrome Extension API 