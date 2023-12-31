/* 
 * Selling Partner API for Direct Fulfillment Shipping
 *
 * The Selling Partner API for Direct Fulfillment Shipping provides programmatic access to a direct fulfillment vendor's shipping data.
 *
 * OpenAPI spec version: 2021-12-28
 * 
 * Generated by: https://github.com/swagger-api/swagger-codegen.git
 */

using System;
using System.Linq;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Collections;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Runtime.Serialization;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;
using System.ComponentModel.DataAnnotations;
using SwaggerDateConverter = spApiCsharpApp.swaggerClient.Client.SwaggerDateConverter;

namespace spApiCsharpApp.swaggerClient.Model.DirectFulfillmentShipping
{
    /// <summary>
    /// SubmitShipmentStatusUpdatesRequest
    /// </summary>
    [DataContract]
    public partial class SubmitShipmentStatusUpdatesRequest :  IEquatable<SubmitShipmentStatusUpdatesRequest>, IValidatableObject
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="SubmitShipmentStatusUpdatesRequest" /> class.
        /// </summary>
        /// <param name="shipmentStatusUpdates">shipmentStatusUpdates.</param>
        public SubmitShipmentStatusUpdatesRequest(List<ShipmentStatusUpdate> shipmentStatusUpdates = default(List<ShipmentStatusUpdate>))
        {
            this.ShipmentStatusUpdates = shipmentStatusUpdates;
        }
        
        /// <summary>
        /// Gets or Sets ShipmentStatusUpdates
        /// </summary>
        [DataMember(Name="shipmentStatusUpdates", EmitDefaultValue=false)]
        public List<ShipmentStatusUpdate> ShipmentStatusUpdates { get; set; }

        /// <summary>
        /// Returns the string presentation of the object
        /// </summary>
        /// <returns>String presentation of the object</returns>
        public override string ToString()
        {
            var sb = new StringBuilder();
            sb.Append("class SubmitShipmentStatusUpdatesRequest {\n");
            sb.Append("  ShipmentStatusUpdates: ").Append(ShipmentStatusUpdates).Append("\n");
            sb.Append("}\n");
            return sb.ToString();
        }
  
        /// <summary>
        /// Returns the JSON string presentation of the object
        /// </summary>
        /// <returns>JSON string presentation of the object</returns>
        public virtual string ToJson()
        {
            return JsonConvert.SerializeObject(this, Formatting.Indented);
        }

        /// <summary>
        /// Returns true if objects are equal
        /// </summary>
        /// <param name="input">Object to be compared</param>
        /// <returns>Boolean</returns>
        public override bool Equals(object input)
        {
            return this.Equals(input as SubmitShipmentStatusUpdatesRequest);
        }

        /// <summary>
        /// Returns true if SubmitShipmentStatusUpdatesRequest instances are equal
        /// </summary>
        /// <param name="input">Instance of SubmitShipmentStatusUpdatesRequest to be compared</param>
        /// <returns>Boolean</returns>
        public bool Equals(SubmitShipmentStatusUpdatesRequest input)
        {
            if (input == null)
                return false;

            return 
                (
                    this.ShipmentStatusUpdates == input.ShipmentStatusUpdates ||
                    this.ShipmentStatusUpdates != null &&
                    this.ShipmentStatusUpdates.SequenceEqual(input.ShipmentStatusUpdates)
                );
        }

        /// <summary>
        /// Gets the hash code
        /// </summary>
        /// <returns>Hash code</returns>
        public override int GetHashCode()
        {
            unchecked // Overflow is fine, just wrap
            {
                int hashCode = 41;
                if (this.ShipmentStatusUpdates != null)
                    hashCode = hashCode * 59 + this.ShipmentStatusUpdates.GetHashCode();
                return hashCode;
            }
        }

        /// <summary>
        /// To validate all properties of the instance
        /// </summary>
        /// <param name="validationContext">Validation context</param>
        /// <returns>Validation Result</returns>
        IEnumerable<System.ComponentModel.DataAnnotations.ValidationResult> IValidatableObject.Validate(ValidationContext validationContext)
        {
            yield break;
        }
    }

}
