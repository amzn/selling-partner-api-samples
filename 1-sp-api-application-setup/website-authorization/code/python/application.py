from flask import Flask, render_template, request, redirect
from utils.api_utils import ApiUtils
from utils.constants import Constants


application = Flask(__name__)

@application.route("/")
def hello():
    return render_template("index.html")

@application.route("/authorize")
def redirect_oauth():
    return redirect(f"{Constants.SELLER_VENDOR_CENTRAL_URL}{Constants.APP_AUTH_PATH}")

@application.route(f"{Constants.APPLICATION_REDIRECT_URI}")
def handle_authorization_redirect():
    spapi_oauth_code = request.args["spapi_oauth_code"]
    state = request.args["state"] # Verify the state token for cross-site request forgery
    selling_partner_id = request.args["selling_partner_id"] # Store the selling partner merchant token or vendor group code
    
    refresh_token = ApiUtils.get_lwa_refresh_token(spapi_oauth_code=spapi_oauth_code) # Store the refresh token safely for further authorizations.

    if "sellercentral" in Constants.SELLER_VENDOR_CENTRAL_URL:
        marketplace_participations = get_marketplace_participations(refresh_token)
        return render_template("authorized.html", response=marketplace_participations)
    else:
        # Sellers API is for sellers only. Vendors APIs can be called at this point.
        return render_template("authorized.html", response=None)

def get_marketplace_participations(refresh_token):
    region_code = Constants.NA_REGION_CODE
    use_sandbox = "No"
    api_utils = ApiUtils(refresh_token, region_code, 'sellers', use_sandbox)
    return api_utils.call_sellers_api(method='get_marketplace_participations')


if __name__ == "__main__":
    application.run(debug=True)
