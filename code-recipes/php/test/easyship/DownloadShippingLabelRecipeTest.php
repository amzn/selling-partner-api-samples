<?php

namespace Test\easyship;

use Src\easyship\DownloadShippingLabelRecipe;
use Test\util\RecipeTestCase;

class DownloadShippingLabelRecipeTest extends RecipeTestCase
{
    protected function setUp(): void
    {
        $this->recipe = new DownloadShippingLabelRecipe();
        $this->responses = [
            "reports-getReport",
            "reports-getReportDocument",
            ""
        ];
    }
}
