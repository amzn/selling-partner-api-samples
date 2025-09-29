package util.template;

import util.RecipeTest;

import java.util.List;

// TODO: Rename class and move it into the right folder (e.g. awd use cases are placed in awd folder)
// TODO: Apply all TODOs, and remove them before commiting.
public class UseCaseRecipeTest extends RecipeTest {

    protected UseCaseRecipeTest() {
        super(
                // TODO: Replace with the correct recipe implementation
                new UseCaseRecipe(),
                /* TODO: Specifies the order of calls returned from the backend mock. Each entry in the list represents
                    a single response (if the same response should be returned multiple times after each other, you have
                    to add it multiple times to the list. Responses are defined in code-recipes/test/responses, the
                    format for each response file is api-operation.json, but in the list you only need to specify the
                    name without the file type (e.g. "awd-getInbound"). If a 204 response should be returned, use "". */
                List.of()
        );
    }
}
