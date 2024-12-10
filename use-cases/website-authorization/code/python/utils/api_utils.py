from api_models.api.sellers_api import SellersApi
from api_models import api_client as sellers_client
from api_models import configuration as sellers_configuration

from utils.constants import Constants

import json
import urllib3
import urllib.parse

# Set OPT_OUT = True to disable User-Agent tracking
OPT_OUT = False

class ApiUtils:

    def __init__(self, refresh_token, region_code, api_type, sandbox, grantless_scope=None):
        self.refresh_token = refresh_token
        self.endpoint_url, self.sandbox_endpoint_url = Constants.REGION_ENDPOINT_MAPPING.get(region_code)
        self.api_client = self._create_api_client(api_type=api_type, grantless_scope=grantless_scope, sandbox=sandbox)
        
    def _set_useragent(self, client):
        if not OPT_OUT:
            print('Setting user agent')
            client.default_headers['User-Agent'] = 'Sample Website Authorization App/1.0/Python'

    def _get_lwa_access_token(self, grantless_scope):
        url = Constants.LWA_ENDPOINT
        http = urllib3.PoolManager()
        payload = {
            'client_id': Constants.CLIENT_ID,
            'client_secret': Constants.CLIENT_SECRET
        }
        if grantless_scope:
            payload.update({'grant_type': 'client_credentials', 'scope': grantless_scope})
        else:
            payload.update({'grant_type': 'refresh_token', 'refresh_token': self.refresh_token})
        data = urllib.parse.urlencode(payload)
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}

        try:
            response = http.request('POST', url, headers=headers, body=data)
            print('Status code:', response.status)
            json_response = json.loads(response.data)
        except Exception as e:
            print(str(e))
        else:
            return json_response.get('access_token')
    
    def _get_lwa_refresh_token(self, spapi_oauth_code):
        code_exchange_grant_type = "authorization_code"
        url = Constants.LWA_ENDPOINT
        http = urllib3.PoolManager()
        payload = {
            'client_id': Constants.CLIENT_ID,
            'client_secret': Constants.CLIENT_SECRET,
            'code': spapi_oauth_code,
            'grant_type': code_exchange_grant_type
        }
        
        data = urllib.parse.urlencode(payload)
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        try:
            response = http.request('POST', url, headers=headers, body=data)
            print('Status code:', response.status)
            json_response = json.loads(response.data)
        except Exception as e:
            print(str(e))
        else:
            selling_partner_refresh_token = json_response.get('refresh_token')
            # Store refresh token in safe storage
            # Retrieve and exhange with access_token as needed
            return selling_partner_refresh_token

    def _create_api_client(self, api_type, grantless_scope, sandbox):
        lwa_access_token = self._get_lwa_access_token(grantless_scope=grantless_scope)
        
        endpoint = self.sandbox_endpoint_url if (sandbox == 'Yes') else self.endpoint_url
        
        if api_type == 'sellers':
            config = sellers_configuration.Configuration()
            config.host = endpoint
            api_client = sellers_client.ApiClient(configuration=config)
        else:
            print(f'API Type {api_type} not supported. Please rely on mfn, orders, or notifications types.')
            return

        # Create an instance of the standard ApiClient
        api_client.default_headers['x-amz-access-token'] = lwa_access_token
        api_client.default_headers['Content-Type'] = 'application/json'
        self._set_useragent(api_client)

        return api_client

    def call_sellers_api(self, method, **kwargs):
        # Create an instance of the Sellers API
        api_instance = SellersApi(api_client=self.api_client)

        # Call the specified method
        try:
            result = getattr(api_instance, method)(**kwargs)
            return result
        except Exception as e:
            print(str(e))
            raise
