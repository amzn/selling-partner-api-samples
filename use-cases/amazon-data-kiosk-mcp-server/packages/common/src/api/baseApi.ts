// src/api/baseApi.ts
import fetch from 'node-fetch';
import { getAccessToken } from '../auth/amazonAuth.js';

// Configuration Constants
export const BASE_URL = process.env.DATA_KIOSK_BASE_URL || "https://sellingpartnerapi-na.amazon.com";

/**
 * Make an authenticated API request to the Amazon Data Kiosk API
 * @param path - API path relative to the base URL
 * @param method - HTTP method
 * @param body - Optional request body
 * @returns Promise that resolves to the API response
 */
export async function makeApiRequest(path: string, method: string, body?: any): Promise<any> {
  const accessToken = await getAccessToken();
  
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "x-amz-access-token": accessToken,
    "Content-Type": "application/json"
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error making API request to ${path}:`, error);
    throw error;
  }
}

/**
 * Download document content using the provided URL
 * @param url - Document download URL
 * @returns Promise that resolves to the document content
 */
export async function downloadDocument(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download error: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error("Error downloading document:", error);
    throw error;
  }
}