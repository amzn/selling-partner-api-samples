package lambda.utils;

import com.fasterxml.jackson.core.JsonProcessingException;

public interface PricingNotification {

    String getSellerId();

    String getAsin();

    String mapToPricingStateMachineInput() throws JsonProcessingException;
}
