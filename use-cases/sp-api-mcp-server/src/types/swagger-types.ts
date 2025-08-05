// src/types/swagger-types.ts

/**
 * Represents a Swagger/OpenAPI document
 */
export interface SwaggerDocument {
    swagger?: string;      // Swagger 2.0
    openapi?: string;      // OpenAPI 3.x
    info: SwaggerInfo;
    host?: string;         // Swagger 2.0
    basePath?: string;     // Swagger 2.0
    servers?: Server[];    // OpenAPI 3.x
    schemes?: string[];    // Swagger 2.0
    consumes?: string[];   // Swagger 2.0
    produces?: string[];   // Swagger 2.0
    paths: Record<string, PathItem>;
    components?: Components;  // OpenAPI 3.x
    definitions?: Record<string, Schema>;  // Swagger 2.0
    parameters?: Record<string, Parameter>;  // Swagger 2.0
    responses?: Record<string, Response>;  // Swagger 2.0
    securityDefinitions?: Record<string, SecurityScheme>;  // Swagger 2.0
    security?: SecurityRequirement[];
    tags?: Tag[];
    externalDocs?: ExternalDocumentation;
  }
  
  /**
   * Information about the API
   */
  export interface SwaggerInfo {
    title: string;
    description?: string;
    termsOfService?: string;
    contact?: Contact;
    license?: License;
    version: string;
  }
  
  /**
   * Contact information for the API
   */
  export interface Contact {
    name?: string;
    url?: string;
    email?: string;
  }
  
  /**
   * License information for the API
   */
  export interface License {
    name: string;
    url?: string;
  }
  
  /**
   * Server object (OpenAPI 3.x)
   */
  export interface Server {
    url: string;
    description?: string;
    variables?: Record<string, ServerVariable>;
  }
  
  /**
   * Server variable (OpenAPI 3.x)
   */
  export interface ServerVariable {
    enum?: string[];
    default: string;
    description?: string;
  }
  
  /**
   * API paths
   */
  export interface PathItem {
    $ref?: string;
    summary?: string;
    description?: string;
    get?: Operation;
    put?: Operation;
    post?: Operation;
    delete?: Operation;
    options?: Operation;
    head?: Operation;
    patch?: Operation;
    trace?: Operation;  // OpenAPI 3.x only
    servers?: Server[];  // OpenAPI 3.x only
    parameters?: Parameter[];
  }
  
  /**
   * API operation
   */
  export interface Operation {
    tags?: string[];
    summary?: string;
    description?: string;
    externalDocs?: ExternalDocumentation;
    operationId?: string;
    consumes?: string[];  // Swagger 2.0
    produces?: string[];  // Swagger 2.0
    parameters?: Parameter[];  // Swagger 2.0
    requestBody?: RequestBody;  // OpenAPI 3.x
    responses: Record<string, Response>;
    callbacks?: Record<string, Record<string, PathItem>>;  // OpenAPI 3.x
    deprecated?: boolean;
    security?: SecurityRequirement[];
    servers?: Server[];  // OpenAPI 3.x
  }
  
  /**
   * API operation parameter
   */
  export interface Parameter {
    name: string;
    in: 'query' | 'header' | 'path' | 'cookie' | 'body' | 'formData';
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    allowEmptyValue?: boolean;
    
    // Swagger 2.0 - simple types
    type?: string;  
    format?: string;
    allowReserved?: boolean;
    items?: Items;  // Used for arrays in Swagger 2.0
    collectionFormat?: string;
    default?: any;
    maximum?: number;
    exclusiveMaximum?: boolean;
    minimum?: number;
    exclusiveMinimum?: boolean;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    maxItems?: number;
    minItems?: number;
    uniqueItems?: boolean;
    enum?: any[];
    multipleOf?: number;
    
    // Swagger 2.0 - body
    schema?: Schema;
    
    // OpenAPI 3.x
    style?: string;
    explode?: boolean;
    example?: any;
    examples?: Record<string, Example>;
    content?: Record<string, MediaType>;  // OpenAPI 3.x
  }
  
  /**
   * Items object (Swagger 2.0)
   */
  export interface Items {
    type?: string;
    format?: string;
    items?: Items;
    collectionFormat?: string;
    default?: any;
    maximum?: number;
    exclusiveMaximum?: boolean;
    minimum?: number;
    exclusiveMinimum?: boolean;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    maxItems?: number;
    minItems?: number;
    uniqueItems?: boolean;
    enum?: any[];
    multipleOf?: number;
  }
  
  /**
   * Request body (OpenAPI 3.x)
   */
  export interface RequestBody {
    description?: string;
    content: Record<string, MediaType>;
    required?: boolean;
  }
  
  /**
   * Media type (OpenAPI 3.x)
   */
  export interface MediaType {
    schema?: Schema;
    example?: any;
    examples?: Record<string, Example>;
    encoding?: Record<string, Encoding>;
  }
  
  /**
   * Encoding (OpenAPI 3.x)
   */
  export interface Encoding {
    contentType?: string;
    headers?: Record<string, Header>;
    style?: string;
    explode?: boolean;
    allowReserved?: boolean;
  }
  
  /**
   * Header (OpenAPI 3.x)
   */
  export interface Header {
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    style?: string;
    explode?: boolean;
    schema?: Schema;
    example?: any;
    examples?: Record<string, Example>;
    content?: Record<string, MediaType>;
  }
  
  /**
   * API response
   */
  export interface Response {
    description: string;
    schema?: Schema;  // Swagger 2.0
    headers?: Record<string, Header | Reference>;
    content?: Record<string, MediaType>;  // OpenAPI 3.x
    links?: Record<string, Link | Reference>;  // OpenAPI 3.x
  }
  
  /**
   * Example (OpenAPI 3.x)
   */
  export interface Example {
    summary?: string;
    description?: string;
    value?: any;
    externalValue?: string;
  }
  
  /**
   * Link (OpenAPI 3.x)
   */
  export interface Link {
    operationRef?: string;
    operationId?: string;
    parameters?: Record<string, any>;
    requestBody?: any;
    description?: string;
    server?: Server;
  }
  
  /**
   * JSON Schema object
   */
  export interface Schema {
    $ref?: string;
    title?: string;
    multipleOf?: number;
    maximum?: number;
    exclusiveMaximum?: boolean;
    minimum?: number;
    exclusiveMinimum?: boolean;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    maxItems?: number;
    minItems?: number;
    uniqueItems?: boolean;
    maxProperties?: number;
    minProperties?: number;
    required?: string[];
    enum?: any[];
    type?: string | string[];
    allOf?: Schema[];
    anyOf?: Schema[];  // OpenAPI 3.x
    oneOf?: Schema[];  // OpenAPI 3.x
    not?: Schema;      // OpenAPI 3.x
    items?: Schema | Schema[];
    properties?: Record<string, Schema>;
    additionalProperties?: boolean | Schema;
    description?: string;
    format?: string;
    default?: any;
    nullable?: boolean;  // OpenAPI 3.x
    discriminator?: Discriminator;
    readOnly?: boolean;
    writeOnly?: boolean;  // OpenAPI 3.x
    xml?: XML;
    externalDocs?: ExternalDocumentation;
    example?: any;
    deprecated?: boolean;  // OpenAPI 3.x
    
    // OpenAPI 3.1 specific (JSON Schema 2020-12)
    prefixItems?: Schema[];
    contains?: Schema;
    propertyNames?: Schema;
    unevaluatedProperties?: boolean | Schema;
    unevaluatedItems?: boolean | Schema;
    minContains?: number;
    maxContains?: number;
    
    // Non-standard extensions
    _originalRef?: string; // Used internally for reference tracking
    _typeDescription?: string; // Used for human-readable type descriptions
  }
  
  /**
   * Discriminator (OpenAPI 3.x)
   */
  export interface Discriminator {
    propertyName: string;
    mapping?: Record<string, string>;
  }
  
  /**
   * XML object
   */
  export interface XML {
    name?: string;
    namespace?: string;
    prefix?: string;
    attribute?: boolean;
    wrapped?: boolean;
  }
  
  /**
   * External documentation
   */
  export interface ExternalDocumentation {
    description?: string;
    url: string;
  }
  
  /**
   * Components (OpenAPI 3.x)
   */
  export interface Components {
    schemas?: Record<string, Schema | Reference>;
    responses?: Record<string, Response | Reference>;
    parameters?: Record<string, Parameter | Reference>;
    examples?: Record<string, Example | Reference>;
    requestBodies?: Record<string, RequestBody | Reference>;
    headers?: Record<string, Header | Reference>;
    securitySchemes?: Record<string, SecurityScheme | Reference>;
    links?: Record<string, Link | Reference>;
    callbacks?: Record<string, Record<string, PathItem> | Reference>;
  }
  
  /**
   * Reference object
   */
  export interface Reference {
    $ref: string;
  }
  
  /**
   * Security scheme
   */
  export interface SecurityScheme {
    type: string;
    description?: string;
    name?: string;
    in?: string;
    scheme?: string;
    bearerFormat?: string;
    flows?: OAuthFlows;
    openIdConnectUrl?: string;
  }
  
  /**
   * OAuth flows (OpenAPI 3.x)
   */
  export interface OAuthFlows {
    implicit?: OAuthFlow;
    password?: OAuthFlow;
    clientCredentials?: OAuthFlow;
    authorizationCode?: OAuthFlow;
  }
  
  /**
   * OAuth flow (OpenAPI 3.x)
   */
  export interface OAuthFlow {
    authorizationUrl?: string;
    tokenUrl?: string;
    refreshUrl?: string;
    scopes: Record<string, string>;
  }
  
  /**
   * Security requirement
   */
  export interface SecurityRequirement {
    [name: string]: string[];
  }
  
  /**
   * Tag
   */
  export interface Tag {
    name: string;
    description?: string;
    externalDocs?: ExternalDocumentation;
  }
  
  /**
   * Processed Swagger document with resolved references
   */
  export interface ProcessedSwaggerDocument extends SwaggerDocument {
    _processed: boolean;
  }