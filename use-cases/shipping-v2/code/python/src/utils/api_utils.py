import os
import json
import boto3
import urllib3
import urllib.parse

from src.utils import constants

from src.api_models.shipping_api.swagger_client.api.shipping_api import ShippingApi
from src.api_models.notifications_api.swagger_client.api.notifications_api import NotificationsApi
from src.api_models.orders_api.swagger_client.api.orders_v0_api import OrdersV0Api

from src.api_models.shipping_api.swagger_client import api_client as shipping_client
from src.api_models.shipping_api.swagger_client import configuration as shipping_configuration

from src.api_models.notifications_api.swagger_client import api_client as notifications_client
from src.api_models.notifications_api.swagger_client import configuration as notifications_configuration

from src.api_models.orders_api.swagger_client import api_client as orders_client
from src.api_models.orders_api.swagger_client import configuration as orders_configuration


secret_manager = boto3.client(constants.SECRETS_MANAGER_KEY_NAME)
SP_API_APP_CREDENTIALS_ARN = os.environ.get(constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE)


class ApiUtils:

    def __init__(self, refresh_token, region_code, api_type, grantless_scope=None):
        self.refresh_token = refresh_token
        self.region_code = region_code
        self.endpoint_url = constants.VALID_SP_API_REGION_CONFIG[region_code]
        self.api_client = self._create_api_client(api_type=api_type, grantless_scope=grantless_scope)

    def get_app_credentials(self):
        print('Calling get_app_credentials')
        try:
            app_creds = secret_manager.get_secret_value(SecretId=SP_API_APP_CREDENTIALS_ARN)['SecretString']
            s_dict = json.loads(app_creds)
        except Exception as e:
            print(str(e))
        else:
            return s_dict

    def _get_lwa_access_token(self, grantless_scope):
        url = constants.LWA_ENDPOINT
        app_creds = self.get_app_credentials()
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
            print("Status code:", response.status)
            json_response = json.loads(response.data)
        except Exception as e:
            print(str(e))
        else:
            return json_response.get('access_token')

    def _create_api_client(self, api_type, grantless_scope):
        lwa_access_token = self._get_lwa_access_token(grantless_scope)

        # Create an instance of the standard ApiClient
        if api_type == 'shipping':
            config = shipping_configuration.Configuration()
            config.host = self.endpoint_url
            api_client = shipping_client.ApiClient(configuration=config)
        elif api_type == 'orders':
            config = orders_configuration.Configuration()
            config.host = self.endpoint_url
            api_client = orders_client.ApiClient(configuration=config)
        elif api_type == 'notifications':
            config = notifications_configuration.Configuration()
            config.host = self.endpoint_url
            api_client = notifications_client.ApiClient(configuration=config)
        else:
            print(f"API Type {api_type} not supported. Please rely on shipping, orders, or notifications types.")
            return

        api_client.default_headers['x-amz-access-token'] = lwa_access_token
        api_client.default_headers['Content-Type'] = 'application/json'
        api_client.default_headers['User-Agent'] = 'Shipping Sample App/1.0/Python'

        return api_client

    def call_shipping_api(self, method, body=None, request_token=None, rate_id=None, tracking_id=None, carrier_id=None, **kwargs):
        api_instance = ShippingApi(api_client=self.api_client)

        # Call the specified method
        try:
            if request_token and rate_id:
                result = getattr(api_instance, method)(request_token, rate_id, **kwargs)
                return result
            elif tracking_id and carrier_id:
                result = getattr(api_instance, method)(tracking_id, carrier_id, **kwargs)
                return result
            result = getattr(api_instance, method)(body, **kwargs)
            return result
        except Exception as e:
            print(str(e))
            raise

    def call_orders_api(self, method, order_id=None, **kwargs):
        api_instance = OrdersV0Api(api_client=self.api_client)

        # Call the specified method
        try:
            if order_id:
                result = getattr(api_instance, method)(order_id, **kwargs)
                return result

            result = getattr(api_instance, method)(**kwargs)
            return result
        except Exception as e:
            print(str(e))
            raise

    def call_notifications_api(self, method, body=None, notification_type=None, **kwargs):
        api_instance = NotificationsApi(api_client=self.api_client)

        # Call the specified method
        try:
            if body and notification_type:
                result = getattr(api_instance, method)(body, notification_type, **kwargs)
                return result
            elif body:
                result = getattr(api_instance, method)(body, **kwargs)
                return result
            elif notification_type:
                result = getattr(api_instance, method)(notification_type, **kwargs)
                return result

            result = getattr(api_instance, method)(**kwargs)
            return result
        except Exception as e:
            print(str(e))
            raise
