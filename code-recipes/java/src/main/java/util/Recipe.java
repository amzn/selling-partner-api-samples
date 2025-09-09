package util;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;

public abstract class Recipe {
    protected LWAAuthorizationCredentials lwaCredentials = LWAAuthorizationCredentials.builder()
            .clientId("amzn1.application-oa2-client.57da595ba3164cb48534c9c1c8c74eb1")
            .clientSecret("amzn1.oa2-cs.v1.ceaecea12efbe764c8db7969d806d710d5d0f4ac01757008e5e2ab8682cae073")
            .refreshToken("Atzr|IwEBIARoCYTA47OJ9cK6qAnbhiR1uY2bdvXFomxfkM02Td53OeQlrffRyCAvBbIcIa5OVrBkRc8UsqkOYsq46XSCUlaIzHaZwN5SmhYKN9cKIg-aLzsFE5WC_pZgayC42qbCaA27poN9RmmDJYCRFqWSvNX65fx5reAkVJWvv9D9I8Fm5pDENr03KJ2VqKEQSgX-o8cH4LHHv7rKMBedZCLcUHXzO92wTQNKekHKAy9UfvQl-4KvXcGttqAhUWdJ1tLFQIbDmt_P-9jqtBCZUBkLp-naTc9SNIOfCpd8TqEaHZ-fjTMIZUg79_q8xC5JtRUf391VVywYilYlDvWuM8Lvak72")
            .endpoint(Constants.BACKEND_URL + "/auth/o2/token")
            .build();

    protected abstract void start();
}
