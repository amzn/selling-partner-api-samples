package util;


import com.fasterxml.jackson.jr.ob.JSON;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

public abstract class RecipeTest {

    Recipe recipe;

    List<String> responses;

    protected RecipeTest(Recipe recipe, List<String> responses) {
        this.recipe = recipe;
        this.responses = responses;
    }

    @Test
    public void testRecipe() throws Exception {
        instructBackendMock();
        recipe.start();
    }

    private void instructBackendMock() throws Exception {
        String body = JSON.std.asString(responses);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(new URI(Constants.BACKEND_URL + "/responses"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.discarding());
    }
}
