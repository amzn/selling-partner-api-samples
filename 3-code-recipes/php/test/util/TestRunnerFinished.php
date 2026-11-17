<?php

namespace Test\util;

use PHPUnit\Event\TestRunner\Finished;
use PHPUnit\Event\TestRunner\FinishedSubscriber;

class TestRunnerFinished implements FinishedSubscriber
{
    public function notify(Finished $event): void
    {

        exec('cd ../test && npm stop');
        echo 'Test runner finished';
    }
}