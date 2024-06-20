package lambda.utils.feed;

import jakarta.xml.bind.annotation.XmlElement;
import lombok.Getter;
import lombok.Setter;


@Setter
public class Header
{
	private String DocumentVersion;
	private String MerchantIdentifier;


	@XmlElement(name = "MerchantIdentifier")
	public String getMerchantIdentifier() {
		return MerchantIdentifier;
	}

	@XmlElement(name = "DocumentVersion")
	public String getDocumentVersion() {
		return DocumentVersion;
	}

}