package util.template;

import software.amazon.spapi.api.awd.v2024_05_09.AwdApi;
import util.Constants;
import util.Recipe;

// TODO: Add brief description about the use case of this recipe
// TODO: Rename class and move it into the right folder (e.g. awd use cases are placed in awd folder)
// TODO: Apply all TODOs, and remove them before commiting.
public class UseCaseRecipe extends Recipe {

    // TODO: Replace with the necessary API client
    private final AwdApi awdApi = new AwdApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    /* TODO: Create a dedicated method for each step in your use case. The start-method should be used to orchestrate the
        steps accordingly and add any necessary code to glue the steps together. */
    @Override
    protected void start() {
        stepOne();
        stepTwo();
        stepThree();
    }

    /* TODO: Methods for each step should be added below. Use meaningful method names to make the code as readable as
        possible. Keep each method short and concise. */
    private void stepOne() {}
    private void stepTwo() {}
    private void stepThree() {}
}
