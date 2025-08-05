export interface ApiCatalog {
  categories: ApiCategory[];
  intentMappings: IntentMapping[];
}

export interface ApiCategory {
  name: string;
  description: string;
  endpoints: ApiEndpoint[];
  subcategories?: ApiCategory[];
}

export interface ApiEndpoint {
  id: string;
  originalOperationId: string; // Store the original operationId for backward compatibility
  name: string;
  path: string;
  method: string;
  description: string;
  purpose: string;
  commonUseCases: string[];
  parameters: ApiParameter[];
  responses: ApiResponse[];
  relatedEndpoints: RelatedEndpoint[];
  version: VersionInfo;
  examples: UsageExample[];
}

export interface ApiParameter {
  name: string;
  location: 'path' | 'query' | 'body' | 'header';
  required: boolean;
  type: string | string[]; // Change this line to allow both string and string[] types
  description: string;
  purpose: string;
  schema?: object;
  default?: any;
}

export interface ApiResponse {
  statusCode: number;
  description: string;
  schema?: object;
}

export interface RelatedEndpoint {
  id: string;
  relationship: string;
}

export interface VersionInfo {
  current: string;
  deprecated: string[];
  beta: string[];
  changes: VersionChange[];
}

export interface VersionChange {
  from: string;
  to: string;
  description: string;
}

export interface UsageExample {
  scenario: string;
  request: object;
  response: object;
}

export interface IntentMapping {
  intent: string;
  relevantEndpoints: {
    primary?: string;
    primaryReason?: string;
    secondary?: string[];
    secondaryReasons?: string[];
  };
}
