/*
 * The Selling Partner API for FBA inbound operations.
 * The Selling Partner API for Fulfillment By Amazon (FBA) Inbound. The FBA Inbound API enables building inbound workflows to create, manage, and send shipments into Amazon's fulfillment network. The API has interoperability with the Send-to-Amazon user interface.
 *
 * OpenAPI spec version: 2024-03-20
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */


package io.swagger.client.model.fbav2024;

import java.util.Objects;
import java.util.Arrays;

import com.google.gson.TypeAdapter;
import com.google.gson.annotations.JsonAdapter;
import com.google.gson.annotations.SerializedName;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonWriter;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import io.swagger.client.model.fbav2024.Incentive;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.threeten.bp.OffsetDateTime;

/**
 * Contains information pertaining to the placement of the contents of an inbound plan and the related costs.
 */
@ApiModel(description = "Contains information pertaining to the placement of the contents of an inbound plan and the related costs.")
@javax.annotation.Generated(value = "io.swagger.codegen.languages.JavaClientCodegen", date = "2024-06-05T21:26:38.822Z")
public class PlacementOption {
    @SerializedName("discounts")
    private List<Incentive> discounts = new ArrayList<Incentive>();

    @SerializedName("expiration")
    private OffsetDateTime expiration = null;

    @SerializedName("fees")
    private List<Incentive> fees = new ArrayList<Incentive>();

    @SerializedName("placementOptionId")
    private String placementOptionId = null;

    @SerializedName("shipmentIds")
    private List<String> shipmentIds = new ArrayList<String>();

    @SerializedName("status")
    private String status = null;

    public PlacementOption discounts(List<Incentive> discounts) {
        this.discounts = discounts;
        return this;
    }

    public PlacementOption addDiscountsItem(Incentive discountsItem) {
        this.discounts.add(discountsItem);
        return this;
    }

    /**
     * Discount for the offered option.
     *
     * @return discounts
     **/
    @ApiModelProperty(required = true, value = "Discount for the offered option.")
    public List<Incentive> getDiscounts() {
        return discounts;
    }

    public void setDiscounts(List<Incentive> discounts) {
        this.discounts = discounts;
    }

    public PlacementOption expiration(OffsetDateTime expiration) {
        this.expiration = expiration;
        return this;
    }

    /**
     * The expiration date of the placement option. This is based in ISO 8601 datetime with pattern &#x60;yyyy-MM-ddTHH:mm:ss.sssZ&#x60;.
     *
     * @return expiration
     **/
    @ApiModelProperty(value = "The expiration date of the placement option. This is based in ISO 8601 datetime with pattern `yyyy-MM-ddTHH:mm:ss.sssZ`.")
    public OffsetDateTime getExpiration() {
        return expiration;
    }

    public void setExpiration(OffsetDateTime expiration) {
        this.expiration = expiration;
    }

    public PlacementOption fees(List<Incentive> fees) {
        this.fees = fees;
        return this;
    }

    public PlacementOption addFeesItem(Incentive feesItem) {
        this.fees.add(feesItem);
        return this;
    }

    /**
     * Fee for the offered option.
     *
     * @return fees
     **/
    @ApiModelProperty(required = true, value = "Fee for the offered option.")
    public List<Incentive> getFees() {
        return fees;
    }

    public void setFees(List<Incentive> fees) {
        this.fees = fees;
    }

    public PlacementOption placementOptionId(String placementOptionId) {
        this.placementOptionId = placementOptionId;
        return this;
    }

    /**
     * The identifier of a placement option. A placement option represents the shipment splits and destinations of SKUs.
     *
     * @return placementOptionId
     **/
    @ApiModelProperty(required = true, value = "The identifier of a placement option. A placement option represents the shipment splits and destinations of SKUs.")
    public String getPlacementOptionId() {
        return placementOptionId;
    }

    public void setPlacementOptionId(String placementOptionId) {
        this.placementOptionId = placementOptionId;
    }

    public PlacementOption shipmentIds(List<String> shipmentIds) {
        this.shipmentIds = shipmentIds;
        return this;
    }

    public PlacementOption addShipmentIdsItem(String shipmentIdsItem) {
        this.shipmentIds.add(shipmentIdsItem);
        return this;
    }

    /**
     * Shipment ids.
     *
     * @return shipmentIds
     **/
    @ApiModelProperty(required = true, value = "Shipment ids.")
    public List<String> getShipmentIds() {
        return shipmentIds;
    }

    public void setShipmentIds(List<String> shipmentIds) {
        this.shipmentIds = shipmentIds;
    }

    public PlacementOption status(String status) {
        this.status = status;
        return this;
    }

    /**
     * The status of a placement option. Can be: &#x60;OFFERED&#x60;, &#x60;ACCEPTED&#x60;, or &#x60;EXPIRED&#x60;.
     *
     * @return status
     **/
    @ApiModelProperty(required = true, value = "The status of a placement option. Can be: `OFFERED`, `ACCEPTED`, or `EXPIRED`.")
    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }


    @Override
    public boolean equals(java.lang.Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        PlacementOption placementOption = (PlacementOption) o;
        return Objects.equals(this.discounts, placementOption.discounts) &&
                Objects.equals(this.expiration, placementOption.expiration) &&
                Objects.equals(this.fees, placementOption.fees) &&
                Objects.equals(this.placementOptionId, placementOption.placementOptionId) &&
                Objects.equals(this.shipmentIds, placementOption.shipmentIds) &&
                Objects.equals(this.status, placementOption.status);
    }

    @Override
    public int hashCode() {
        return Objects.hash(discounts, expiration, fees, placementOptionId, shipmentIds, status);
    }


    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("class PlacementOption {\n");

        sb.append("    discounts: ").append(toIndentedString(discounts)).append("\n");
        sb.append("    expiration: ").append(toIndentedString(expiration)).append("\n");
        sb.append("    fees: ").append(toIndentedString(fees)).append("\n");
        sb.append("    placementOptionId: ").append(toIndentedString(placementOptionId)).append("\n");
        sb.append("    shipmentIds: ").append(toIndentedString(shipmentIds)).append("\n");
        sb.append("    status: ").append(toIndentedString(status)).append("\n");
        sb.append("}");
        return sb.toString();
    }

    /**
     * Convert the given object to string with each line indented by 4 spaces
     * (except the first line).
     */
    private String toIndentedString(java.lang.Object o) {
        if (o == null) {
            return "null";
        }
        return o.toString().replace("\n", "\n    ");
    }

}

