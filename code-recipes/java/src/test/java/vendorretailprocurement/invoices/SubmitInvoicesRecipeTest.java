package vendorretailprocurement.invoices;

import util.RecipeTest;

import java.util.List;

public class SubmitInvoicesRecipeTest extends RecipeTest {

    public SubmitInvoicesRecipeTest() {
        super(new SubmitInvoicesRecipe(), List.of("vendorinvoices-submitInvoices"));
    }
}
