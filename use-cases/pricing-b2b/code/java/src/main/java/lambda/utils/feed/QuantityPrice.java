package lambda.utils.feed;

import jakarta.xml.bind.annotation.XmlElement;
import jakarta.xml.bind.annotation.XmlType;
import lombok.Getter;
import lombok.Setter;

@Setter
@XmlType(propOrder = {"quantityPrice1","quantityLowerBound1","quantityPrice2","quantityLowerBound2","quantityPrice3","quantityLowerBound3","quantityPrice4","quantityLowerBound4","quantityPrice5","quantityLowerBound5",})
public class QuantityPrice
{

    private String QuantityPrice1;
    private String QuantityLowerBound1;
    private String QuantityPrice2;
    private String QuantityLowerBound2;
    private String QuantityPrice3;
    private String QuantityLowerBound3;
    private String QuantityPrice4;
    private String QuantityLowerBound4;
    private String QuantityPrice5;
    private String QuantityLowerBound5;


    @XmlElement(name = "QuantityPrice1")
    public String getQuantityPrice1() {
        return QuantityPrice1;
    }
    @XmlElement(name = "QuantityPrice3")
    public String getQuantityPrice3() {
        return QuantityPrice3;
    }

    @XmlElement(name = "QuantityPrice2")
    public String getQuantityPrice2() {
        return QuantityPrice2;
    }

    @XmlElement(name = "QuantityPrice5")
    public String getQuantityPrice5() {
        return QuantityPrice5;
    }

    @XmlElement(name = "QuantityPrice4")
    public String getQuantityPrice4() {
        return QuantityPrice4;
    }

    @XmlElement(name = "QuantityLowerBound4")
    public String getQuantityLowerBound4() {
        return QuantityLowerBound4;
    }

    @XmlElement(name = "QuantityLowerBound5")
    public String getQuantityLowerBound5() {
        return QuantityLowerBound5;
    }

    @XmlElement(name = "QuantityLowerBound2")
    public String getQuantityLowerBound2() {
        return QuantityLowerBound2;
    }
    @XmlElement(name = "QuantityLowerBound3")
    public String getQuantityLowerBound3() {
        return QuantityLowerBound3;
    }
    @XmlElement(name = "QuantityLowerBound1")
    public String getQuantityLowerBound1() {
        return QuantityLowerBound1;
    }

    @Override
    public String toString()
    {
        return "ClassPojo [QuantityPrice1 = "+QuantityPrice1+", QuantityPrice3 = "+QuantityPrice3+", QuantityPrice2 = "+QuantityPrice2+", QuantityPrice5 = "+QuantityPrice5+", QuantityPrice4 = "+QuantityPrice4+", QuantityLowerBound4 = "+QuantityLowerBound4+", QuantityLowerBound5 = "+QuantityLowerBound5+", QuantityLowerBound2 = "+QuantityLowerBound2+", QuantityLowerBound3 = "+QuantityLowerBound3+", QuantityLowerBound1 = "+QuantityLowerBound1+"]";
    }
}
