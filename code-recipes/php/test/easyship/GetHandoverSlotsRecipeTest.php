<?php

namespace Test\easyship;

use Src\easyship\GetHandoverSlotsRecipe;
use Test\util\RecipeTestCase;

class GetHandoverSlotsRecipeTest extends RecipeTestCase
{
    protected function setUp(): void
    {
        $this->recipe = new GetHandoverSlotsRecipe();
        $this->responses = [
            "easyship-listHandoverSlots"
        ];
    }
}
