package util;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;

public abstract class Recipe {
    protected LWAAuthorizationCredentials lwaCredentials = LWAAuthorizationCredentials.builder()
            .clientId("")
            .clientSecret("")
            .refreshToken("") 
            .endpoint(Constants.BACKEND_URL + "/auth/o2/token")
            .build();

    protected abstract void start();
}
