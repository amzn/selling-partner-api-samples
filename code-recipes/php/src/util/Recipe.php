<?php

namespace Src\util;

use SpApi\AuthAndAuth\LWAAuthorizationCredentials;
use SpApi\Configuration;

abstract class Recipe
{
    protected Configuration $config;

    public function __construct()
    {
        $credentials = new LWAAuthorizationCredentials([
            "clientId" => "clientId",
            "clientSecret" => "clientSecret",
            "refreshToken" => "refreshToken",
            "endpoint" => Constants::BACKEND_URL . "/auth/o2/token"
        ]);

        $this->config = new Configuration([], $credentials);
        $this->config->setHost(Constants::BACKEND_URL);
    }
}
