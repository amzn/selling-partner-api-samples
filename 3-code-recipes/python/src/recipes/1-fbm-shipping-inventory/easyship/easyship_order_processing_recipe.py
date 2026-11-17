"""
Easy Ship Order Processing Recipe
==================================
Workflow: Fetch → Acknowledge → Package → Shipping Options → Labels
"""

from typing import Optional
import time
import urllib.request
import webbrowser
import tempfile
import os

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.external_fulfillment_shipments_v2024_09_11 import shipment_processing_api
from spapi.api.external_fulfillment_shipments_v2024_09_11 import shipment_retrieval_api
from spapi.models.external_fulfillment_shipments_v2024_09_11.dimension import Dimension
from spapi.models.external_fulfillment_shipments_v2024_09_11.package import Package
from spapi.models.external_fulfillment_shipments_v2024_09_11.package_dimensions import PackageDimensions
from spapi.models.external_fulfillment_shipments_v2024_09_11.package_line_item import PackageLineItem
from spapi.models.external_fulfillment_shipments_v2024_09_11.packages import Packages
from spapi.models.external_fulfillment_shipments_v2024_09_11.ship_labels_input import ShipLabelsInput
from spapi.models.external_fulfillment_shipments_v2024_09_11.ship_labels_response import ShipLabelsResponse
from spapi.models.external_fulfillment_shipments_v2024_09_11.shipments_response import ShipmentsResponse
from spapi.models.external_fulfillment_shipments_v2024_09_11.shipping_options_response import ShippingOptionsResponse
from spapi.models.external_fulfillment_shipments_v2024_09_11.status import Status
from spapi.models.external_fulfillment_shipments_v2024_09_11.weight import Weight
from spapi.models.external_fulfillment_shipments_v2024_09_11.package_status import PackageStatus
from src.util.recipe import Recipe
from src import config


class EasyShipOrderProcessingRecipe(Recipe):
    """Process Easy Ship orders through the External Fulfillment API."""

    def __init__(
        self,
        config: Optional[SPAPIConfig] = None,
        shipment_retrieval_api: Optional[shipment_retrieval_api.ShipmentRetrievalApi] = None,
        shipment_processing_api: Optional[shipment_processing_api.ShipmentProcessingApi] = None,
        marketplace_id: str = "A1PA6795UKMFR9",  # DE marketplace
        shipment_status: str = PackageStatus.CREATED,
    ) -> None:
        super().__init__(config=config)
        self._shipment_retrieval_api = shipment_retrieval_api
        self._shipment_processing_api = shipment_processing_api
        self.marketplace_id = marketplace_id
        self.shipment_status = shipment_status
        
        self.shipment = None
        self.package_id = f"PKG-{int(time.time())}"
        self.shipping_option_id: Optional[str] = None

    @property
    def shipment_retrieval_api(self) -> shipment_retrieval_api.ShipmentRetrievalApi:
        if self._shipment_retrieval_api is None:
            client = SPAPIClient(
                self.config, 
                oauth_endpoint=f"{config.backend_url}/auth/o2/token",
                endpoint=config.backend_url
            )
            self._shipment_retrieval_api = shipment_retrieval_api.ShipmentRetrievalApi(client.api_client)
        return self._shipment_retrieval_api
    
    @property
    def shipment_processing_api(self) -> shipment_processing_api.ShipmentProcessingApi:
        if self._shipment_processing_api is None:
            client = SPAPIClient(
                self.config, 
                oauth_endpoint=f"{config.backend_url}/auth/o2/token",
                endpoint=config.backend_url
            )
            self._shipment_processing_api = shipment_processing_api.ShipmentProcessingApi(client.api_client)
        return self._shipment_processing_api

    def is_easy_ship_shipment(self, shipment) -> bool:
        """Check if shipment is Easy Ship (shippingType=MARKETPLACE, channelName=MFN)."""
        try:
            return (shipment.shipping_info.shipping_type == "MARKETPLACE" and 
                    shipment.marketplace_attributes.channel_name == "MFN")
        except AttributeError:
            return False

    # -------------------------------------------------------------------------
    # Step 1: Fetch open shipments
    # -------------------------------------------------------------------------
    
    def fetch_open_shipments(self) -> ShipmentsResponse:
        """Step 1: Fetch and filter Easy Ship orders."""
        print("\n--- Step 1: Fetching Easy Ship orders ---")
        
        response = self.shipment_retrieval_api.get_shipments(
            status=self.shipment_status,
            marketplace_id=self.marketplace_id,
        )
        
        easy_ship_shipments = [s for s in (response.shipments or []) if self.is_easy_ship_shipment(s)]
        
        if easy_ship_shipments:
            self.shipment = easy_ship_shipments[0]
            print(f"✅ Found {len(easy_ship_shipments)} Easy Ship order(s) - Shipment ID: {self.shipment.id}")
        else:
            print(f"⚠️  No Easy Ship orders found")
        
        return response

    # -------------------------------------------------------------------------
    # Step 2: Acknowledge shipment
    # -------------------------------------------------------------------------
    
    def acknowledge_shipment(self) -> None:
        """Step 2: Confirm shipment."""
        print("\n--- Step 2: Acknowledging shipment ---")
        
        if not self.shipment:
            print("⚠️  Skipping: No shipment to confirm was found")
            return
        
        self.shipment_processing_api.process_shipment(shipment_id=self.shipment.id, operation="CONFIRM")
        print(f"✅ Shipment {self.shipment.id} confirmed")
        
    # -------------------------------------------------------------------------
    # Step 3: Create packages
    # -------------------------------------------------------------------------

    def create_packages(self) -> None:
        """
        Provide package dimensions, weight, and line items for the shipment.
        Uses recommended package dimensions and weight from the shipment data.
        """
        print("\n--- Step 3: Creating shipment packages ---")
        
        if not self.shipment:
            print("⚠️  Skipping: No shipment available")
            return
        
        if not self.shipment.line_items or len(self.shipment.line_items) == 0:
            print("⚠️  Skipping: No line items in shipment")
            return
        
        # Get recommended package dimensions and weight from shipment
        try:
            recommended_package = self.shipment.shipping_info.recommended_packages[0]
            package_dimensions = recommended_package.dimensions
            package_weight = recommended_package.weight
            
            print(f"Using recommended dimensions: "
                  f"{package_dimensions.length.value}x{package_dimensions.width.value}x{package_dimensions.height.value} "
                  f"{package_dimensions.length.dimension_unit}")
            print(f"Using recommended weight: {package_weight.value} {package_weight.weight_unit}")
        except (AttributeError, IndexError):
            print("⚠️  No recommended package dimensions found, using defaults")
            # Fallback to some default dimensions
            package_dimensions = PackageDimensions(
                length=Dimension(dimension_unit="CM", value=28),
                width=Dimension(dimension_unit="CM", value=26),
                height=Dimension(dimension_unit="CM", value=10)
            )
            package_weight = Weight(value=280, weight_unit="grams")
        
        # Build package line items from shipment line items
        package_line_item = PackageLineItem(
            package_line_item_id=self.shipment.line_items[0].shipment_line_item_id,
            quantity=1
        )
        
        package = Package(
            id=self.package_id,
            dimensions=package_dimensions,
            weight=package_weight,
            package_line_items=[package_line_item]
        )
        
        packages_body = Packages(packages=[package])
        
        self.shipment_processing_api.create_packages(
            shipment_id=self.shipment.id,
            body=packages_body
        )
        
        print("✅ Package created successfully")
        print(f"Package ID: {self.package_id}")

    # -------------------------------------------------------------------------
    # Step 4: Retrieve available shipping options
    # -------------------------------------------------------------------------

    def retrieve_shipping_options(self) -> Optional[ShippingOptionsResponse]:
        """
        Get the list of shipping options provided by the marketplace.
        
        Returns:
            ShippingOptionsResponse containing available shipping options.
        """
        print("\n--- Step 4: Retrieving shipping options ---")
        
        if not self.shipment or not self.package_id:
            print("⚠️  Skipping: Missing shipment or package ID")
            return None
        
        response: ShippingOptionsResponse = self.shipment_processing_api.retrieve_shipping_options(
            shipment_id=self.shipment.id,
            package_id=self.package_id
        )
        
        # For simplicity, this recipe always uses the recommended shipping option if available
        if response.recommended_shipping_option:
            self.shipping_option_id = response.recommended_shipping_option.shipping_option_id
            print(f"✅ Using recommended shipping option")
            print(f"Shipping Option ID: {self.shipping_option_id}")
            if hasattr(response.recommended_shipping_option, 'carrier_name'):
                print(f"Carrier: {response.recommended_shipping_option.carrier_name}")
        elif response.shipping_options and len(response.shipping_options) > 0:
            # Fallback to first option if no recommendation
            first_option = response.shipping_options[0]
            self.shipping_option_id = first_option.id
            
            print(f"✅ Found {len(response.shipping_options)} shipping option(s)")
            print(f"Selected Shipping Option ID: {self.shipping_option_id}")
        else:
            print("⚠️  No shipping options available")
        
        return response

    # -------------------------------------------------------------------------
    # Step 5: Generate shipping labels
    # -------------------------------------------------------------------------

    def generate_shipping_labels(self) -> Optional[ShipLabelsResponse]:
        """
        Generate and retrieve shipping labels for the packages.
        
        Returns:
            ShipLabelsResponse containing generated shipping labels.
        """
        print("\n--- Step 5: Generating shipping labels ---")
        
        if not self.shipment or not self.package_id or not self.shipping_option_id:
            print("⚠️  Skipping: Missing required IDs")
            return None
        
        # Build request body using model class
        labels_input = ShipLabelsInput(package_ids=[self.package_id])
        
        response: ShipLabelsResponse = self.shipment_processing_api.generate_ship_labels(
            shipment_id=self.shipment.id,
            operation="GENERATE",
            shipping_option_id=self.shipping_option_id,
            body=labels_input
        )
        
        if response.package_ship_label_list:
            print("✅ Shipping labels generated successfully")
            print(f"Number of labels: {len(response.package_ship_label_list)}")
            
            # Get the first label for simplicity
            label = response.package_ship_label_list[0]
            print(f"\nPackage ID: {label.package_id}")
            print(f"Tracking ID: {label.ship_label_metadata.tracking_id}")
            print(f"Carrier: {label.ship_label_metadata.carrier_name}")
            
            # Download and open the shipping label
            self._download_and_open_label(label.file_data)
        else:
            print("⚠️  No labels generated")
        
        return response
    
    def _download_and_open_label(self, file_data) -> None:
        """
        Download and open the shipping label from the presigned URL.
        
        The file type is determined from the Content-Type header in the response:
        - x.application/zpl: ZPL format (for thermal printers)
        - application/pdf: PDF format
        - image/png: PNG format
        - text/plain: Plain text format
        
        In production, ZPL labels should be sent to a thermal printer.
        For this recipe, we download and open the label for demonstration.x
        
        """
        try:
            print(f"Downloading label...")
            
            # Download the label and get content type from response header
            with urllib.request.urlopen(file_data.url) as response:
                label_data = response.read()
                content_type = response.headers.get('Content-Type', 'application/octet-stream')
            
            # Determine file extension from content type
            if 'zpl' in content_type.lower():
                file_extension = '.zpl'
                label_format = 'ZPL'
            elif 'pdf' in content_type.lower():
                file_extension = '.pdf'
                label_format = 'PDF'
            elif 'png' in content_type.lower():
                file_extension = '.png'
                label_format = 'PNG'
            else:
                file_extension = '.txt'
                label_format = 'TEXT'
            
            print(f"Label Format: {label_format} (Content-Type: {content_type})")
            
            # Save to temporary file
            temp_file = tempfile.NamedTemporaryFile(
                delete=False,
                suffix=file_extension,
                prefix='shipping_label_'
            )
            temp_file.write(label_data)
            temp_file.close()
            
            print(f"✅ Label saved to: {temp_file.name}")
            
            # In production: Send ZPL files to thermal printer
            if label_format == 'ZPL':
                print(f"ℹ️  Production: Send ZPL file to thermal printer")
            
            # For this recipe: Open the downloaded file
            print(f"🖼️  Opening label...")
            webbrowser.open(f'file://{temp_file.name}')
            
        except Exception as e:
            print(f"❌ Error: {e}")

    # -------------------------------------------------------------------------
    # Main recipe entry point
    # -------------------------------------------------------------------------

    def start(self) -> None:
        """
        Main entry point showing the complete Easy Ship order processing flow.
        """
        print("=" * 70)
        print("Easy Ship Order Processing Recipe")
        print("=" * 70)
        
        # Step 1: Fetch open orders
        self.fetch_open_shipments()
        
        # Step 2: Acknowledge shipment
        self.acknowledge_shipment()
        
        # Step 3: Create packages
        self.create_packages()
        
        # Step 4: Retrieve shipping options
        self.retrieve_shipping_options()
        
        # Step 5: Generate shipping labels
        self.generate_shipping_labels()
        
        print("\n" + "=" * 70)
        print("✅ Easy Ship order processing completed successfully")
        print("=" * 70)


# -----------------------------------------------------------------------------
# Example usage for local/manual runs
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    recipe = EasyShipOrderProcessingRecipe()
    recipe.start()
