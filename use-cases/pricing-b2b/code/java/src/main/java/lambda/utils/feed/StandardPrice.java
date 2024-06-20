package lambda.utils.feed;

import jakarta.xml.bind.annotation.XmlElement;
import lombok.Getter;
import lombok.Setter;

public class StandardPrice
{

	@XmlElement(name = "currency")
	private String currency;

	public String getCurrency() {
		return currency;
	}

	public void setCurrency(String currency) {
		this.currency = currency;
	}

	@Override
	public String toString()
	{
		return "ClassPojo [currency = "+currency+"]";
	}
}
