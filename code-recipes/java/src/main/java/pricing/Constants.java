package pricing;

public class Constants {
    public static final String SAMPLE_NOTIFICATION = """
        {
          "NotificationType": "ANY_OFFER_CHANGED",
          "EventTime": "2024-01-15T10:30:00Z",
          "Payload": {
            "AnyOfferChangedNotification": {
              "SellerId": "A3SELLER123",
              "OfferChangeTrigger": {
                "ASIN": "B08N5WRWNW",
                "MarketplaceId": "ATVPDKIKX0DER",
                "OfferChangeType": "Internal"
              },
              "Offers": [
                {
                  "SellerId": "A3SELLER123",
                  "IsFulfilledByAmazon": true,
                  "IsBuyBoxWinner": true,
                  "ListingPrice": {
                    "Amount": 29.99,
                    "CurrencyCode": "USD"
                  },
                  "Shipping": {
                    "Amount": 0.00,
                    "CurrencyCode": "USD"
                  }
                },
                {
                  "SellerId": "A3SELLER123",
                  "IsFulfilledByAmazon": false,
                  "IsBuyBoxWinner": false,
                  "ListingPrice": {
                    "Amount": 24.99,
                    "CurrencyCode": "USD"
                  },
                  "Shipping": {
                    "Amount": 4.99,
                    "CurrencyCode": "USD"
                  }
                }
              ]
            }
          }
        }
        """;
}
