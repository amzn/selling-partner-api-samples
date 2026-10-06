# A+ Content Manager

## Introduction

This sample solution shows how to build an A+ Content workflow on the Selling Partner API: find the products that need content, create or edit Standard, Premium and Brand Story documents, upload images, apply the documents to ASINs, submit them for approval and follow them to the detail page. It is a small local web application: a React client and a Node.js server that calls the [A+ Content Management API](https://developer-docs.amazon.com/sp-api/docs/a-plus-content-api-use-case-guide), the [Uploads API](https://developer-docs.amazon.com/sp-api/docs/uploads-api) and the Listings Items API.

It runs in two modes. **Sample data** needs no credentials: the server hosts an in-memory sample account (four listings, four A+ documents) that reproduces the API's responses, including its validation messages. **Live** calls the Selling Partner API with your application's credentials.

## Demo

Sample data mode, from discovery to an approved document:

![A+ Content Manager demo](docs/demo.gif)

## What you can do

- **Products**: every listing in the account with its A+ state (Premium, Standard or Brand Story live, a draft attached, or no content yet). Select one to see what is on its detail page today, slot by slot: the A+ slot ("Product description" for sellers, "From the manufacturer" for vendors) and "From the brand" for the Brand Story, with the drafts attached to it and the actions for each slot: edit what is live, apply an existing document, create the missing kind, or replace or upgrade what is there.
- **A+ documents**: every document in the account, including content authored in Seller Central or Vendor Central, with its tier, status and the ASINs it is applied to.
- Edit a document in three steps, Content, ASINs and Publish, with _Save and next_ and _Previous_ between them; the browser's back and forward buttons move between pages, products and steps.
- Create documents from the 39 module types, each available with sample content; upload images and frame them with the module's crop (the preview shows exactly the cropped window).
- Video modules: with sample data, upload an MP4 and the app captures a poster frame, registers both as a `VIDEO_PAIRING` through a stand-in for the Media API's `createMedia`, and plays the clip in the preview. Against the live API, paste the `videoMediaId` and `imageMediaId` of media created with the [Media API](https://developer-docs.amazon.com/sp-api/reference/createmedia); live media is only viewable on the published page.
- Check a document before saving and read the API's own error messages next to the field that caused them.
- Attach ASINs, submit for approval, suspend, and read publish records.
- Preview a document on its own or as part of a simulated amazon.com desktop detail page; open the page in its own tab.

> **Note:** the detail-page preview is a best-effort simulation. It follows the markup and styles amazon.com uses for A+ content, but it does not guarantee fidelity to the real detail page, which changes over time and varies by marketplace, device and account type. Always check the published content on Amazon.

## Getting started

### Prerequisites

- Node.js 20 or newer.
- For live mode: an SP-API application with the Product Listing role, authorized by a selling partner that is eligible for A+ Content (sellers need Brand Registry).

### Run with sample data

```bash
git clone https://github.com/amzn/selling-partner-api-samples.git
cd selling-partner-api-samples/use-cases/aplus-content-manager
npm install
npm run dev:mock
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Use the _Reset sample data_ link in the mode badge to start over.

### Run against the Selling Partner API

```bash
cp .env.example .env   # fill in the values below
npm run dev
```

Saving, applying ASINs and submitting change real content in the authorized account. The server binds to 127.0.0.1 and has no authentication of its own; do not expose it.

### Build and test

```bash
npm run build && npm start   # production build, served on http://127.0.0.1:8787
npm test                     # server unit tests and a client type check
```

## Configuration

Set these in `.env` (see `.env.example`) or in the environment. Sample data mode ignores the credentials.

| Variable                                                  | Purpose                                                                                         |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `LWA_CLIENT_ID`, `LWA_CLIENT_SECRET`, `LWA_REFRESH_TOKEN` | Login with Amazon credentials of the application, authorized by the selling partner             |
| `SP_API_SELLER_ID`                                        | Selling partner id (a seller's merchant token or a vendor code), used by the Listings Items API |
| `SP_API_ACCOUNT_TYPE`                                     | `seller` (default) or `vendor`: sellers create EBC documents, vendors EMC documents             |
| `SPAPI_ENDPOINT`, `MARKETPLACE_ID`                        | Region endpoint and marketplace (defaults: North America, `ATVPDKIKX0DER`)                      |
| `PORT`                                                    | Server port (default `8787`)                                                                    |

Every SP-API request carries the `User-Agent` header the [call structure](https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api#step-3-add-headers-to-the-uri) requires, `A+ Content Manager Sample App/1.0/JavaScript`. To send requests without it, set `USER_AGENT_OPT_OUT` to `true` in `server/src/spapi.js`.

## Project layout

| Path                         | Contents                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `client/`                    | React application: Products and A+ documents pages, editor, ASIN and publish steps, preview |
| `server/src/`                | Express server: `/api` routes, the SP-API client, the sample-data service and its validator |
| `server/mock/`               | Sample account: listings, catalog items, documents and their images                         |
| `shared/module-catalog.json` | The 39 module types with their fields, generated from the A+ Content OpenAPI model          |

## See also

- [A+ Content Management API use case guide](https://developer-docs.amazon.com/sp-api/docs/a-plus-content-api-use-case-guide)
- [Create, edit, and publish A+ content](https://developer-docs.amazon.com/sp-api/docs/create-edit-publish-aplus-content)
- [Uploads API](https://developer-docs.amazon.com/sp-api/docs/uploads-api)
- [Listings Items API](https://developer-docs.amazon.com/sp-api/docs/listings-items-api-v2021-08-01-reference)
- [Selling Partner API documentation](https://developer-docs.amazon.com/sp-api/docs/welcome)
