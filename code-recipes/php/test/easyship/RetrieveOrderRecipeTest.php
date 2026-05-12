<?php

namespace Test\easyship;

use Src\easyship\RetrieveOrderRecipe;
use Test\util\RecipeTestCase;

class RetrieveOrderRecipeTest extends RecipeTestCase
{
    protected function setUp(): void
    {
        $this->recipe = new RetrieveOrderRecipe();
        $this->responses = [
            "easyship-orders-getOrder",
            "orders-getOrderItems",
            ""
        ];
    }
}
