package lambda.utils.feed;

import jakarta.xml.bind.annotation.XmlElement;
import lombok.Getter;
import lombok.Setter;


@Setter
public class Message
{
	private String MessageID;
	private Price Price;

	@XmlElement(name = "Price")
	public lambda.utils.feed.Price getPrice() {
		return Price;
	}

	@XmlElement(name = "MessageID")
	public String getMessageID() {
		return MessageID;
	}

}
