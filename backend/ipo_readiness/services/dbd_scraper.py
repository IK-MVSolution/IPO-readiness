"""DBD Data Warehouse Scraper Service using Selenium"""
import os
import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

# Download directory
DOWNLOAD_DIR = Path(__file__).parent.parent / "downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)


def init_driver():
    """Initialize Chrome WebDriver with headless option"""
    chrome_options = Options()
    chrome_options.add_argument("--headless")  # Run in background
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    
    # Set download directory
    prefs = {
        "download.default_directory": str(DOWNLOAD_DIR.absolute()),
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": True
    }
    chrome_options.add_experimental_option("prefs", prefs)
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver


def search_company(driver, company_identifier):
    """
    Search for company on DBD Data Warehouse
    
    Args:
        driver: Selenium WebDriver
        company_identifier: Company ID (13 digits) or company name
    
    Returns:
        bool: True if company found, False otherwise
    """
    try:
        # Go to DBD homepage
        driver.get("https://datawarehouse.dbd.go.th/index")
        wait = WebDriverWait(driver, 10)
        
        # Find search box and enter company identifier
        search_box = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='text']"))
        )
        search_box.clear()
        search_box.send_keys(company_identifier)
        
        # Click search button or press Enter
        search_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], .search-btn")
        search_button.click()
        
        # Wait for results
        time.sleep(2)
        
        # Check if results are displayed
        results = driver.find_elements(By.CSS_SELECTOR, ".company-result, .result-item")
        
        if results:
            # Click first result
            results[0].click()
            time.sleep(2)
            return True
        
        return False
        
    except Exception as e:
        print(f"Error searching company: {e}")
        return False


def download_financial_documents(driver):
    """
    Download financial documents from company profile page
    
    Args:
        driver: Selenium WebDriver
        
    Returns:
        list: List of downloaded file paths
    """
    try:
        wait = WebDriverWait(driver, 10)
        downloaded_files = []
        
        # Navigate to financial statements section
        # This will need to be adjusted based on actual DBD website structure
        financial_link = wait.until(
            EC.element_to_be_clickable((By.LINK_TEXT, "งบการเงิน"))
        )
        financial_link.click()
        time.sleep(2)
        
        # Document types to download
        doc_types = [
            "งบแสดงฐานะการเงิน",
            "งบกำไรขาดทุน", 
            "อัตราส่วนทางการเงิน"
        ]
        
        for doc_type in doc_types:
            try:
                # Find download link for this document type
                # Adjust selector based on actual website structure
                doc_link = driver.find_element(By.XPATH, f"//a[contains(text(), '{doc_type}')]")
                doc_link.click()
                time.sleep(3)  # Wait for download
                
                # Get latest file from download directory
                files = list(DOWNLOAD_DIR.glob("*"))
                if files:
                    latest_file = max(files, key=lambda f: f.stat().st_mtime)
                    downloaded_files.append(str(latest_file))
                    
            except Exception as e:
                print(f"Error downloading {doc_type}: {e}")
                continue
        
        return downloaded_files
        
    except Exception as e:
        print(f"Error downloading documents: {e}")
        return []


def get_dbd_documents(company_identifier):
    """
    Main function to get DBD documents for a company
    
    Args:
        company_identifier: Company ID or name
        
    Returns:
        dict: Result with success status and file paths or error message
    """
    driver = None
    try:
        driver = init_driver()
        
        # Search for company
        company_found = search_company(driver, company_identifier)
        if not company_found:
            return {
                "success": False,
                "error": "Company not found"
            }
        
        # Download documents
        files = download_financial_documents(driver)
        
        if files:
            return {
                "success": True,
                "files": files,
                "message": f"Downloaded {len(files)} documents"
            }
        else:
            return {
                "success": False,
                "error": "No documents downloaded"
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        if driver:
            driver.quit()


if __name__ == "__main__":
    # Test the scraper
    result = get_dbd_documents("0105536000315")  # Example company ID
    print(result)
