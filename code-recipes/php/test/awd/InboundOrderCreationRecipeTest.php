<?php
namespace Test\awd;

use Src\awd\InboundOrderCreationRecipe;
use Test\util\RecipeTestCase;

class InboundOrderCreationRecipeTest extends RecipeTestCase
{

    protected function setUp(): void
    {
        $this->recipe = new InboundOrderCreationRecipe();
        $this->responses = [
            "awd-checkInboundEligibility",
            "awd-createInbound",
            "awd-getInbound",
            ""
        ];
    }
}
