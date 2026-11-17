from typing import Dict
import uuid

class Constants:
    # Region configuration
    NA_REGION_CODE = 'NA'
    SP_API_NA_ENDPOINT = 'https://sellingpartnerapi-na.amazon.com'
    SP_API_NA_SANDBOX_ENDPOINT = 'https://sandbox.sellingpartnerapi-na.amazon.com'
    EU_REGION_CODE = 'EU'
    SP_API_EU_ENDPOINT = 'https://sellingpartnerapi-eu.amazon.com'
    SP_API_EU_SANDBOX_ENDPOINT = 'https://sandbox.sellingpartnerapi-eu.amazon.com'
    FE_REGION_CODE = 'FE'
    SP_API_FE_ENDPOINT = 'https://sellingpartnerapi-fe.amazon.com'
    SP_API_FE_SANDBOX_ENDPOINT = 'https://sandbox.sellingpartnerapi-fe.amazon.com'

    # Region to endpoint mapping
    REGION_ENDPOINT_MAPPING = {
        NA_REGION_CODE: (SP_API_NA_ENDPOINT, SP_API_NA_SANDBOX_ENDPOINT),
        EU_REGION_CODE: (SP_API_EU_ENDPOINT, SP_API_EU_SANDBOX_ENDPOINT),
        FE_REGION_CODE: (SP_API_FE_ENDPOINT, SP_API_FE_SANDBOX_ENDPOINT)
    }

    # Login With Amazon configuration
    LWA_ENDPOINT = 'https://api.amazon.com/auth/o2/token'
    
    APPLICATION_ID = "your-app-id"
    CLIENT_ID = "your-app-client-id"
    CLIENT_SECRET = "your-app-client-secret"

    # Seller/Vendor Central URL
    SELLER_VENDOR_CENTRAL_URL = "https://sellercentral.amazon.com"
    APP_AUTH_PATH = f"/apps/authorize/consent?application_id={APPLICATION_ID}&state={uuid.uuid4()}&version=beta"
    APPLICATION_REDIRECT_URI = "/success"