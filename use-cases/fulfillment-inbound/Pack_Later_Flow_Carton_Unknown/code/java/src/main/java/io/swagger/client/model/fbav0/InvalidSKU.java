/*
 * Selling Partner API for Fulfillment Inbound
 * The Selling Partner API for Fulfillment Inbound lets you create applications that create and update inbound shipments of inventory to Amazon's fulfillment network.
 *
 * OpenAPI spec version: v0
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */


package io.swagger.client.model.fbav0;

import java.util.Objects;

import com.google.gson.annotations.SerializedName;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

/**
 * Contains detail about an invalid SKU
 */
@ApiModel(description = "Contains detail about an invalid SKU")
@javax.annotation.Generated(value = "io.swagger.codegen.languages.JavaClientCodegen", date = "2024-05-06T15:45:02.096-05:00")
public class InvalidSKU {
    @SerializedName("SellerSKU")
    private String sellerSKU = null;

    @SerializedName("ErrorReason")
    private ErrorReason errorReason = null;

    public InvalidSKU sellerSKU(String sellerSKU) {
        this.sellerSKU = sellerSKU;
        return this;
    }

    /**
     * The seller SKU of the item.
     *
     * @return sellerSKU
     **/
    @ApiModelProperty(value = "The seller SKU of the item.")
    public String getSellerSKU() {
        return sellerSKU;
    }

    public void setSellerSKU(String sellerSKU) {
        this.sellerSKU = sellerSKU;
    }

    public InvalidSKU errorReason(ErrorReason errorReason) {
        this.errorReason = errorReason;
        return this;
    }

    /**
     * The reason why the seller SKU is invalid.
     *
     * @return errorReason
     **/
    @ApiModelProperty(value = "The reason why the seller SKU is invalid.")
    public ErrorReason getErrorReason() {
        return errorReason;
    }

    public void setErrorReason(ErrorReason errorReason) {
        this.errorReason = errorReason;
    }


    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        InvalidSKU invalidSKU = (InvalidSKU) o;
        return Objects.equals(this.sellerSKU, invalidSKU.sellerSKU) &&
                Objects.equals(this.errorReason, invalidSKU.errorReason);
    }

    @Override
    public int hashCode() {
        return Objects.hash(sellerSKU, errorReason);
    }


    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("class InvalidSKU {\n");

        sb.append("    sellerSKU: ").append(toIndentedString(sellerSKU)).append("\n");
        sb.append("    errorReason: ").append(toIndentedString(errorReason)).append("\n");
        sb.append("}");
        return sb.toString();
    }

    /**
     * Convert the given object to string with each line indented by 4 spaces
     * (except the first line).
     */
    private String toIndentedString(Object o) {
        if (o == null) {
            return "null";
        }
        return o.toString().replace("\n", "\n    ");
    }

}

