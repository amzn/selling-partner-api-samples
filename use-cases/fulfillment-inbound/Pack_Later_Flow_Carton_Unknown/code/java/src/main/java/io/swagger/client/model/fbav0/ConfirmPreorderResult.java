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
 * Result for confirm preorder operation
 */
@ApiModel(description = "Result for confirm preorder operation")
@javax.annotation.Generated(value = "io.swagger.codegen.languages.JavaClientCodegen", date = "2024-05-06T15:45:02.096-05:00")
public class ConfirmPreorderResult {
    @SerializedName("ConfirmedNeedByDate")
    private String confirmedNeedByDate = null;

    @SerializedName("ConfirmedFulfillableDate")
    private String confirmedFulfillableDate = null;

    public ConfirmPreorderResult confirmedNeedByDate(String confirmedNeedByDate) {
        this.confirmedNeedByDate = confirmedNeedByDate;
        return this;
    }

    /**
     * Date passed in with the NeedByDate parameter. The confirmed shipment must arrive at the Amazon fulfillment center by this date to avoid delivery promise breaks for pre-ordered items. In YYYY-MM-DD format.
     *
     * @return confirmedNeedByDate
     **/
    @ApiModelProperty(value = "Date passed in with the NeedByDate parameter. The confirmed shipment must arrive at the Amazon fulfillment center by this date to avoid delivery promise breaks for pre-ordered items. In YYYY-MM-DD format.")
    public String getConfirmedNeedByDate() {
        return confirmedNeedByDate;
    }

    public void setConfirmedNeedByDate(String confirmedNeedByDate) {
        this.confirmedNeedByDate = confirmedNeedByDate;
    }

    public ConfirmPreorderResult confirmedFulfillableDate(String confirmedFulfillableDate) {
        this.confirmedFulfillableDate = confirmedFulfillableDate;
        return this;
    }

    /**
     * Date that determines which pre-order items in the shipment are eligible for pre-order. The pre-order Buy Box will appear for any pre-order item in the shipment with a release date on or after this date. In YYYY-MM-DD format.
     *
     * @return confirmedFulfillableDate
     **/
    @ApiModelProperty(value = "Date that determines which pre-order items in the shipment are eligible for pre-order. The pre-order Buy Box will appear for any pre-order item in the shipment with a release date on or after this date. In YYYY-MM-DD format.")
    public String getConfirmedFulfillableDate() {
        return confirmedFulfillableDate;
    }

    public void setConfirmedFulfillableDate(String confirmedFulfillableDate) {
        this.confirmedFulfillableDate = confirmedFulfillableDate;
    }


    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        ConfirmPreorderResult confirmPreorderResult = (ConfirmPreorderResult) o;
        return Objects.equals(this.confirmedNeedByDate, confirmPreorderResult.confirmedNeedByDate) &&
                Objects.equals(this.confirmedFulfillableDate, confirmPreorderResult.confirmedFulfillableDate);
    }

    @Override
    public int hashCode() {
        return Objects.hash(confirmedNeedByDate, confirmedFulfillableDate);
    }


    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("class ConfirmPreorderResult {\n");

        sb.append("    confirmedNeedByDate: ").append(toIndentedString(confirmedNeedByDate)).append("\n");
        sb.append("    confirmedFulfillableDate: ").append(toIndentedString(confirmedFulfillableDate)).append("\n");
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

