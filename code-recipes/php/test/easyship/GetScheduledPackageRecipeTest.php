<?php

namespace Test\easyship;

use Src\easyship\GetScheduledPackageRecipe;
use Test\util\RecipeTestCase;

class GetScheduledPackageRecipeTest extends RecipeTestCase
{
    protected function setUp(): void
    {
        $this->recipe = new GetScheduledPackageRecipe();
        $this->responses = [
            "easyship-getScheduledPackage"
        ];
    }
}
