import { isEqual } from "lodash";
import { Patch } from "@/app/model/types";
import {
  PATCH_LISTINGS_ITEM_API_NAME,
  USE_CASE_TO_REQUIREMENTS,
} from "@/app/constants/global";
import { isFullUpdate } from "@/app/utils/listings-item";

/**
 * A helper function to generate Json Listing Feed content for a given listing.
 * @param sku the SKU.
 * @param productType the product type.
 * @param listing the listing data entered by the user
 * @param useCase type of the listing use case.
 * @param initialListing the initial listing before the user edits.
 * @param sellerId the seller identifier.
 * @param issueLocale the locale used for issue localization.
 * @param writeOperation the write operation to be used when the use case is update listing.
 */
export function convertListingToJsonFeed(
  sku: string,
  productType: string,
  listing: object,
  useCase: string,
  initialListing: object,
  sellerId: string,
  issueLocale: string,
  writeOperation?: string,
) {
  const feedHeader = {
    sellerId: sellerId,
    version: "2.0",
    issueLocale: issueLocale,
  };
  let feed: object | undefined = undefined;
  if (isFullUpdate(useCase, writeOperation) && Object.keys(listing).length) {
    feed = {
      header: feedHeader,
      messages: [
        {
          messageId: 1,
          sku: sku,
          operationType: "UPDATE",
          productType: productType,
          requirements: USE_CASE_TO_REQUIREMENTS[useCase],
          attributes: listing,
        },
      ],
    };
  }

  if (PATCH_LISTINGS_ITEM_API_NAME === writeOperation) {
    const patches = computePatches(listing, initialListing);
    if (!patches.length) {
      return feed;
    }

    feed = {
      header: feedHeader,
      messages: [
        {
          messageId: 1,
          sku: sku,
          operationType: "PATCH",
          productType: productType,
          patches: patches,
        },
      ],
    };
  }
  return feed;
}

/**
 * Computes the Patches from the initialListing to currentListing.
 * @param currentListing the current listing after user edits.
 * @param initialListing the listing before user edits.
 */
export function computePatches(currentListing: object, initialListing: object) {
  const currentListingKeys = Object.keys(currentListing);
  const initialListingKeys = Object.keys(initialListing);
  const keysAdded = difference(currentListingKeys, initialListingKeys);
  const keysRemoved = difference(initialListingKeys, currentListingKeys);
  const commonKeys = intersection(initialListingKeys, currentListingKeys);

  const patches: Patch[] = [];
  keysAdded.forEach((key) => {
    patches.push({
      op: "add",
      path: `/attributes/${key}`,
      value: currentListing[key as keyof typeof currentListing],
    });
  });

  keysRemoved.forEach((key) => {
    patches.push({
      op: "delete",
      path: `/attributes/${key}`,
      value: initialListing[key as keyof typeof initialListing],
    });
  });

  commonKeys.forEach((key) => {
    const currentValue = currentListing[key as keyof typeof currentListing];
    const initialValue = initialListing[key as keyof typeof initialListing];
    if (!isEqual(currentValue, initialValue)) {
      patches.push({
        op: "replace",
        path: `/attributes/${key}`,
        value: currentValue,
      });
    }
  });
  return patches;
}

function difference(firstArray: string[], secondArray: string[]) {
  const difference = firstArray.filter(function (x) {
    return secondArray.indexOf(x) < 0;
  });
  return Array.from(new Set(difference));
}

function intersection(firstArray: string[], secondArray: string[]) {
  const intersection = firstArray.filter(function (x) {
    return secondArray.indexOf(x) >= 0;
  });
  return Array.from(new Set(intersection));
}
