import React from 'react';
import SingleSelectInput from './inputs/SingleSelectInput.jsx';
import MultiSelectInput from './inputs/MultiSelectInput.jsx';
import BooleanInput from './inputs/BooleanInput.jsx';
import TextInput from './inputs/TextInput.jsx';
import NumberInput from './inputs/NumberInput.jsx';
import DateInput from './inputs/DateInput.jsx';
import FormInput from './inputs/FormInput.jsx';
import ConfirmInput from './inputs/ConfirmInput.jsx';
import TableInput from './inputs/TableInput.jsx';
import JSONInput from './inputs/JSONInput.jsx';

const INPUT_COMPONENTS = {
  SingleSelect: SingleSelectInput,
  MultiSelect: MultiSelectInput,
  Boolean: BooleanInput,
  Text: TextInput,
  Number: NumberInput,
  Date: DateInput,
  Form: FormInput,
  Confirm: ConfirmInput,
  Table: TableInput,
  JSON: JSONInput,
};

export default function InputRenderer({ callbackId, inputRequest, onSubmit, error, loading }) {
  if (!inputRequest) return null;

  const Component = INPUT_COMPONENTS[inputRequest.inputType];
  if (!Component) {
    return (
      <div className="input-renderer">
        <div className="error">Unknown input type: {inputRequest.inputType}</div>
      </div>
    );
  }

  function handleSubmit(value) {
    onSubmit(callbackId, value);
  }

  return (
    <div className="input-renderer">
      <h2>{inputRequest.title}</h2>
      {inputRequest.description && <p className="input-desc">{inputRequest.description}</p>}
      {error && <div className="error inline-error">{error.cause || error.error}</div>}
      <Component
        inputRequest={inputRequest}
        onSubmit={handleSubmit}
        loading={loading}
      />
    </div>
  );
}
