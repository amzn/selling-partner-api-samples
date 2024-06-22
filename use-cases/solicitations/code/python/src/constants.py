from typing import Dict

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

    # Marketplace Id to region code mapping
    MARKETPLACE_ID_TO_REGION_CODE_MAPPING = {
        'A2EUQ1WTGCTBG2': 'NA', #CA
        'ATVPDKIKX0DER': 'NA', #US
        'A1AM78C64UM0Y8': 'NA', #MX
        'A2Q3Y263D00KWC': 'NA', #BR
        'A1RKKUPIHCS9HS': 'EU', #ES
        'A1F83G8C2ARO7P': 'EU', #UK
        'A13V1IB3VIYZZH': 'EU', #FR
        'AMEN7PMS3EDWL': 'EU', #BE
        'A1805IZSGTT6HS': 'EU', #NL
        'A1PA6795UKMFR9': 'EU', #DE
        'APJ6JRA9NG5V4': 'EU', #IT
        'A2NODRKZP88ZB9': 'EU', #SE
        'AE08WJ6YKNBMC': 'EU', #ZA
        'A1C3SOZRARQ6R3': 'EU', #PL
        'ARBP9OOSHTCHU': 'EU', #EG
        'A33AVAJ2PDY3EV': 'EU', #TR
        'A17E79C6D8DWNP': 'EU', #SA
        'A2VIGQ35RCS4UG': 'EU', #AE
        'A21TJRUUN4KGV': 'EU', #IN
        'A19VAU5U5O7RUS': 'FE', #SG
        'A39IBJ37TRP1C6': 'FE', #AU
        'A1VC38T7YXB528': 'FE', #JP
    }

    # Login With Amazon configuration
    LWA_ENDPOINT = 'https://api.amazon.com/auth/o2/token'
    LWA_NOTIFICATIONS_SCOPE = 'sellingpartnerapi::notifications'

    # Notifications configuration
    NOTIFICATION_TYPE_ORDER_CHANGE = 'ORDER_CHANGE'
    ORDER_CHANGE_NOTIFICATION_STATUS_SHIPPED = 'Shipped'

    # Lambda environment variables
    REFRESH_TOKEN_ENV_VARIABLE = 'REFRESH_TOKEN'
    SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE = 'SP_API_APP_CREDENTIALS_SECRET_ARN'
    SOLICITATIONS_SCHEDULER_ROLE_ARN_ENV_VARIABLE = 'SOLICITATIONS_SCHEDULER_ROLE_ARN'
    SOLICITATIONS_STATE_MACHINE_ARN_ENV_VARIABLE = 'SOLICITATIONS_STATE_MACHINE_ARN'
    SQS_QUEUE_ARN_ENV_VARIABLE = 'SQS_QUEUE_ARN'

    # Generic Lambda input parameters
    REGION_CODE_KEY_NAME = 'RegionCode'
    REFRESH_TOKEN_KEY_NAME = 'RefreshToken'

    # Solicitations API constants
    ACTION_PRODUCT_REVIEW_SELLER_FEEDBACK = 'productReviewAndSellerFeedback'