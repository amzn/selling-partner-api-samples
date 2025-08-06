import { ExploreCatalogTool } from '../src/tools/explore-catalog-tool';
import { ApiCatalog } from '../src/types/api-catalog';

describe('Drill-Down Feature Tests', () => {
  let tool: ExploreCatalogTool;
  let mockCatalog: ApiCatalog;

  beforeEach(() => {
    // Create minimal mock catalog for testing
    mockCatalog = {
      categories: [
        {
          name: 'Orders',
          description: 'Order management APIs',
          endpoints: [
            {
              id: 'orders_getOrders',
              originalOperationId: 'getOrders',
              name: 'getOrders',
              path: '/orders/v0/orders',
              method: 'GET',
              description: 'Returns orders created or updated during specified time period.',
              purpose: 'Retrieve order information',
              commonUseCases: ['Order sync'],
              parameters: [],
              responses: [
                {
                  statusCode: 200,
                  description: 'Success',
                  schema: {
                    payload: {
                      Orders: [
                        {
                          AmazonOrderId: 'string',
                          ShippingAddress: {
                            Name: 'string',
                            City: 'string',
                            AddressDetails: {
                              Coordinates: {
                                Latitude: 'number',
                                Longitude: 'number'
                              }
                            }
                          },
                          BuyerInfo: {
                            BuyerEmail: 'string',
                            BuyerTaxInfo: {
                              CompanyLegalName: 'string'
                            }
                          }
                        }
                      ]
                    }
                  }
                }
              ],
              relatedEndpoints: [],
              version: { current: 'v0', deprecated: [], beta: [], changes: [] },
              examples: []
            }
          ]
        }
      ],
      intentMappings: []
    };

    tool = new ExploreCatalogTool(mockCatalog);
  });

  test('should limit depth to 0', async () => {
    const params = {
      endpoint: 'orders_getOrders',
      listEndpoints: false,
      listCategories: false,
      depth: 0 as const
    };
    
    const result = await tool.execute(params);
    
    // At depth 0, nested objects should be truncated
    expect(result).toContain('[Object:');
    expect(result).toContain('Use greater depth');
  });

  test('should limit depth to 1', async () => {
    const params = {
      endpoint: 'orders_getOrders',
      listEndpoints: false,
      listCategories: false,
      depth: 1 as const
    };
    
    const result = await tool.execute(params);
    
    // At depth 1, payload should be visible but Orders array should be truncated
    expect(result).toContain('payload');
    expect(result).toContain('[Object:');
    expect(result).toContain('Use greater depth');
    expect(result).not.toContain('AmazonOrderId'); // This would be depth 3
  });

  test('should show full depth by default', async () => {
    const params = {
      endpoint: 'orders_getOrders',
      listEndpoints: false,
      listCategories: false,
      depth: 'full' as const
    };
    
    const result = await tool.execute(params);
    
    // Full depth should show all nested levels
    expect(result).toContain('ShippingAddress');
    expect(result).toContain('"Name": "string"');
    expect(result).toContain('AddressDetails');
    expect(result).toContain('Coordinates');
    expect(result).toContain('"Latitude": "number"');
  });

  test('should extract reference', async () => {
    const params = {
      endpoint: 'orders_getOrders',
      listEndpoints: false,
      listCategories: false,
      depth: 'full' as const,
      ref: 'Order.ShippingAddress'
    };
    
    const result = await tool.execute(params);
    
    // Reference extraction should return JSON format
    const parsed = JSON.parse(result);
    expect(parsed.ref).toBe('Order.ShippingAddress');
    expect(parsed.endpoint).toBe('orders_getOrders');
  });

  test('should trigger auto-truncation for large responses', async () => {
    // Create large schema
    const largeSchema: any = { payload: {} };
    for (let i = 0; i < 200; i++) {
      largeSchema.payload[`field${i}`] = 'x'.repeat(500);
    }
    
    // Update mock with large schema
    mockCatalog.categories[0].endpoints[0].responses[0].schema = largeSchema;
    tool = new ExploreCatalogTool(mockCatalog);
    
    const params = {
      endpoint: 'orders_getOrders',
      listEndpoints: false,
      listCategories: false,
      depth: 'full' as const
    };
    
    const result = await tool.execute(params);
    
    // Should return truncation response
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe('truncated');
    expect(parsed.suggestions).toBeDefined();
    expect(parsed.suggestions.progressive_exploration).toBeDefined();
    expect(parsed.suggestions.targeted_investigation).toBeDefined();
  });

  test('should handle non-existent endpoint', async () => {
    const params = {
      endpoint: 'non_existent',
      listEndpoints: false,
      listCategories: false,
      depth: 'full' as const
    };
    
    const result = await tool.execute(params);
    
    expect(result).toContain('Endpoint Not Found');
    expect(result).toContain('non_existent');
  });
});