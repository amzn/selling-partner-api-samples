<?php

namespace Lambda\attributes;


#[\Attribute(\Attribute::TARGET_PROPERTY)]
class Property
{
    public function __construct(
        public string $description = ''
    ) {}
}
