# Implementation guide

**Anonymized Data Collection Disclaimer**

To enhance the functionality of our services and improve user experience, Amazon Selling Partner API team may collect anonymized usage data.

To disable this feature, complete the following steps before deploying your sample solution. Each code language has a specific file where you should locate and change the `OPT_OUT` variable.

## Python:

   1. Locate api_utils.py in the path: `use-cases/{USE_CASE_NAME}/code/python/src/utils/api_utils.py`. (replace USE_CASE_NAME with your use case's name, e.g. data-kiosk)

   2. Locate the `OPT_OUT = False` in api_utils.py

   3. Set `OPT_OUT = True`

## Java:

   1. Locate ApiUtils.java in the path: `use-cases/{USE_CASE_NAME}/code/java/src/main/java/lambda/utils/ApiUtils.java`. (replace USE_CASE_NAME with your use case's name, e.g. data-kiosk)

   2. Locate the `OPT_OUT = false` in ApiUtils.java

   3. Set `OPT_OUT = true`

## C#:

   1. Locate ApiUtils.cs in the path: `use-cases/{USE_CASE_NAME}code/csharp/src/sp-api-csharp-app/lambda/utils/ApiUtils.cs`. (replace USE_CASE_NAME with your use case's name, e.g. data-kiosk)

   2. Locate the `OPT_OUT = false` in ApiUtils.cs

   3. Set `OPT_OUT = true`

## Listings use case:

   1. Locate global.ts in the path: `app/sdk/constants/global.ts`

   2. Locate `const OPT_OUT = false;`

   3. Set `const OPT_OUT = true;`
