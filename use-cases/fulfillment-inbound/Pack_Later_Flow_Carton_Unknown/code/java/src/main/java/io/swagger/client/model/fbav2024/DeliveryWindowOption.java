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

import java.io.IOException;

import org.threeten.bp.OffsetDateTime;

/**
 * Contains information pertaining to a delivery window option.
 */
@ApiModel(description = "Contains information pertaining to a delivery window option.")
@javax.annotation.Generated(value = "io.swagger.codegen.languages.JavaClientCodegen", date = "2024-06-05T21:26:38.822Z")
public class DeliveryWindowOption {
    @SerializedName("availabilityType")
    private String availabilityType = null;

    @SerializedName("deliveryWindowOptionId")
    private String deliveryWindowOptionId = null;

    @SerializedName("endDate")
    private OffsetDateTime endDate = null;

    @SerializedName("startDate")
    private OffsetDateTime startDate = null;

    @SerializedName("validUntil")
    private OffsetDateTime validUntil = null;

    public DeliveryWindowOption availabilityType(String availabilityType) {
        this.availabilityType = availabilityType;
        return this;
    }

    /**
     * Identifies type of Delivery Window Availability. Values: &#x60;AVAILABLE&#x60;, &#x60;CONGESTED&#x60;
     *
     * @return availabilityType
     **/
    @ApiModelProperty(required = true, value = "Identifies type of Delivery Window Availability. Values: `AVAILABLE`, `CONGESTED`")
    public String getAvailabilityType() {
        return availabilityType;
    }

    public void setAvailabilityType(String availabilityType) {
        this.availabilityType = availabilityType;
    }

    public DeliveryWindowOption deliveryWindowOptionId(String deliveryWindowOptionId) {
        this.deliveryWindowOptionId = deliveryWindowOptionId;
        return this;
    }

    /**
     * Identifier of a delivery window option. A delivery window option represent one option for when a shipment is expected to be delivered.
     *
     * @return deliveryWindowOptionId
     **/
    @ApiModelProperty(required = true, value = "Identifier of a delivery window option. A delivery window option represent one option for when a shipment is expected to be delivered.")
    public String getDeliveryWindowOptionId() {
        return deliveryWindowOptionId;
    }

    public void setDeliveryWindowOptionId(String deliveryWindowOptionId) {
        this.deliveryWindowOptionId = deliveryWindowOptionId;
    }

    public DeliveryWindowOption endDate(OffsetDateTime endDate) {
        this.endDate = endDate;
        return this;
    }

    /**
     * The timestamp at which this delivery window option ends. This is based in ISO 8601 datetime with pattern &#x60;yyyy-MM-ddTHH:mm:ss.sssZ&#x60;.
     *
     * @return endDate
     **/
    @ApiModelProperty(required = true, value = "The timestamp at which this delivery window option ends. This is based in ISO 8601 datetime with pattern `yyyy-MM-ddTHH:mm:ss.sssZ`.")
    public OffsetDateTime getEndDate() {
        return endDate;
    }

    public void setEndDate(OffsetDateTime endDate) {
        this.endDate = endDate;
    }

    public DeliveryWindowOption startDate(OffsetDateTime startDate) {
        this.startDate = startDate;
        return this;
    }

    /**
     * The timestamp at which this delivery window option starts. This is based in ISO 8601 datetime with pattern &#x60;yyyy-MM-ddTHH:mm:ss.sssZ&#x60;.
     *
     * @return startDate
     **/
    @ApiModelProperty(required = true, value = "The timestamp at which this delivery window option starts. This is based in ISO 8601 datetime with pattern `yyyy-MM-ddTHH:mm:ss.sssZ`.")
    public OffsetDateTime getStartDate() {
        return startDate;
    }

    public void setStartDate(OffsetDateTime startDate) {
        this.startDate = startDate;
    }

    public DeliveryWindowOption validUntil(OffsetDateTime validUntil) {
        this.validUntil = validUntil;
        return this;
    }

    /**
     * The timestamp at which this window delivery option becomes no longer valid. This is based in ISO 8601 datetime with pattern &#x60;yyyy-MM-ddTHH:mm:ss.sssZ&#x60;.
     *
     * @return validUntil
     **/
    @ApiModelProperty(required = true, value = "The timestamp at which this window delivery option becomes no longer valid. This is based in ISO 8601 datetime with pattern `yyyy-MM-ddTHH:mm:ss.sssZ`.")
    public OffsetDateTime getValidUntil() {
        return validUntil;
    }

    public void setValidUntil(OffsetDateTime validUntil) {
        this.validUntil = validUntil;
    }


    @Override
    public boolean equals(java.lang.Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        DeliveryWindowOption deliveryWindowOption = (DeliveryWindowOption) o;
        return Objects.equals(this.availabilityType, deliveryWindowOption.availabilityType) &&
                Objects.equals(this.deliveryWindowOptionId, deliveryWindowOption.deliveryWindowOptionId) &&
                Objects.equals(this.endDate, deliveryWindowOption.endDate) &&
                Objects.equals(this.startDate, deliveryWindowOption.startDate) &&
                Objects.equals(this.validUntil, deliveryWindowOption.validUntil);
    }

    @Override
    public int hashCode() {
        return Objects.hash(availabilityType, deliveryWindowOptionId, endDate, startDate, validUntil);
    }


    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("class DeliveryWindowOption {\n");

        sb.append("    availabilityType: ").append(toIndentedString(availabilityType)).append("\n");
        sb.append("    deliveryWindowOptionId: ").append(toIndentedString(deliveryWindowOptionId)).append("\n");
        sb.append("    endDate: ").append(toIndentedString(endDate)).append("\n");
        sb.append("    startDate: ").append(toIndentedString(startDate)).append("\n");
        sb.append("    validUntil: ").append(toIndentedString(validUntil)).append("\n");
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

