<?php

namespace Test\aplus;

use Src\aplus\UploadImageForResourceRecipe;
use Test\util\RecipeTestCase;

class UploadImageForResourceTest extends RecipeTestCase
{
    protected function setUp(): void
    {
        $this->recipe = new UploadImageForResourceRecipe();
        $this->responses = [
            "aplus-createUploadDestinationResponse"
        ];
    }
}
