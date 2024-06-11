## Implementation guide

Anonymized Data Collection Disclaimer

To enhance the functionality of our services and improve user experience, Amazon Selling Partner API team may collect and use anonymized data.

To disable this feature, complete the following steps before deploying your sample solution. Each code language has a specific file where you should locate and change OPT_OUT variable.

1. Python:

   1.1 Locate api_utils.py in the path: `use-cases/{USE_CASE_NAME}/code/python/src/utils/api_utils.py`. (replace USE_CASE_NAME with your use case's name, e.g. data-kiosk)

   1.2 Locate the `OPT_OUT = False` in api_utils.py

   1.3 Set `OPT_OUT = True`

2. Java:

   2.1 Locate ApiUtils.java in the path: `use-cases/{USE_CASE_NAME}/code/java/src/main/java/lambda/utils/ApiUtils.java`. (replace USE_CASE_NAME with your use case's name, e.g. data-kiosk)

   2.2 Locate the `OPT_OUT = false` in ApiUtils.java

   2.3 Set `OPT_OUT = true`

2. C#:

   2.1 Locate ApiUtils.cs in the path: `use-cases/{USE_CASE_NAME}code/csharp/src/sp-api-csharp-app/lambda/utils/ApiUtils.cs`. (replace USE_CASE_NAME with your use case's name, e.g. data-kiosk)

   2.2 Locate the `OPT_OUT = false` in ApiUtils.cs

   2.3 Set `OPT_OUT = true`

3. Listings use case:

   3.1 Locate global.ts in the path: `app/sdk/constants/global.ts`

   3.2 Locate `const OPT_OUT = false;`

   3.3 Set `const OPT_OUT = true;`
