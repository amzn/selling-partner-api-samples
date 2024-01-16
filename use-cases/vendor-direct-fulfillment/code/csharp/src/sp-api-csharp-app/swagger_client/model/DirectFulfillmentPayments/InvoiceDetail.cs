/* 
 * Selling Partner API for Direct Fulfillment Payments
 *
 * The Selling Partner API for Direct Fulfillment Payments provides programmatic access to a direct fulfillment vendor's invoice data.
 *
 * OpenAPI spec version: v1
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

namespace spApiCsharpApp.swaggerClient.Model.DirectFulfillmentPayments
{
    /// <summary>
    /// InvoiceDetail
    /// </summary>
    [DataContract]
    public partial class InvoiceDetail :  IEquatable<InvoiceDetail>, IValidatableObject
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="InvoiceDetail" /> class.
        /// </summary>
        [JsonConstructorAttribute]
        protected InvoiceDetail() { }
        /// <summary>
        /// Initializes a new instance of the <see cref="InvoiceDetail" /> class.
        /// </summary>
        /// <param name="invoiceNumber">The unique invoice number. (required).</param>
        /// <param name="invoiceDate">Invoice date. (required).</param>
        /// <param name="referenceNumber">An additional unique reference number used for regulatory or other purposes..</param>
        /// <param name="remitToParty">Name, address and tax details of the party receiving the payment of this invoice. (required).</param>
        /// <param name="shipFromParty">Warehouse code of the vendor as in the order. (required).</param>
        /// <param name="billToParty">Name, address and tax details of the party to whom this invoice is issued..</param>
        /// <param name="shipToCountryCode">Ship-to country code..</param>
        /// <param name="paymentTermsCode">The payment terms for the invoice..</param>
        /// <param name="invoiceTotal">Total amount details of the invoice. (required).</param>
        /// <param name="taxTotals">Individual tax details per line item..</param>
        /// <param name="additionalDetails">Additional details provided by the selling party, for tax-related or other purposes..</param>
        /// <param name="chargeDetails">Total charge amount details for all line items..</param>
        /// <param name="items">Provides the details of the items in this invoice. (required).</param>
        public InvoiceDetail(string invoiceNumber = default(string), DateTime? invoiceDate = default(DateTime?), string referenceNumber = default(string), PartyIdentification remitToParty = default(PartyIdentification), PartyIdentification shipFromParty = default(PartyIdentification), PartyIdentification billToParty = default(PartyIdentification), string shipToCountryCode = default(string), string paymentTermsCode = default(string), Money invoiceTotal = default(Money), List<TaxDetail> taxTotals = default(List<TaxDetail>), List<AdditionalDetails> additionalDetails = default(List<AdditionalDetails>), List<ChargeDetails> chargeDetails = default(List<ChargeDetails>), List<InvoiceItem> items = default(List<InvoiceItem>))
        {
            // to ensure "invoiceNumber" is required (not null)
            if (invoiceNumber == null)
            {
                throw new InvalidDataException("invoiceNumber is a required property for InvoiceDetail and cannot be null");
            }
            else
            {
                this.InvoiceNumber = invoiceNumber;
            }
            // to ensure "invoiceDate" is required (not null)
            if (invoiceDate == null)
            {
                throw new InvalidDataException("invoiceDate is a required property for InvoiceDetail and cannot be null");
            }
            else
            {
                this.InvoiceDate = invoiceDate;
            }
            // to ensure "remitToParty" is required (not null)
            if (remitToParty == null)
            {
                throw new InvalidDataException("remitToParty is a required property for InvoiceDetail and cannot be null");
            }
            else
            {
                this.RemitToParty = remitToParty;
            }
            // to ensure "shipFromParty" is required (not null)
            if (shipFromParty == null)
            {
                throw new InvalidDataException("shipFromParty is a required property for InvoiceDetail and cannot be null");
            }
            else
            {
                this.ShipFromParty = shipFromParty;
            }
            // to ensure "invoiceTotal" is required (not null)
            if (invoiceTotal == null)
            {
                throw new InvalidDataException("invoiceTotal is a required property for InvoiceDetail and cannot be null");
            }
            else
            {
                this.InvoiceTotal = invoiceTotal;
            }
            // to ensure "items" is required (not null)
            if (items == null)
            {
                throw new InvalidDataException("items is a required property for InvoiceDetail and cannot be null");
            }
            else
            {
                this.Items = items;
            }
            this.ReferenceNumber = referenceNumber;
            this.BillToParty = billToParty;
            this.ShipToCountryCode = shipToCountryCode;
            this.PaymentTermsCode = paymentTermsCode;
            this.TaxTotals = taxTotals;
            this.AdditionalDetails = additionalDetails;
            this.ChargeDetails = chargeDetails;
        }
        
        /// <summary>
        /// The unique invoice number.
        /// </summary>
        /// <value>The unique invoice number.</value>
        [DataMember(Name="invoiceNumber", EmitDefaultValue=false)]
        public string InvoiceNumber { get; set; }

        /// <summary>
        /// Invoice date.
        /// </summary>
        /// <value>Invoice date.</value>
        [DataMember(Name="invoiceDate", EmitDefaultValue=false)]
        public DateTime? InvoiceDate { get; set; }

        /// <summary>
        /// An additional unique reference number used for regulatory or other purposes.
        /// </summary>
        /// <value>An additional unique reference number used for regulatory or other purposes.</value>
        [DataMember(Name="referenceNumber", EmitDefaultValue=false)]
        public string ReferenceNumber { get; set; }

        /// <summary>
        /// Name, address and tax details of the party receiving the payment of this invoice.
        /// </summary>
        /// <value>Name, address and tax details of the party receiving the payment of this invoice.</value>
        [DataMember(Name="remitToParty", EmitDefaultValue=false)]
        public PartyIdentification RemitToParty { get; set; }

        /// <summary>
        /// Warehouse code of the vendor as in the order.
        /// </summary>
        /// <value>Warehouse code of the vendor as in the order.</value>
        [DataMember(Name="shipFromParty", EmitDefaultValue=false)]
        public PartyIdentification ShipFromParty { get; set; }

        /// <summary>
        /// Name, address and tax details of the party to whom this invoice is issued.
        /// </summary>
        /// <value>Name, address and tax details of the party to whom this invoice is issued.</value>
        [DataMember(Name="billToParty", EmitDefaultValue=false)]
        public PartyIdentification BillToParty { get; set; }

        /// <summary>
        /// Ship-to country code.
        /// </summary>
        /// <value>Ship-to country code.</value>
        [DataMember(Name="shipToCountryCode", EmitDefaultValue=false)]
        public string ShipToCountryCode { get; set; }

        /// <summary>
        /// The payment terms for the invoice.
        /// </summary>
        /// <value>The payment terms for the invoice.</value>
        [DataMember(Name="paymentTermsCode", EmitDefaultValue=false)]
        public string PaymentTermsCode { get; set; }

        /// <summary>
        /// Total amount details of the invoice.
        /// </summary>
        /// <value>Total amount details of the invoice.</value>
        [DataMember(Name="invoiceTotal", EmitDefaultValue=false)]
        public Money InvoiceTotal { get; set; }

        /// <summary>
        /// Individual tax details per line item.
        /// </summary>
        /// <value>Individual tax details per line item.</value>
        [DataMember(Name="taxTotals", EmitDefaultValue=false)]
        public List<TaxDetail> TaxTotals { get; set; }

        /// <summary>
        /// Additional details provided by the selling party, for tax-related or other purposes.
        /// </summary>
        /// <value>Additional details provided by the selling party, for tax-related or other purposes.</value>
        [DataMember(Name="additionalDetails", EmitDefaultValue=false)]
        public List<AdditionalDetails> AdditionalDetails { get; set; }

        /// <summary>
        /// Total charge amount details for all line items.
        /// </summary>
        /// <value>Total charge amount details for all line items.</value>
        [DataMember(Name="chargeDetails", EmitDefaultValue=false)]
        public List<ChargeDetails> ChargeDetails { get; set; }

        /// <summary>
        /// Provides the details of the items in this invoice.
        /// </summary>
        /// <value>Provides the details of the items in this invoice.</value>
        [DataMember(Name="items", EmitDefaultValue=false)]
        public List<InvoiceItem> Items { get; set; }

        /// <summary>
        /// Returns the string presentation of the object
        /// </summary>
        /// <returns>String presentation of the object</returns>
        public override string ToString()
        {
            var sb = new StringBuilder();
            sb.Append("class InvoiceDetail {\n");
            sb.Append("  InvoiceNumber: ").Append(InvoiceNumber).Append("\n");
            sb.Append("  InvoiceDate: ").Append(InvoiceDate).Append("\n");
            sb.Append("  ReferenceNumber: ").Append(ReferenceNumber).Append("\n");
            sb.Append("  RemitToParty: ").Append(RemitToParty).Append("\n");
            sb.Append("  ShipFromParty: ").Append(ShipFromParty).Append("\n");
            sb.Append("  BillToParty: ").Append(BillToParty).Append("\n");
            sb.Append("  ShipToCountryCode: ").Append(ShipToCountryCode).Append("\n");
            sb.Append("  PaymentTermsCode: ").Append(PaymentTermsCode).Append("\n");
            sb.Append("  InvoiceTotal: ").Append(InvoiceTotal).Append("\n");
            sb.Append("  TaxTotals: ").Append(TaxTotals).Append("\n");
            sb.Append("  AdditionalDetails: ").Append(AdditionalDetails).Append("\n");
            sb.Append("  ChargeDetails: ").Append(ChargeDetails).Append("\n");
            sb.Append("  Items: ").Append(Items).Append("\n");
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
            return this.Equals(input as InvoiceDetail);
        }

        /// <summary>
        /// Returns true if InvoiceDetail instances are equal
        /// </summary>
        /// <param name="input">Instance of InvoiceDetail to be compared</param>
        /// <returns>Boolean</returns>
        public bool Equals(InvoiceDetail input)
        {
            if (input == null)
                return false;

            return 
                (
                    this.InvoiceNumber == input.InvoiceNumber ||
                    (this.InvoiceNumber != null &&
                    this.InvoiceNumber.Equals(input.InvoiceNumber))
                ) && 
                (
                    this.InvoiceDate == input.InvoiceDate ||
                    (this.InvoiceDate != null &&
                    this.InvoiceDate.Equals(input.InvoiceDate))
                ) && 
                (
                    this.ReferenceNumber == input.ReferenceNumber ||
                    (this.ReferenceNumber != null &&
                    this.ReferenceNumber.Equals(input.ReferenceNumber))
                ) && 
                (
                    this.RemitToParty == input.RemitToParty ||
                    (this.RemitToParty != null &&
                    this.RemitToParty.Equals(input.RemitToParty))
                ) && 
                (
                    this.ShipFromParty == input.ShipFromParty ||
                    (this.ShipFromParty != null &&
                    this.ShipFromParty.Equals(input.ShipFromParty))
                ) && 
                (
                    this.BillToParty == input.BillToParty ||
                    (this.BillToParty != null &&
                    this.BillToParty.Equals(input.BillToParty))
                ) && 
                (
                    this.ShipToCountryCode == input.ShipToCountryCode ||
                    (this.ShipToCountryCode != null &&
                    this.ShipToCountryCode.Equals(input.ShipToCountryCode))
                ) && 
                (
                    this.PaymentTermsCode == input.PaymentTermsCode ||
                    (this.PaymentTermsCode != null &&
                    this.PaymentTermsCode.Equals(input.PaymentTermsCode))
                ) && 
                (
                    this.InvoiceTotal == input.InvoiceTotal ||
                    (this.InvoiceTotal != null &&
                    this.InvoiceTotal.Equals(input.InvoiceTotal))
                ) && 
                (
                    this.TaxTotals == input.TaxTotals ||
                    this.TaxTotals != null &&
                    this.TaxTotals.SequenceEqual(input.TaxTotals)
                ) && 
                (
                    this.AdditionalDetails == input.AdditionalDetails ||
                    this.AdditionalDetails != null &&
                    this.AdditionalDetails.SequenceEqual(input.AdditionalDetails)
                ) && 
                (
                    this.ChargeDetails == input.ChargeDetails ||
                    this.ChargeDetails != null &&
                    this.ChargeDetails.SequenceEqual(input.ChargeDetails)
                ) && 
                (
                    this.Items == input.Items ||
                    this.Items != null &&
                    this.Items.SequenceEqual(input.Items)
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
                if (this.InvoiceNumber != null)
                    hashCode = hashCode * 59 + this.InvoiceNumber.GetHashCode();
                if (this.InvoiceDate != null)
                    hashCode = hashCode * 59 + this.InvoiceDate.GetHashCode();
                if (this.ReferenceNumber != null)
                    hashCode = hashCode * 59 + this.ReferenceNumber.GetHashCode();
                if (this.RemitToParty != null)
                    hashCode = hashCode * 59 + this.RemitToParty.GetHashCode();
                if (this.ShipFromParty != null)
                    hashCode = hashCode * 59 + this.ShipFromParty.GetHashCode();
                if (this.BillToParty != null)
                    hashCode = hashCode * 59 + this.BillToParty.GetHashCode();
                if (this.ShipToCountryCode != null)
                    hashCode = hashCode * 59 + this.ShipToCountryCode.GetHashCode();
                if (this.PaymentTermsCode != null)
                    hashCode = hashCode * 59 + this.PaymentTermsCode.GetHashCode();
                if (this.InvoiceTotal != null)
                    hashCode = hashCode * 59 + this.InvoiceTotal.GetHashCode();
                if (this.TaxTotals != null)
                    hashCode = hashCode * 59 + this.TaxTotals.GetHashCode();
                if (this.AdditionalDetails != null)
                    hashCode = hashCode * 59 + this.AdditionalDetails.GetHashCode();
                if (this.ChargeDetails != null)
                    hashCode = hashCode * 59 + this.ChargeDetails.GetHashCode();
                if (this.Items != null)
                    hashCode = hashCode * 59 + this.Items.GetHashCode();
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