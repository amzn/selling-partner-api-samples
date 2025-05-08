<?php

namespace Lambda\Utils\interfaces;

use lambda\utils\model\ApiCredentials;

interface ApiCredentialsProvider
{
    /**
     * Retrieves the API credentials.
     *
     * @return ApiCredentials
     */
    public function getApiCredentials(): ApiCredentials;
}
