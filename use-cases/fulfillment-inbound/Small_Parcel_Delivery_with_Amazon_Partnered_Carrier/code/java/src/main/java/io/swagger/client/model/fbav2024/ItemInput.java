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
import io.swagger.client.model.fbav2024.LabelOwner;
import io.swagger.client.model.fbav2024.PrepOwner;
import java.io.IOException;

/**
 * Defines an item&#39;s input parameters.
 */
@ApiModel(description = "Defines an item's input parameters.")
@javax.annotation.Generated(value = "io.swagger.codegen.languages.JavaClientCodegen", date = "2024-06-05T21:26:38.822Z")
public class ItemInput {
  @SerializedName("expiration")
  private String expiration = null;

  @SerializedName("labelOwner")
  private LabelOwner labelOwner = null;

  @SerializedName("manufacturingLotCode")
  private String manufacturingLotCode = null;

  @SerializedName("msku")
  private String msku = null;

  @SerializedName("prepOwner")
  private PrepOwner prepOwner = null;

  @SerializedName("quantity")
  private Integer quantity = null;

  public ItemInput expiration(String expiration) {
    this.expiration = expiration;
    return this;
  }

   /**
   * The expiration date of the MSKU in ISO 8601 format. The same MSKU with different expiration dates cannot go into the same box.
   * @return expiration
  **/
  @ApiModelProperty(value = "The expiration date of the MSKU in ISO 8601 format. The same MSKU with different expiration dates cannot go into the same box.")
  public String getExpiration() {
    return expiration;
  }

  public void setExpiration(String expiration) {
    this.expiration = expiration;
  }

  public ItemInput labelOwner(LabelOwner labelOwner) {
    this.labelOwner = labelOwner;
    return this;
  }

   /**
   * Get labelOwner
   * @return labelOwner
  **/
  @ApiModelProperty(required = true, value = "")
  public LabelOwner getLabelOwner() {
    return labelOwner;
  }

  public void setLabelOwner(LabelOwner labelOwner) {
    this.labelOwner = labelOwner;
  }

  public ItemInput manufacturingLotCode(String manufacturingLotCode) {
    this.manufacturingLotCode = manufacturingLotCode;
    return this;
  }

   /**
   * The manufacturing lot code.
   * @return manufacturingLotCode
  **/
  @ApiModelProperty(value = "The manufacturing lot code.")
  public String getManufacturingLotCode() {
    return manufacturingLotCode;
  }

  public void setManufacturingLotCode(String manufacturingLotCode) {
    this.manufacturingLotCode = manufacturingLotCode;
  }

  public ItemInput msku(String msku) {
    this.msku = msku;
    return this;
  }

   /**
   * Merchant SKU.
   * @return msku
  **/
  @ApiModelProperty(required = true, value = "Merchant SKU.")
  public String getMsku() {
    return msku;
  }

  public void setMsku(String msku) {
    this.msku = msku;
  }

  public ItemInput prepOwner(PrepOwner prepOwner) {
    this.prepOwner = prepOwner;
    return this;
  }

   /**
   * Get prepOwner
   * @return prepOwner
  **/
  @ApiModelProperty(required = true, value = "")
  public PrepOwner getPrepOwner() {
    return prepOwner;
  }

  public void setPrepOwner(PrepOwner prepOwner) {
    this.prepOwner = prepOwner;
  }

  public ItemInput quantity(Integer quantity) {
    this.quantity = quantity;
    return this;
  }

   /**
   * The number of units of the specified msku that will be shipped.
   * minimum: 1
   * maximum: 10000
   * @return quantity
  **/
  @ApiModelProperty(required = true, value = "The number of units of the specified msku that will be shipped.")
  public Integer getQuantity() {
    return quantity;
  }

  public void setQuantity(Integer quantity) {
    this.quantity = quantity;
  }


  @Override
  public boolean equals(java.lang.Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    ItemInput itemInput = (ItemInput) o;
    return Objects.equals(this.expiration, itemInput.expiration) &&
        Objects.equals(this.labelOwner, itemInput.labelOwner) &&
        Objects.equals(this.manufacturingLotCode, itemInput.manufacturingLotCode) &&
        Objects.equals(this.msku, itemInput.msku) &&
        Objects.equals(this.prepOwner, itemInput.prepOwner) &&
        Objects.equals(this.quantity, itemInput.quantity);
  }

  @Override
  public int hashCode() {
    return Objects.hash(expiration, labelOwner, manufacturingLotCode, msku, prepOwner, quantity);
  }


  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class ItemInput {\n");
    
    sb.append("    expiration: ").append(toIndentedString(expiration)).append("\n");
    sb.append("    labelOwner: ").append(toIndentedString(labelOwner)).append("\n");
    sb.append("    manufacturingLotCode: ").append(toIndentedString(manufacturingLotCode)).append("\n");
    sb.append("    msku: ").append(toIndentedString(msku)).append("\n");
    sb.append("    prepOwner: ").append(toIndentedString(prepOwner)).append("\n");
    sb.append("    quantity: ").append(toIndentedString(quantity)).append("\n");
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
