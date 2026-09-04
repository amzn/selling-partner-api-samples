<?php

namespace Test\reports;

use Src\reports\RequestAndRetrieveReportRecipe;
use Test\util\RecipeTestCase;

class RequestAndRetrieveReportRecipeTest extends RecipeTestCase
{
    protected function setUp(): void
    {
        $this->recipe = new RequestAndRetrieveReportRecipe();
        $this->responses = [
            "reports-createReport",
            "reports-getReportDocument",
        ];
    }
}
