<?php

namespace Test\easyship;

use Src\easyship\CreateScheduledPackageRecipe;
use Test\util\RecipeTestCase;

class CreateScheduledPackageRecipeTest extends RecipeTestCase
{
    protected function setUp(): void
    {
        $this->recipe = new CreateScheduledPackageRecipe();
        $this->responses = [
            "easyship-createScheduledPackage"
        ];
    }
}
