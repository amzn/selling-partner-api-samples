## Pre-requisites
### SP-API Auth&Auth library
Deploying a Java application requires importing the SP-API Authorization + dependencies library. The corresponding JAR file can't be included in the package by default as it exceeds the 10 MB file size limit of https://create.hub.amazon.dev/, so you need to do it manually.
To import the JAR file, follow the steps below:
1. Download **sellingpartnerapi-aa-java-2.0-jar-with-dependencies.jar** from [Amazon Drive](https://drive.corp.amazon.com/documents/rodrifed@/sellingpartnerapi-aa-java-2.0-jar-with-dependencies.jar)
2. Copy the file to `/code/java/dependencies` folder

## Java SDK Model Generation
In order to generate an SDK for the API section/s that you will use, follow the steps below:
1. If your application will not be using the Catalog Items API, included as an example in this template, remove all files under `code/java/src/java/io/swagger/client/api` and `code/java/src/java/io/swagger/client/model` 
2. Generate the API SDK by following steps 1. to 9. from [Generating a Java SDK with LWA token exchange and authentication](https://developer-docs.amazon.com/sp-api/docs/generating-a-java-sdk-with-lwa-token-exchange-and-authentication)
3. On the generated SDK directory, navigate to the following folder: `src/main/java/io/swagger/client`
4. Copy the content from `api` folder to this project's `code/java/src/java/io/swagger/client/api` folder
5. Copy the content from `model` folder to this project's `code/java/src/java/io/swagger/client/model` folder
6. Update the code under `code/java/src/java/lambda` to reference the new API SDK
7. From `code/java` directory, run `mvn package` to confirm that the SDK was correctly imported