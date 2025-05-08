# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.3] - 2023-04-12
### Fixed
- Fixes an issue introduced in v1.0.2. When creating an instance from string, it's containing an array and the brackets are encoded (like `filter%5Bfoo%5D%5B%5D=1&filter%5Bfoo%5D%5B%5D=2`), the method trying to fix duplicate keys without brackets added another array level (like `filter[foo][]` to `filter[foo][][]`). This is fixed with this release.

## [1.0.2] - 2023-04-12
### Fixed
- Duplicate keys without array notation (like `foo=bar&foo=baz`) are now also interpreted as array (like `foo[]=bar&foo[]=baz`). This is considered a bugfix because:
  - Previously `foo=bar&foo=baz` became `foo=baz`, which is most likely unwanted behavior.
  - Of course, such query strings should preferably be written using the array notation (`[]`), but if such a query is written without the brackets, the intention is either that it should be an array, or it's a mistake. If it is a mistake, the probability to notice it is higher, when the result contains all values instead of only the last one.
  - As this library is also part of the crwlr crawling library and there are servers intentionally using the syntax without brackets (e.g. google https://fonts.googleapis.com/css2?family=Baloo&family=Roboto) it's better to interpret it as an array.

## [1.0.1] - 2023-01-30
### Fixed
- When creating a `Query` from string, and it contains empty key value parts, like `&foo=bar`, `foo=bar&` or `foo=bar&&baz=quz`, the unnecessary `&` characters are removed in the string version now. For example, `&foo=bar` previously lead to `$instance->toString()` returning `&foo=bar` and now it returns `foo=bar`.
- To assure that there can't be differences in the array and string versions returned by the `Query` class, no matter if the instance was created from string or array, the library now first converts incoming values back and forth. So, when an instance is created from string, it first converts it to an array and then again back to a string and vice versa when an instance is created from an array. Some Examples being fixed by this:
  - From string `   foo=bar  `:
    - Before: toString(): `+++foo=bar++`, toArray(): `['foo' => 'bar  ']`.
    - Now: toString(): `foo=bar++`, toArray(): `['foo' => 'bar  ']`
  - From string `foo[bar] [baz]=bar`
    - Before: toString(): `foo%5Bbar%5D+%5Bbaz%5D=bar`, toArray(): `['foo' => ['bar' => 'bar']]`.
    - Now: toString(): `foo%5Bbar%5D=bar`, toArray(): `'[foo' => ['bar' => 'bar']]`.
  - From string `foo[bar][baz][]=bar&foo[bar][baz][]=foo`
    - Before: toString(): `foo%5Bbar%5D%5Bbaz%5D%5B%5D=bar&foo%5Bbar%5D%5Bbaz%5D%5B%5D=foo`, toArray(): `['foo' => ['bar' => ['baz' => ['bar', 'foo']]]]`.
    - Now: toString(): `foo%5Bbar%5D%5Bbaz%5D%5B0%5D=bar&foo%5Bbar%5D%5Bbaz%5D%5B1%5D=foo`, toArray(): `['foo' => ['bar' => ['baz' => ['bar', 'foo']]]]`.
  - From string `option`
    - Before: toString(): `option`, toArray(): `['option' => '']`
    - Now: toString(): `option=`, toArray(): `['option' => '']`
  - From string `foo=bar=bar==`
    - Before: toString(): `foo=bar=bar==`, toArray(): `[['foo' => 'bar=bar==']`
    - Now: toString(): `foo=bar%3Dbar%3D%3D`, toArray(): `[['foo' => 'bar=bar==']`
  - From string `sum=10%5c2%3d5`
    - Before: toString(): `sum=10%5c2%3d5`, toArray(): `[['sum' => '10\\2=5']`
    - Now: toString(): `sum=10%5C2%3D5`, toArray(): `[['sum' => '10\\2=5']`
  - From string `foo=%20+bar`
    - Before: toString(): `foo=%20+bar`, toArray(): `['foo' => '  bar']`
    - Now: toString(): `foo=++bar`, toArray(): `['foo' => '  bar']`
- Maintain the correct order of key value pairs when converting query string to array.
