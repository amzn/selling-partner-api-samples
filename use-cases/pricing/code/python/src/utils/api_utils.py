import os
import json
import boto3
import urllib3
import urllib.parse

from src.utils import constants

from src.api_models.notifications_api.swagger_client.api.notifications_api import NotificationsApi
from src.api_models.pricing_api.swagger_client.api.product_pricing_api import ProductPricingApi
from src.api_models.listings_api.swagger_client.api.listings_api import ListingsApi

from src.api_models.pricing_api.swagger_client import configuration as pricing_configuration
from src.api_models.pricing_api.swagger_client import api_client as pricing_client

from src.api_models.listings_api.swagger_client import api_client as listings_client
from src.api_models.listings_api.swagger_client import configuration as listings_configuration

from src.api_models.notifications_api.swagger_client import api_client as notifications_client
from src.api_models.notifications_api.swagger_client import configuration as notifications_configuration

secret_manager = boto3.client(constants.SECRETS_MANAGER_CLIENT_NAME)
SP_API_APP_CREDENTIALS_ARN = os.environ.get(constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE)

# Set OPT_OUT = True to disable User-Agent tracking
OPT_OUT = False

class ApiUtils:

    def __init__(self, refresh_token, region_code, api_type, grantless_scope=None):
        self.refresh_token = refresh_token
        self.region_code = region_code
        self.endpoint_url = constants.VALID_SP_API_REGION_CONFIG[region_code]
        self.api_client = self._create_api_client(api_type=api_type, grantless_scope=grantless_scope)

    def _get_app_credentials(self):
        print('Calling get_app_credentials')
        try:
            app_creds = secret_manager.get_secret_value(SecretId=SP_API_APP_CREDENTIALS_ARN)['SecretString']
            s_dict = json.loads(app_creds)
        except Exception as e:
            raise e
        else:
            return s_dict

    def _set_useragent(self, client):
        if not OPT_OUT:
            print('Setting user agent')
            client.default_headers['User-Agent'] = 'Pricing Sample App/1.0/Python'

    def _get_lwa_access_token(self, grantless_scope):
        url = constants.LWA_ENDPOINT
        app_creds = self._get_app_credentials()
        http = urllib3.PoolManager()
        payload = {
            'client_id': app_creds.get('AppClientId'),
            'client_secret': app_creds.get('AppClientSecret')
        }
        if grantless_scope:
            payload.update({'grant_type': 'client_credentials', 'scope': grantless_scope})
        else:
            payload.update({'grant_type': 'refresh_token', 'refresh_token': self.refresh_token})
        data = urllib.parse.urlencode(payload)
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}

        try:
            response = http.request('POST', url, headers=headers, body=data)
            json_response = json.loads(response.data)
        except Exception as e:
            raise e
        else:
            return json_response.get('access_token')

    def _create_api_client(self, api_type, grantless_scope):
        lwa_access_token = self._get_lwa_access_token(grantless_scope)

        # Create an instance of the standard ApiClient
        if api_type == constants.PRICING_API_TYPE:
            config = pricing_configuration.Configuration()
            config.host = self.endpoint_url
            api_client = pricing_client.ApiClient(configuration=config)
        elif api_type == constants.NOTIFICATIONS_API_TYPE:
            config = notifications_configuration.Configuration()
            config.host = self.endpoint_url
            api_client = notifications_client.ApiClient(configuration=config)
        elif api_type == constants.LISTINGS_API_TYPE:
            config = listings_configuration.Configuration()
            config.host = self.endpoint_url
            api_client = listings_client.ApiClient(configuration=config)
        else:
            print(f"API Type {api_type} not supported. Please rely on mfn, orders, or notifications types.")
            return

        api_client.default_headers['x-amz-access-token'] = lwa_access_token
        api_client.default_headers['Content-Type'] = 'application/json'
        self._set_useragent(api_client)

        return api_client

    def call_pricing_api(self, method, marketplace_id=None, item_type=None, **kwargs):
        # Create an instance of the ProductPricingApi
        api_instance = ProductPricingApi(api_client=self.api_client)

        try:
            # Call the specified method with provided arguments and additional keyword arguments
            result = getattr(api_instance, method)(marketplace_id, item_type, **kwargs)
            return result

        except Exception as e:
            # Raise any exceptions that occur during the API call
            raise e

    def call_listings_api(self, method, body=None, marketplace_ids=None, seller_id=None, sku=None, **kwargs):
        # Create an instance of the ListingsApi
        api_instance = ListingsApi(api_client=self.api_client)

        try:
            # Prepare common arguments
            args = [seller_id, sku, marketplace_ids]

            # Check if the method requires a 'body' parameter
            if method == 'patch_listings_item':
                # Insert 'body' at the appropriate position in the arguments list
                args.insert(3, body)

            # Call the specified method with the prepared arguments and additional keyword arguments
            return getattr(api_instance, method)(*args, **kwargs)

        except Exception as e:
            # Raise any exceptions that occur during the API call
            raise e

    def call_notifications_api(self, method, body=None, notification_type=None, **kwargs):
        # Create an instance of the NotificationsApi
        api_instance = NotificationsApi(api_client=self.api_client)

        try:
            # Check if both body and notification_type are provided
            if body and notification_type:
                result = getattr(api_instance, method)(body, notification_type, **kwargs)
                return result
            # Check if only body is provided
            elif body:
                result = getattr(api_instance, method)(body, **kwargs)
                return result
            # Check if only notification_type is provided
            elif notification_type:
                result = getattr(api_instance, method)(notification_type, **kwargs)
                return result

            # If neither body nor notification_type are provided, call the method with only kwargs
            result = getattr(api_instance, method)(**kwargs)
            return result

        except Exception as e:
            # Raise any exceptions that occur during the API call
            raise e