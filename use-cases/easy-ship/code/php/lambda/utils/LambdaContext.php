<?php

namespace Lambda\Utils;

use Monolog\Logger;
use Monolog\Handler\StreamHandler;

class LambdaContext
{
    private Logger $logger;

    public function __construct()
    {
        $this->logger = new Logger('lambda');
        $this->logger->pushHandler(new StreamHandler('php://stdout', Logger::DEBUG));
    }

    public function getLogger(): Logger
    {
        return $this->logger;
    }
}
