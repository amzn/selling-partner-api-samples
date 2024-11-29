## Shipping API
The Amazon Shipping API is designed to support outbound shipping use cases both for orders originating on Amazon-owned marketplaces as well external channels/marketplaces. With these APIs, you can request shipping rates, purchase shipments, fetch shipment labels, cancel shipments, and track shipments.

If you haven't already, we recommend you to navigate the following resources:
* [Shipping API v2 reference](https://developer-docs.amazon.com/amazon-shipping/docs/shipping-api-v2-reference)
* [Workflow for creating a shipment](https://developer-docs.amazon.com/amazon-shipping/docs/workflow-for-creating-a-shipment)
* [SmartPurchase workflow](https://developer-docs.amazon.com/amazon-shipping/docs/tutorial-purchase-a-shipment-directly)

## Sample Solution
This Sample Solution provides all the required resources to deploy a fully functional SP-API application on AWS that implements the [Shipping v2  use case](https://developer-docs.amazon.com/amazon-shipping/docs/workflow-for-creating-a-shipment) end-to-end. Use this application to test the proposed solution, do changes and/or integrate it to your own product.

### Workflow

A well-architected Shipping v2 workflow includes subscribing to the ORDER_CHANGE notification for automatic reception of new MFN orders. Alternatively, new orders can be identified from incoming order reports.

![Shippingv2 Workflow](docs/images/Shippingv2-Workflow.png)

## Sample Code

Below are the code steps for the Shipping V2  workflow.

The process for the steps belows should start by monitoring [ORDER_CHANGE](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide#order_change) notifications. To subscribe to Order Change Notifications, refer to [Tutorial 5: Subscribe to ORDER_CHANGE Notifications](https://developer-docs.amazon.com/sp-api/docs/merchant-fulfillment-api-v0-use-case-guide#tutorial-5-subscribe-to-mfn-notifications) of the use case guide.

### 1 - Retrieve an order

Upon an ORDER_CHANGE notification for unshipped MFN orders, the Orders API is used to retrieve the order details.

#### Step-by-step:
1. **Initialize API Client:** The API client of OrdersAPI is initialized with the Refresh Token and the Region.
2. **Get Order:** The Orders API getOrder operation is called using the orderId from the ORDER_CHANGE notification.
3. **Create the order processing class:** The MfnOrder class is instantiated with the order items from getOrder and the shipping address.
4. **Return MfnOrder object** The MfnOrder object created is returned for further processing of the Shipping Workflow.

**Python**

*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/shipping-v2/code/python/src/retrieve_order_handler.py)*

```python
        # Create an instance of the ApiUtils class
        api_utils = ApiUtils(region_code,
                             refresh_token,
                             constants.ORDERS_API_TYPE)

        # Retrieve email address for the label sending
        ship_from_email = os.environ.get(constants.SHIP_FROM_EMAIL_ENV_VARIABLE)

        # API calls to retrieve order and order items
        order_response = api_utils.call_orders_api(method='get_order',
                                                   order_id=get_order_lambda_input.credentials.orderId)
        order_items_response = api_utils.call_orders_api(method='get_order_items',
                                                         order_id=get_order_lambda_input.credentials.orderId)

        order_address_response = api_utils.call_orders_api(method='get_order_address',
                                                           order_id=get_order_lambda_input.credentials.orderId)

        # Check if the response has a payload attribute and use it directly
        if hasattr(order_address_response, 'payload'):
            ship_to_address = map_address(order_address_response.payload.shipping_address)
            ship_from_address = map_address(order_response.payload.default_ship_from_location_address, ship_from_email)

        # Return the ShippingOrder object in JSON format
        get_order_lambda_input.mfnOrder = MfnOrder()
        get_order_lambda_input.mfnOrder.orderItems = map_order_items(order_items_response.payload.order_items)
        get_order_lambda_input.mfnOrder.shipFromAddress = ship_from_address
        get_order_lambda_input.mfnOrder.shipToAddress = ship_to_address

        result = asdict(get_order_lambda_input)
        return result

def map_address(order_address, ship_from_email=None):
    # Initialize OrdersApiAddress object with available attributes
    address_mapping = {
        'name': order_address.name,
        'addressLine1': order_address.address_line1,
        'addressLine2': order_address.address_line2,
        'addressLine3': order_address.address_line3,
        'city': order_address.city,
        'countryCode': order_address.country_code,
        'postalCode': order_address.postal_code,
        'stateOrRegion': order_address.state_or_region,
        'phoneNumber': re.sub(r'[^0-9]', '', order_address.phone or ''),
        'email': ship_from_email
    }

    return Address(**address_mapping)

def map_order_items(order_items_list):
    order_items = []
    for item_dict in order_items_list:
        item_price_dict = item_dict.get("ItemPrice", {})
        currency_code = item_price_dict.get("CurrencyCode", "USD")  # Default to USD if not specified
        amount_str = item_price_dict.get("Amount")
        if amount_str is None:
            logging.error(f"Amount not found for OrderItemId: {item_dict.get('OrderItemId')}")
            continue
        try:
            amount = float(amount_str)
        except ValueError:
            logging.error(f"Invalid amount value '{amount_str}' for OrderItemId: {item_dict.get('OrderItemId')}")
            continue

        value = Currency(value=amount, unit=currency_code)
        order_item = OrderItem(
            orderItemId=item_dict.get("OrderItemId"),
            sku=item_dict.get("SellerSKU"),
            quantity=int(item_dict.get("QuantityOrdered", 0)),  # Default to 0 if not specified
            value=value
        )
        order_items.append(order_item)
    return order_items
```


### 2 - Check Inventory

After the order details are retrieved, the inventory is checked and order is validated.

#### Step-by-step:
1. **Process the order items:** A loop over all order items is created to execute inventory checks.
2. **Prepare the request:** Get the orderItem SKU and prepare the database (DynamoDB) request.
3. **Retrieve the Item from Inventory:** Using the database client, the item is retrieved from inventory table.
4. **Check stock:** The item stock quantity is checked. The order is aborted if quantity is insufficient.
5. **Calculate Order Weight and Dimensions:** The total order weight and dimensions are calculated and returned as part of the MFN order.

**Python**

*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/shipping-v2/code/python/src/inventory_check_handler.py)*

```python
    # Initialize package weight and dimensions
    package_weight_value = 0
    package_weight_unit = "LB"

    package_length = 0
    package_width = 0
    package_height = 0
    package_size_unit = "GM"

    get_order_lambda_input = ShippingLambdaInput(**event)

    # Check if mfnOrder is not None
    if get_order_lambda_input.mfnOrder:
        # Check if orderItems is not None
        if get_order_lambda_input.mfnOrder.orderItems:
            # Iterate over all order items and retrieve stock, size, and weight from the database
            for order_item in get_order_lambda_input.mfnOrder.orderItems:
                # Retrieve the item from DynamoDB by SKU
                # Update this section to match your product's logic
                key = {constants.INVENTORY_TABLE_HASH_KEY_NAME: {"S": order_item.sku}}

                dynamodb = boto3.client(constants.AWS_DYNAMO_DB_CLIENT_KEY_NAME)
                get_item_result = dynamodb.get_item(TableName=os.environ.get(constants.INVENTORY_TABLE_NAME_ENV_VARIABLE),
                                                    Key=key)
                item = get_item_result.get("Item", {})

                stock = int(item.get(constants.INVENTORY_TABLE_STOCK_ATTRIBUTE_NAME, {"N": "0"})["N"])
                if stock < order_item.quantity:
                    raise Exception(f"Stock level for SKU {order_item.sku} "
                                    f"is not enough to fulfill the requested quantity")

                item_weight_value = int(item.get(constants.INVENTORY_TABLE_WEIGHT_VALUE_ATTRIBUTE_NAME, {"N": "0"})["N"])

                # Valid values for the database records are uppercase: [OZ, G]
                item_weight_unit = item.get(constants.INVENTORY_TABLE_WEIGHT_UNIT_ATTRIBUTE_NAME, {"S": ""})["S"]

                item_length = int(item.get(constants.INVENTORY_TABLE_LENGTH_ATTRIBUTE_NAME, {"N": "0"})["N"])
                item_width = int(item.get(constants.INVENTORY_TABLE_WIDTH_ATTRIBUTE_NAME, {"N": "0"})["N"])
                item_height = int(item.get(constants.INVENTORY_TABLE_HEIGHT_ATTRIBUTE_NAME, {"N": "0"})["N"])

                # Valid values for the database records are uppercase: [INCHES, CENTIMETERS]
                item_size_unit = item.get(constants.INVENTORY_TABLE_SIZE_UNIT_ATTRIBUTE_NAME, {"S": ""})["S"]

                # Create a Dimensions object for the item weight
                item_dimensions = Dimensions(unit=item_size_unit, length=item_length, width=item_width,
                                             height=item_height)

                # Create a Weight object for the item weight
                item_weight = Weight(unit=item_weight_unit, value=float(str(item_weight_value)))

                # Update the order item with the retrieved weight
                order_item.itemWeight = item_weight
                order_item.dimensions = item_dimensions

                # Package weight is calculated by adding the individual weights
                # Update this section to match your selling partners' logic
                package_weight_value += item_weight_value
                package_weight_unit = item_weight_unit

                # Package size is calculated by adding the individual sizes
                # Update this section to match your selling partners' logic
                package_length += item_length
                package_width += item_width
                package_height += item_height
                package_size_unit = item_size_unit

            get_order_lambda_input.mfnOrder.weight = Weight(unit=package_weight_unit,
                                                            value=float(str(package_weight_value)))

            get_order_lambda_input.mfnOrder.dimensions = Dimensions(length=package_length, width=package_width,
                                                                    height=package_height, unit=package_size_unit)
            
    return asdict(get_order_lambda_input)
```

### 3 - Get Rates

Once the inventory is checked and the order is validated for shipping, we use the [GetRates](https://developer-docs.amazon.com/amazon-shipping/docs/shipping-api-v2-reference#post-shippingv2shipmentsrates) operation to check for available shipping service offers.

#### Step-by-step:
1. **Initialize API Client:** The API client for Shippingv2 is initialized using the Refresh Token and the Region.
2. **Prepare the request:** The request for the GetRatesRequest operation is prepared.
3. **Call the API:** The Shipping Api getRates is called using the prepared request.
4. **Process the shipment services:** Parse and extract the list of shipping services and store them in a dedicated class. Finally return the fetched results.

**Python**

*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/shipping-v2/code/python/src/get_rates_handler.py)*

```python
        # Create an instance of the ApiUtils class
        api_utils = ApiUtils(region_code=region_code,
                             refresh_token=refresh_token,
                             api_type=constants.SHIPPING_API_TYPE)

        # Get eligible shipment services for the order
        get_rates_request = get_rates_request_body(mfn_order=get_rates_lambda_input.mfnOrder,
                                                   order_id=get_rates_lambda_input.credentials.orderId)

        get_rates_response = api_utils.call_shipping_api('get_rates', body=json.dumps(get_rates_request))

        if get_rates_response and hasattr(get_rates_response, 'payload') and get_rates_response.payload:
            get_rates_lambda_input.rates = Rates()
            get_rates_lambda_input.rates.requestToken = get_rates_response.payload.request_token
            get_rates_lambda_input.rates = get_rates_response.payload.rates
        else:
            error_msg = "No rates found in the response"
            raise Exception(error_msg)

        return get_rates_response.payload.to_dict()

    except Exception as e:
        raise Exception("Calling Shipping API failed") from e


def get_rates_request_body(mfn_order, order_id):
    # Prepare items list
    items_list = [{
        "itemValue": asdict(item.value),
        "description": shipping_preferences.ITEM_DESCRIPTION,
        "itemIdentifier": item.orderItemId,
        "quantity": item.quantity,
        "weight": asdict(item.itemWeight)
    } for item in mfn_order.orderItems]

    # Define requested document specification
    requested_document_specification = {
        "format": shipping_preferences.LABEL_FORMAT_PDF,
        "size": shipping_preferences.LABEL_SIZE,
        "printOptions": shipping_preferences.PRINT_OPTIONS
    }

    # Prepare packages
    package_data = {
        "dimensions": asdict(mfn_order.dimensions),
        "weight": asdict(mfn_order.weight),
        "items": items_list,
        "insuredValue": shipping_preferences.PACKAGES_INSURED_VALUE,
        "packageClientReferenceId": f"Order_{order_id}_Package_1"
    }

    # Prepare request body
    request_body = {
        "shipFrom": asdict(mfn_order.shipFromAddress),
        "shipTo": asdict(mfn_order.shipToAddress),
        "returnTo": mfn_order.returnToAddress if getattr(mfn_order, 'returnToAddress', None) else None,
        "packages": [package_data],
        "channelDetails": {
            "channelType": shipping_preferences.CHANNEL_TYPE,
            "amazonOrderDetails": {"orderId": order_id}
        },
        "labelSpecifications": requested_document_specification,
        "shipmentType": shipping_preferences.SHIPMENT_TYPE,
        "serviceSelection": shipping_preferences.SERVICE_SELECTION
    }

    return request_body
```

### 4 - Select the preferred shipment

After getting the available shipping services, the offers are filtered for the seller preferred one.
For instance, filtering criteria can be Price or Speed.

#### Step-by-step:
1. **Retrieve Shipment Settings:** The preferred shipment settings are retrieved from an environment variable.
2. **Filter shipment services:** The setting is used as criteria to filter the shipment offers collection.
3. **Return preferred shipment:** The shipment service remaining is returned.

**Python**

*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/shipping-v2/code/python/src/select_shipment_handler.py)*

```python
        shipping_service_list = shipping_lambda_input.rates.rates

        if len(shipping_service_list) == 0:
            raise Exception("There are no shipping services to fulfill the order")

        # Select the shipping service based on the preference (cheapest/fastest)
        shipping_lambda_input.rates.preferredRate = get_preferred_shipment(shipping_service_list)

        return asdict(shipping_lambda_input)

def get_preferred_shipment(shipping_services):
    # Get the shipping preference from the Lambda function's environment variable
    # Update this section to match your product's logic
    shipment_filter_type = os.environ.get(constants.SHIPMENT_FILTER_TYPE_ENV_VARIABLE)

    if shipment_filter_type == constants.SHIPMENT_FILTER_TYPE_CHEAPEST:
        shipping_services.sort(key=cmp_to_key(price_comparator))
    elif shipment_filter_type == constants.SHIPMENT_FILTER_TYPE_FASTEST:
        shipping_services.sort(key=cmp_to_key(speed_comparator))

    return shipping_services[0]

def price_comparator(ship_service1, ship_service2):
    return ship_service1.totalCharge.value - ship_service2.totalCharge.value

def speed_comparator(ship_service1, ship_service2):
    promise_date1 = datetime.strptime(ship_service1.promise.deliveryWindow.start, '%Y-%m-%dT%H:%M:%SZ')
    promise_date2 = datetime.strptime(ship_service2.promise.deliveryWindow.start, '%Y-%m-%dT%H:%M:%SZ')

    return -1 if promise_date1 < promise_date2 else 1 if promise_date1 > promise_date2 else 0
```

### 5 - Purchase shipment

After deciding on the preferred shipping service, it is now possible to create the order shipment and store the shipment id for the order in the database.

#### Step-by-step:
1. **Initialize API Client:** The Shippingv2 API is initialized using the Refresh Token and the Region.
2. **Call the CreateShipment operation** The purchaseShipment operation is called using the request prepared.
3. **Store Shipment ID:** The shipmentId part of the response payload is stored along the order handled.
4. **Return the label:** The label part of the response payload is returned.

**Python**

*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/shipping-v2/code/python/src/purchase_shipment_handler.py)*

```Python
        api_utils = ApiUtils(region_code=region_code,
                             refresh_token=refresh_token,
                             api_type=constants.SHIPPING_API_TYPE)

        # Create shipment for the selected shipping service
        purchase_shipment_request = get_purchase_shipment_request_body(payload=purchase_shipment_lambda_input)

        logger.info(f"Shipping API - PurchaseShipment request: {purchase_shipment_request}")

        purchase_shipment_result = api_utils.call_shipping_api('purchase_shipment', body=purchase_shipment_request)

        logger.info(f"Shipping API - PurchaseShipment response: {purchase_shipment_result}")

        # Store ShipmentId in DynamoDB
        # Update this section to match your product's logic
        shipment_id = purchase_shipment_result.payload.shipment_id
        tracking_id = purchase_shipment_result.payload.package_document_details[0]["trackingId"]
        carrier_id = purchase_shipment_lambda_input.rates.preferredRate.carrierId
        store_shipment_information(purchase_shipment_lambda_input.credentials.orderId,
                                   shipment_id, tracking_id, carrier_id)

        # Generating Label format
        label = purchase_shipment_result.payload.package_document_details[0]["packageDocuments"][0]
        result = {
            constants.LABEL_FORMAT_KEY_NAME: label["format"],
            constants.LABEL_DIMENSIONS_KEY_NAME: label["type"],
            constants.LABEL_FILE_CONTENTS_KEY_NAME: label["contents"]
        }
        return result

    except Exception as e:
        raise Exception("Calling Shipping API failed", e)


def store_shipment_information(order_id, shipment_id, tracking_id, carrier_id):
    item = {
        constants.SHIPMENTS_TABLE_HASH_KEY_NAME: {'S': order_id},
        constants.SHIPMENTS_TABLE_SHIPMENT_ID_ATTRIBUTE_NAME: {'S': shipment_id},
        constants.SHIPMENTS_TABLE_TRACKING_ID_ATTRIBUTE_NAME: {'S': tracking_id},
        constants.SHIPMENTS_TABLE_CARRIER_ID_ATTRIBUTE_NAME: {'S': carrier_id},
    }

    put_item_request = {
        'TableName': os.environ.get(constants.SHIPMENTS_TABLE_NAME_ENV_VARIABLE),
        'Item': item
    }

    dynamodb = boto3.client(constants.AWS_DYNAMO_DB_CLIENT_KEY_NAME)
    dynamodb.put_item(**put_item_request)


def get_purchase_shipment_request_body(payload):
    supported_specs = payload.rates.preferredRate.supportedDocumentSpecifications[0]
    print_options = supported_specs.printOptions[0]
    page_layout = print_options["supportedPageLayouts"][0]
    document_types = [type_detail["name"] for type_detail in print_options["supportedDocumentDetails"] if
                      type_detail["isMandatory"]]
    needs_file_joining = bool(print_options['supportedFileJoiningOptions'][0])
    additionalInput = payload.rates.preferredRate.additionalInput

    requested_document_specification = {
        "format": supported_specs.format,
        "size": supported_specs.size,
        "needFileJoining": needs_file_joining,
        "pageLayout": page_layout,
        "requestedDocumentTypes": document_types
    }

    request = {
        "requestToken": payload.rates.requestToken,
        "rateId": payload.rates.preferredRate.rateId,
        "requestedDocumentSpecification": requested_document_specification,
        "additionalInputs": additionalInput,
        "requestedValueAddedServices": [{
                "id": shipping_preferences.VALUE_ADDED_SERVICE
        }]
    }

    return json.dumps(request)
```

### 6 - Presign and Print the shipment label

After the label extraction is done, the shipping label is decompressed and decoded for printing.

#### Step-by-step:
1. **S3 client and object are set up:** Prepare the S3 bucket details and the S3 client.
2. **Get the label content:** Get the label content returned from the previous step.
3. **Decode the label content** The label content returned by the api is decoded.
4. **Store to S3:** The decoded label is stored to S3.
5. **Pre-sign:** A pre-signed URL is generated on the label object on S3.

**Python**

*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/shipping-v2/code/python/src/presign_s3_label_handler.py)*

```python
        # Create S3 Bucket Name
        s3_bucket_name = os.environ.get(constants.LABELS_S3_BUCKET_NAME_ENV_VARIABLE)

        # Extract order ID from event
        order_id = presign_label_lambda_input.credentials.orderId

        object_key = f"{order_id}/{uuid.uuid4()}"

        label = presign_label_lambda_input.label.fileContents
        label_format = presign_label_lambda_input.label.labelFormat

        # Store the label in S3
        store_label(s3_bucket_name, object_key, label, label_format)

        # Generate a presigned URL to browse the label
        presigned_url = generate_presigned_url(s3_bucket_name, object_key)

        return presigned_url

def generate_presigned_url(s3_bucket_name, object_key):
    s3 = boto3.client('s3', config=Config(signature_version=constants.AWS_SIGNATURE_VERSION))
    presigned_url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': s3_bucket_name, 'Key': object_key},
        ExpiresIn=3600  # 1 hour in seconds
    )
    return presigned_url        
```

```python
def store_label(s3_bucket_name, object_key, label_content, label_format):
    label_content_bytes = decode_label_content(label_content)
    input_stream = io.BytesIO(label_content_bytes)

    content_type = 'application/octet-stream'  # Default content type

    if label_format == 'PDF':
        content_type = 'application/pdf'
    elif label_format == 'PNG':
        content_type = 'image/png'
    elif label_format == 'ZPL':
        content_type = 'application/x-zpl'

    metadata = {
        'ContentType': content_type
    }

    s3 = boto3.client('s3', config=Config(signature_version=constants.AWS_SIGNATURE_VERSION))
    s3.upload_fileobj(input_stream, s3_bucket_name, object_key, ExtraArgs=metadata)


def decode_label_content(label_content):
    label_content_decoded = base64.b64decode(label_content)
    return label_content_decoded
```


