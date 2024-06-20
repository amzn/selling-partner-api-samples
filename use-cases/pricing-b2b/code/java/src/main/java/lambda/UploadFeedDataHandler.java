package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import com.squareup.okhttp.*;
import jakarta.xml.bind.JAXBContext;
import jakarta.xml.bind.JAXBElement;
import jakarta.xml.bind.Marshaller;
import jakarta.xml.bind.util.JAXBResult;
import jakarta.xml.bind.util.JAXBSource;
import lambda.utils.B2B.PricingLambdaInputB2B;
import lambda.utils.B2B.PricingRuleB2B;
import lambda.utils.feed.*;

import javax.xml.namespace.QName;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.stream.StreamSource;
import java.io.File;
import java.io.IOException;
import java.io.StringWriter;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

public class UploadFeedDataHandler implements RequestHandler<PricingLambdaInputB2B, PricingLambdaInputB2B> {

    public PricingLambdaInputB2B handleRequest(PricingLambdaInputB2B input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("Upload Feed Document Lambda input: " + new Gson().toJson(input));

        try {
            String feedUrl = input.getFeedDetails().getFeedUrl();
            AmazonEnvelope amazonEnvelope = new AmazonEnvelope();

            Header header = new Header();
            header.setMerchantIdentifier(input.getSellerId());
            header.setDocumentVersion("1.01");
            amazonEnvelope.setHeader(header);

            amazonEnvelope.setMessageType("Price");
            List<Message> msgList = new ArrayList<>();

            Message msg = new Message();
            msg.setMessageID("1");
            Price price = new Price();
            price.setSKU(input.getItemSku());
            List<PricingRuleB2B> priceRules = getsortedList(input.getPricingRules());
            QuantityPrice qp = new QuantityPrice();
            for (int i=0;i<priceRules.size();i++){
                //     for (PricingRuleB2B priceRule : priceRules){
                PricingRuleB2B priceRule = priceRules.get(i);
                if("B2B".equals(priceRule.getOfferType()) && 1==priceRule.getQuantityTier() && priceRule.getNewListingPrice().getAmount()>1){
                    price.setBusinessPrice(String.valueOf(priceRule.getNewListingPrice().getAmount()));
                } else if (priceRule.getNewListingPrice().getAmount()>1) {
                    String qpPropertyName = "QuantityPrice" + i;
                    String qlbPropertyName = "QuantityLowerBound" + i;
                    try{
                        Field qpField = QuantityPrice.class.getDeclaredField(qpPropertyName);
                        Field qlbField = QuantityPrice.class.getDeclaredField(qlbPropertyName);
                        qpField.setAccessible(true);
                        qlbField.setAccessible(true);
                        qpField.set(qp,String.valueOf(priceRule.getNewListingPrice().getAmount()));
                        qlbField.set(qp,String.valueOf((int) priceRule.getQuantityTier()));
                    } catch(Exception e){
                        throw new InternalError("Upload Feed Data Lambda failed at generating quantity tiers", e);
                    }

                }

            }
            if(qp.getQuantityLowerBound1() != null && !qp.getQuantityLowerBound1().isEmpty() && !qp.getQuantityLowerBound1().isBlank()){
                price.setQuantityPriceType("fixed");
                price.setQuantityPrice(qp);
            }
            // price.setBusinessPrice(String.valueOf(input.getNewListingPrice().getAmount()));

            msg.setPrice(price);
            msgList.add(msg);
            amazonEnvelope.setMessage(msgList);

            StringWriter sw = new StringWriter();
            JAXBContext jaxbContext 	= JAXBContext.newInstance(AmazonEnvelope.class );
            Marshaller jaxbMarshaller 	= jaxbContext.createMarshaller();
            // To format XML
            jaxbMarshaller.setProperty(Marshaller.JAXB_FORMATTED_OUTPUT, Boolean.TRUE);
            jaxbMarshaller.marshal(amazonEnvelope, sw);


            String xmlString = sw.toString();
            logger.log("Upload Feed Lambda request: " + xmlString);
            upload(logger,xmlString.getBytes(StandardCharsets.UTF_8), feedUrl);
            logger.log("Upload Feed Data Lambda response: " + new Gson().toJson(input));
        } catch (Exception e) {
            throw new InternalError("Upload Feed Data Lambda failed", e);
        }

        return input;
    }
    private List<PricingRuleB2B> getsortedList(List<PricingRuleB2B> priceRules){
        Collections.sort(priceRules, new Comparator<PricingRuleB2B>() {
            @Override
            public int compare(PricingRuleB2B o1, PricingRuleB2B o2) {
                return Float.compare(o1.getQuantityTier(),o2.getQuantityTier());
            }
        });
        return priceRules;
    }
    private void upload(LambdaLogger logger, byte[] source, String url){
        OkHttpClient client = new OkHttpClient();

        // The contentType must match the input provided to the createFeedDocument operation. This example uses text/xml, but your contentType may be different depending upon on your chosen feedType (text/plain, text/csv, and so on).
        String contentType = String.format("text/xml; charset=%s", StandardCharsets.UTF_8);
        try {
            Request request = new Request.Builder()
                    .url(url)
                    .put(RequestBody.create(MediaType.parse(contentType), source))
                    .build();

            Response response = client.newCall(request).execute();
            if (!response.isSuccessful()) {
                logger.log(
                        String.format("Call to upload document failed with response code: %d and message: %s",
                                response.code(), response.message()));
            }
        } catch (IOException e) {
            System.out.println(e.getMessage());
        }
    }
}
