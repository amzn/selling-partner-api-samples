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
import io.swagger.client.model.fbav2024.Pagination;
import io.swagger.client.model.fbav2024.SelfShipAppointmentSlotsAvailability;
import java.io.IOException;

/**
 * The &#x60;getSelfShipAppointmentSlots&#x60; response.
 */
@ApiModel(description = "The `getSelfShipAppointmentSlots` response.")
@javax.annotation.Generated(value = "io.swagger.codegen.languages.JavaClientCodegen", date = "2024-06-05T21:26:38.822Z")
public class GetSelfShipAppointmentSlotsResponse {
  @SerializedName("pagination")
  private Pagination pagination = null;

  @SerializedName("selfShipAppointmentSlotsAvailability")
  private SelfShipAppointmentSlotsAvailability selfShipAppointmentSlotsAvailability = null;

  public GetSelfShipAppointmentSlotsResponse pagination(Pagination pagination) {
    this.pagination = pagination;
    return this;
  }

   /**
   * Get pagination
   * @return pagination
  **/
  @ApiModelProperty(value = "")
  public Pagination getPagination() {
    return pagination;
  }

  public void setPagination(Pagination pagination) {
    this.pagination = pagination;
  }

  public GetSelfShipAppointmentSlotsResponse selfShipAppointmentSlotsAvailability(SelfShipAppointmentSlotsAvailability selfShipAppointmentSlotsAvailability) {
    this.selfShipAppointmentSlotsAvailability = selfShipAppointmentSlotsAvailability;
    return this;
  }

   /**
   * Get selfShipAppointmentSlotsAvailability
   * @return selfShipAppointmentSlotsAvailability
  **/
  @ApiModelProperty(required = true, value = "")
  public SelfShipAppointmentSlotsAvailability getSelfShipAppointmentSlotsAvailability() {
    return selfShipAppointmentSlotsAvailability;
  }

  public void setSelfShipAppointmentSlotsAvailability(SelfShipAppointmentSlotsAvailability selfShipAppointmentSlotsAvailability) {
    this.selfShipAppointmentSlotsAvailability = selfShipAppointmentSlotsAvailability;
  }


  @Override
  public boolean equals(java.lang.Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    GetSelfShipAppointmentSlotsResponse getSelfShipAppointmentSlotsResponse = (GetSelfShipAppointmentSlotsResponse) o;
    return Objects.equals(this.pagination, getSelfShipAppointmentSlotsResponse.pagination) &&
        Objects.equals(this.selfShipAppointmentSlotsAvailability, getSelfShipAppointmentSlotsResponse.selfShipAppointmentSlotsAvailability);
  }

  @Override
  public int hashCode() {
    return Objects.hash(pagination, selfShipAppointmentSlotsAvailability);
  }


  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class GetSelfShipAppointmentSlotsResponse {\n");
    
    sb.append("    pagination: ").append(toIndentedString(pagination)).append("\n");
    sb.append("    selfShipAppointmentSlotsAvailability: ").append(toIndentedString(selfShipAppointmentSlotsAvailability)).append("\n");
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
