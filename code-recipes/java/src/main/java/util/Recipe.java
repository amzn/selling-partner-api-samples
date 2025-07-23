package util;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;

public abstract class Recipe {
    protected LWAAuthorizationCredentials lwaCredentials = LWAAuthorizationCredentials.builder()
            .clientId("clientId")
            .clientSecret("clientSecret")
            .refreshToken("refreshToken")
            .endpoint(Constants.BACKEND_URL + "/auth/o2/token")
            .build();

    protected abstract void start();
}
