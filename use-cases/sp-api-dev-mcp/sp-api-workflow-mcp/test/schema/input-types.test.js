/**
 * Input Types Schema Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getInputTypeSchema,
  getAllInputTypes,
  isValidInputType,
  SingleSelectSchema,
  MultiSelectSchema,
  BooleanSchema,
  TextSchema,
  NumberSchema,
  DateSchema,
  FormSchema,
  ConfirmSchema,
  TableSchema
} from '../../src/schema/input-types/index.js';

describe('Input Types Registry', () => {
  describe('getInputTypeSchema', () => {
    it('should return schema for valid input types', () => {
      assert.strictEqual(getInputTypeSchema('SingleSelect'), SingleSelectSchema);
      assert.strictEqual(getInputTypeSchema('MultiSelect'), MultiSelectSchema);
      assert.strictEqual(getInputTypeSchema('Boolean'), BooleanSchema);
      assert.strictEqual(getInputTypeSchema('Text'), TextSchema);
      assert.strictEqual(getInputTypeSchema('Number'), NumberSchema);
      assert.strictEqual(getInputTypeSchema('Date'), DateSchema);
      assert.strictEqual(getInputTypeSchema('Form'), FormSchema);
      assert.strictEqual(getInputTypeSchema('Confirm'), ConfirmSchema);
      assert.strictEqual(getInputTypeSchema('Table'), TableSchema);
    });

    it('should return null for invalid input type', () => {
      assert.strictEqual(getInputTypeSchema('Invalid'), null);
    });
  });

  describe('getAllInputTypes', () => {
    it('should return all 10 input types', () => {
      const types = getAllInputTypes();
      assert.strictEqual(types.length, 10);
    });
  });

  describe('isValidInputType', () => {
    it('should return true for valid types', () => {
      assert.strictEqual(isValidInputType('SingleSelect'), true);
      assert.strictEqual(isValidInputType('Boolean'), true);
    });

    it('should return false for invalid types', () => {
      assert.strictEqual(isValidInputType('Invalid'), false);
      assert.strictEqual(isValidInputType(''), false);
    });
  });
});

describe('SingleSelect Schema', () => {
  describe('validate', () => {
    it('should pass for valid SingleSelect state', () => {
      const errors = SingleSelectSchema.validate('TestState', {
        'Options.$': '$.options',
        OptionLabel: 'name'
      });
      assert.strictEqual(errors.length, 0);
    });

    it('should fail when Options is missing', () => {
      const errors = SingleSelectSchema.validate('TestState', {
        OptionLabel: 'name'
      });
      assert.ok(errors.some(e => e.includes('requires either Options or Options.$')));
    });

    it('should fail when both Options and Options.$ are set', () => {
      const errors = SingleSelectSchema.validate('TestState', {
        Options: [{ id: 1 }],
        'Options.$': '$.options',
        OptionLabel: 'name'
      });
      assert.ok(errors.some(e => e.includes('Cannot have both')));
    });

    it('should fail when OptionLabel is missing', () => {
      const errors = SingleSelectSchema.validate('TestState', {
        Options: [{ id: 1 }]
      });
      assert.ok(errors.some(e => e.includes('OptionLabel is required')));
    });
  });

  describe('validateValue', () => {
    it('should pass for valid selection', () => {
      const result = SingleSelectSchema.validateValue('opt1', {
        Required: true,
        OptionValue: 'id'
      }, [{ id: 'opt1' }, { id: 'opt2' }]);
      assert.strictEqual(result.valid, true);
    });

    it('should fail for required but missing value', () => {
      const result = SingleSelectSchema.validateValue(undefined, { Required: true });
      assert.strictEqual(result.valid, false);
    });
  });
});

describe('MultiSelect Schema', () => {
  describe('validate', () => {
    it('should fail when MinSelections > MaxSelections', () => {
      const errors = MultiSelectSchema.validate('TestState', {
        Options: [{ id: 1 }],
        OptionLabel: 'name',
        MinSelections: 5,
        MaxSelections: 3
      });
      assert.ok(errors.some(e => e.includes('MinSelections cannot be greater')));
    });
  });

  describe('validateValue', () => {
    it('should pass for valid multi-selection', () => {
      const result = MultiSelectSchema.validateValue(['a', 'b'], {
        Required: true,
        MinSelections: 1,
        MaxSelections: 5
      });
      assert.strictEqual(result.valid, true);
    });

    it('should fail when selections exceed max', () => {
      const result = MultiSelectSchema.validateValue(['a', 'b', 'c'], {
        MaxSelections: 2
      });
      assert.strictEqual(result.valid, false);
    });
  });
});

describe('Boolean Schema', () => {
  describe('validateValue', () => {
    it('should pass for boolean values', () => {
      assert.strictEqual(BooleanSchema.validateValue(true, {}).valid, true);
      assert.strictEqual(BooleanSchema.validateValue(false, {}).valid, true);
    });

    it('should fail for non-boolean values', () => {
      assert.strictEqual(BooleanSchema.validateValue('yes', {}).valid, false);
    });
  });
});

describe('Text Schema', () => {
  describe('validate', () => {
    it('should fail for invalid regex pattern', () => {
      const errors = TextSchema.validate('TestState', {
        Pattern: '[invalid('
      });
      assert.ok(errors.some(e => e.includes('not a valid regular expression')));
    });
  });

  describe('validateValue', () => {
    it('should pass for valid text', () => {
      const result = TextSchema.validateValue('hello', {
        MinLength: 1,
        MaxLength: 100
      });
      assert.strictEqual(result.valid, true);
    });

    it('should fail when text is too short', () => {
      const result = TextSchema.validateValue('hi', { MinLength: 5 });
      assert.strictEqual(result.valid, false);
    });

    it('should fail when text is too long', () => {
      const result = TextSchema.validateValue('hello world', { MaxLength: 5 });
      assert.strictEqual(result.valid, false);
    });

    it('should fail when pattern does not match', () => {
      const result = TextSchema.validateValue('abc', {
        Pattern: '^\\d+$',
        PatternError: 'Must be numbers only'
      });
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Must be numbers only');
    });
  });
});

describe('Number Schema', () => {
  describe('validateValue', () => {
    it('should pass for valid number', () => {
      const result = NumberSchema.validateValue(50, {
        Min: 0,
        Max: 100
      });
      assert.strictEqual(result.valid, true);
    });

    it('should fail when below minimum', () => {
      const result = NumberSchema.validateValue(-5, { Min: 0 });
      assert.strictEqual(result.valid, false);
    });

    it('should fail when above maximum', () => {
      const result = NumberSchema.validateValue(150, { Max: 100 });
      assert.strictEqual(result.valid, false);
    });

    it('should fail for decimals when DecimalPlaces is 0', () => {
      const result = NumberSchema.validateValue(5.5, { DecimalPlaces: 0 });
      assert.strictEqual(result.valid, false);
    });
  });
});

describe('Date Schema', () => {
  describe('validate', () => {
    it('should fail when both MinDate and MinDate.$ are set', () => {
      const errors = DateSchema.validate('TestState', {
        MinDate: '2024-01-01',
        'MinDate.$': '$.minDate'
      });
      assert.ok(errors.some(e => e.includes('Cannot have both MinDate and MinDate.$')));
    });
  });

  describe('validateValue', () => {
    it('should pass for valid date', () => {
      const result = DateSchema.validateValue('2024-06-15', {});
      assert.strictEqual(result.valid, true);
    });

    it('should fail for invalid date format', () => {
      const result = DateSchema.validateValue('not-a-date', {});
      assert.strictEqual(result.valid, false);
    });
  });
});

describe('Form Schema', () => {
  describe('validate', () => {
    it('should fail when Fields is empty', () => {
      const errors = FormSchema.validate('TestState', {
        Fields: []
      });
      assert.ok(errors.some(e => e.includes('cannot be empty')));
    });

    it('should fail for duplicate field names', () => {
      const errors = FormSchema.validate('TestState', {
        Fields: [
          { Name: 'field1', Label: 'Field 1' },
          { Name: 'field1', Label: 'Field 1 Again' }
        ]
      });
      assert.ok(errors.some(e => e.includes('Duplicate field name')));
    });
  });

  describe('validateValue', () => {
    it('should pass for valid form data', () => {
      const result = FormSchema.validateValue(
        { name: 'John', age: 30 },
        {
          Required: true,
          Fields: [
            { Name: 'name', Label: 'Name', Type: 'text', Required: true },
            { Name: 'age', Label: 'Age', Type: 'number', Required: true }
          ]
        }
      );
      assert.strictEqual(result.valid, true);
    });

    it('should fail when required field is missing', () => {
      const result = FormSchema.validateValue(
        { name: 'John' },
        {
          Fields: [
            { Name: 'name', Label: 'Name', Required: true },
            { Name: 'age', Label: 'Age', Required: true }
          ]
        }
      );
      assert.strictEqual(result.valid, false);
    });
  });
});

describe('Confirm Schema', () => {
  describe('validate', () => {
    it('should fail when RequireTypedConfirmation without ConfirmationPhrase', () => {
      const errors = ConfirmSchema.validate('TestState', {
        RequireTypedConfirmation: true
      });
      assert.ok(errors.some(e => e.includes('ConfirmationPhrase is required')));
    });
  });

  describe('validateValue', () => {
    it('should pass for simple boolean confirmation', () => {
      const result = ConfirmSchema.validateValue(true, {});
      assert.strictEqual(result.valid, true);
    });

    it('should fail when typed confirmation does not match', () => {
      const result = ConfirmSchema.validateValue(
        { confirmed: true, typedPhrase: 'wrong' },
        { RequireTypedConfirmation: true, ConfirmationPhrase: 'DELETE' }
      );
      assert.strictEqual(result.valid, false);
    });
  });
});

describe('Table Schema', () => {
  describe('validate', () => {
    it('should fail when Columns is missing', () => {
      const errors = TableSchema.validate('TestState', {
        'Data.$': '$.items'
      });
      assert.ok(errors.some(e => e.includes('Columns is required')));
    });

    it('should fail when Column.Field is missing', () => {
      const errors = TableSchema.validate('TestState', {
        'Data.$': '$.items',
        Columns: [
          { Header: 'Name' }
        ]
      });
      assert.ok(errors.some(e => e.includes('Field is required')));
    });
  });

  describe('validateValue', () => {
    it('should pass for valid single selection', () => {
      const result = TableSchema.validateValue(
        { id: 1 },
        { Selectable: true, MultiSelect: false }
      );
      assert.strictEqual(result.valid, true);
    });

    it('should fail when multi-select has too many selections', () => {
      const result = TableSchema.validateValue(
        [1, 2, 3, 4, 5],
        { Selectable: true, MultiSelect: true, MaxSelections: 3 }
      );
      assert.strictEqual(result.valid, false);
    });
  });
});
