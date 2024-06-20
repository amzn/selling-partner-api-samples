package lambda.utils.feed;

import jakarta.xml.bind.annotation.XmlAccessType;
import jakarta.xml.bind.annotation.XmlAccessorType;
import jakarta.xml.bind.annotation.XmlElement;
import jakarta.xml.bind.annotation.XmlRootElement;
import lombok.Setter;

import java.util.List;



@XmlRootElement(name = "AmazonEnvelope")
@XmlAccessorType(XmlAccessType.FIELD)
public class AmazonEnvelope
{
	private Header Header;
	private String MessageType;
	private List<Message> Message;


	//@XmlElement(name = "Header")
	public lambda.utils.feed.Header getHeader() {
		return Header;
	}

	//@XmlElement(name = "MessageType")
	public String getMessageType() {
		return MessageType;
	}
	//@XmlElement(name = "Message")
	public List<lambda.utils.feed.Message> getMessage() {
		return Message;
	}




	public void setHeader(lambda.utils.feed.Header header) {
		Header = header;
	}

	public void setMessageType(String messageType) {
		MessageType = messageType;
	}

	public void setMessage(List<lambda.utils.feed.Message> message) {
		Message = message;
	}
}