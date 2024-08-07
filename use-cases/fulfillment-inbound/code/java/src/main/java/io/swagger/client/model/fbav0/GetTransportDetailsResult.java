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
 * Result for the get transport details operation
 */
@ApiModel(description = "Result for the get transport details operation")
@javax.annotation.Generated(value = "io.swagger.codegen.languages.JavaClientCodegen", date = "2024-05-06T15:45:02.096-05:00")
public class GetTransportDetailsResult {
  @SerializedName("TransportContent")
  private TransportContent transportContent = null;

  public GetTransportDetailsResult transportContent(TransportContent transportContent) {
    this.transportContent = transportContent;
    return this;
  }

   /**
   * Get transportContent
   * @return transportContent
  **/
  @ApiModelProperty(value = "")
  public TransportContent getTransportContent() {
    return transportContent;
  }

  public void setTransportContent(TransportContent transportContent) {
    this.transportContent = transportContent;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    GetTransportDetailsResult getTransportDetailsResult = (GetTransportDetailsResult) o;
    return Objects.equals(this.transportContent, getTransportDetailsResult.transportContent);
  }

  @Override
  public int hashCode() {
    return Objects.hash(transportContent);
  }


  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class GetTransportDetailsResult {\n");
    
    sb.append("    transportContent: ").append(toIndentedString(transportContent)).append("\n");
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
