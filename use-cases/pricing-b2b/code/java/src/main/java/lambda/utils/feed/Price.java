package lambda.utils.feed;

import jakarta.xml.bind.annotation.XmlElement;
import jakarta.xml.bind.annotation.XmlType;
import lombok.Setter;

@Setter
@XmlType(propOrder = {"SKU","businessPrice","quantityPriceType","quantityPrice"})
public class Price
{
	private String SKU;
	private String BusinessPrice;
	private String QuantityPriceType;
	private QuantityPrice QuantityPrice;


	@XmlElement(name = "SKU")
	public String getSKU() {
		return SKU;
	}
	@XmlElement(name = "BusinessPrice")
	public String getBusinessPrice() {
		return BusinessPrice;
	}
	@XmlElement(name = "QuantityPriceType")
	public String getQuantityPriceType() {
		return QuantityPriceType;
	}
	@XmlElement(name = "QuantityPrice")
	public lambda.utils.feed.QuantityPrice getQuantityPrice() {
		return QuantityPrice;
	}


}