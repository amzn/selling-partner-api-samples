<?php

namespace Test\messaging;

use Src\messaging\SendInvoiceToBuyerRecipe;
use Test\util\RecipeTestCase;

class SendInvoiceToBuyerTest extends RecipeTestCase
{
    protected function setUp(): void
    {
        $this->recipe = new SendInvoiceToBuyerRecipe();
        $this->responses = [
            "messaging-getMessagingActionsForOrder",
            "messaging-createUploadDestination",
            "messaging-sendInvoice"
        ];
    }
}
