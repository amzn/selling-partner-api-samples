import os
import json
import boto3
import urllib3
import urllib.parse

from src.utils import constants

from src.api_models.notification_api.swagger_client.api.notifications_api import NotificationsApi
from src.api_models.datakiosk_api.swagger_client.api.queries_api import QueriesApi

from src.api_models.datakiosk_api.swagger_client import configuration as queries_configuration
from src.api_models.datakiosk_api.swagger_client import api_client as queries_client

from src.api_models.notification_api.swagger_client import api_client as notifications_client
from src.api_models.notification_api.swagger_client import configuration as notifications_configuration

secret_manager = boto3.client(constants.SECRETS_MANAGER_KEY_NAME)
SP_API_APP_CREDENTIALS_ARN = os.environ.get(constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE)

# Set OPT_OUT = True to disable User-Agent tracking
OPT_OUT = False

class ApiUtils:

    def __init__(self, refresh_token, region_code, api_type, grantless_scope=None):
        self.refresh_token = refresh_token
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
            client.default_headers['User-Agent'] = 'Data Kiosk Sample App/1.0/Python'

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
            print("Status code:", response.status)
            json_response = json.loads(response.data)
        except Exception as e:
            raise e
        else:
            return json_response.get('access_token')

    def _create_api_client(self, api_type, grantless_scope):
        lwa_access_token = self._get_lwa_access_token(grantless_scope)

        # Create an instance of the standard ApiClient
        if api_type == constants.DATA_KIOSK_API_TYPE:
            config = queries_configuration.Configuration()
            config.host = self.endpoint_url
            api_client = queries_client.ApiClient(configuration=config)
        elif api_type == constants.NOTIFICATIONS_API_TYPE:
            config = notifications_configuration.Configuration()
            config.host = self.endpoint_url
            api_client = notifications_client.ApiClient(configuration=config)
        else:
            print(f"API Type {api_type} not supported. Please rely on data kiosk or notifications types.")
            return

        api_client.default_headers['x-amz-access-token'] = lwa_access_token
        api_client.default_headers['Content-Type'] = 'application/json'
        self._set_useragent(api_client)

        return api_client

    def call_datakiosk_api(self, method, document_id=None, body=None, query_id=None, **kwargs):
        api_instance = QueriesApi(api_client=self.api_client)

        # Call the specified method
        try:
            if document_id:
                result = getattr(api_instance, method)(document_id, **kwargs)
                return result
            if body:
                result = getattr(api_instance, method)(body, **kwargs)
                return result
            if query_id:
                result = getattr(api_instance, method)(query_id, **kwargs)
                return result
            result = getattr(api_instance, method)(**kwargs)
            return result
        except Exception as e:
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
