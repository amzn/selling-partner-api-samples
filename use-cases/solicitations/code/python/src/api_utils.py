from api_models.solicitations_api.swagger_client.api.solicitations_api import SolicitationsApi
from api_models.solicitations_api.swagger_client import api_client as solicitations_client
from api_models.solicitations_api.swagger_client import configuration as solicitations_configuration

from api_models.notifications_api.swagger_client.api.notifications_api import NotificationsApi
from api_models.notifications_api.swagger_client import api_client as notifications_client
from api_models.notifications_api.swagger_client import configuration as notifications_configuration

from constants import Constants

import os
import json
import urllib3
import urllib.parse
import boto3

secret_manager = boto3.client('secretsmanager')
sp_api_app_credentials_arn = os.environ[Constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE]

class ApiUtils:

    def __init__(self, refresh_token, region_code, api_type, grantless_scope=None):
        self.refresh_token = refresh_token
        self.region_code = region_code
        self.endpoint_url, self.aws_region = Constants.REGION_ENDPOINT_MAPPING.get(region_code)
        self.api_client = self._create_api_client(api_type=api_type, grantless_scope=grantless_scope)

    def _get_app_credentials(self):
        try:
            app_creds = secret_manager.get_secret_value(SecretId=sp_api_app_credentials_arn)['SecretString']
            s_dict = json.loads(app_creds)
        except Exception as e:
            print(str(e))
        else:
            return s_dict

    def _get_lwa_access_token(self, grantless_scope):
        url = Constants.LWA_ENDPOINT
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
            print(str(e))
        else:
            return json_response.get('access_token')

    def _create_api_client(self, api_type, grantless_scope):
        lwa_access_token = self._get_lwa_access_token(grantless_scope=grantless_scope)

        if api_type == "solicitations":
            config = solicitations_configuration.Configuration()
            config.host = self.endpoint_url
            api_client = solicitations_client.ApiClient(configuration=config)
        elif api_type == "notifications":
            config = notifications_configuration.Configuration()
            config.host = self.endpoint_url
            api_client = notifications_client.ApiClient(configuration=config)
        else:
            print(f"API Type {api_type} not supported. Please rely on mfn, orders, or notifications types.")
            return

        # Create an instance of the standard ApiClient
        api_client.default_headers['x-amz-access-token'] = lwa_access_token
        api_client.default_headers['Content-Type'] = 'application/json'
        api_client.default_headers['User-Agent'] = 'Solicitations Sample App/1.0/Python'

        return api_client

    def call_solicitations_api(self, method, amazon_order_id=None, **kwargs):
        # Create an instance of the Solicitations API
        api_instance = SolicitationsApi(api_client=self.api_client)

        # Call the specified method
        try:
            if amazon_order_id:
                result = getattr(api_instance, method)(amazon_order_id, **kwargs)
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
