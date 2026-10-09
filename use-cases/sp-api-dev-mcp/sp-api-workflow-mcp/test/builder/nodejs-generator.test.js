/**
 * Node.js Generator Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateNodejsApp } from '../../src/builder/nodejs-generator.js';

/**
 * The generated app runs main() when loaded, so load only its SP-API client
 * section (TokenManager + SPAPIClient) and return the client class.
 */
function loadGeneratedClient() {
  const code = generateNodejsApp({ StartAt: 'Done', States: { Done: { Type: 'Succeed' } } });
  const start = code.indexOf('class TokenManager');
  const end = code.indexOf('// ====', code.indexOf('class SPAPIClient'));
  return new Function(`${code.slice(start, end)}\nreturn SPAPIClient;`)();
}

describe('generated SP-API client buildUrl', () => {
  const SPAPIClient = loadGeneratedClient();
  const client = new SPAPIClient({ region: 'na' });

  it('should keep slashes in the greedy Uploads resource parameter', () => {
    const url = client.buildUrl(
      '/uploads/2020-11-01/uploadDestinations/{resource}',
      { resource: '/aplus/2020-11-01/contentDocuments' },
      { marketplaceIds: ['ATVPDKIKX0DER'] }
    );
    assert.strictEqual(
      url,
      'https://sellingpartnerapi-na.amazon.com/uploads/2020-11-01/uploadDestinations/aplus/2020-11-01/contentDocuments?marketplaceIds=ATVPDKIKX0DER'
    );
  });

  it('should still encode slashes in non-greedy path parameters', () => {
    const url = client.buildUrl('/listings/2021-08-01/items/{sellerId}/{sku}', { sellerId: 'A1B2C3', sku: 'ABC/123' }, {});
    assert.strictEqual(url, 'https://sellingpartnerapi-na.amazon.com/listings/2021-08-01/items/A1B2C3/ABC%2F123');
  });
});
