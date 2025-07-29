<?php

namespace Test\util;

use PHPUnit\Event\TestRunner\Started;
use PHPUnit\Event\TestRunner\StartedSubscriber;

class TestRunnerStarted implements StartedSubscriber
{
    public function notify(Started $event): void
    {
        exec('cd ../test && npm install && npm start');
        sleep(5);
        echo 'Test runner started';
    }
}