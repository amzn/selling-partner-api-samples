import React, { useState } from 'react';

// Fields from the workflow schema use PascalCase (Name, Label, Type, Required)
// Normalize to a consistent accessor
function f(field, key) {
  return field[key] ?? field[key.charAt(0).toUpperCase() + key.slice(1)];
}

export default function FormInput({ inputRequest, onSubmit, loading }) {
  const fields = inputRequest.fields || [];
  const [values, setValues] = useState(() => {
    const init = {};
    for (const field of fields) {
      const name = f(field, 'name');
      init[name] = f(field, 'default') ?? '';
    }
    return init;
  });

  function handleChange(fieldName, value) {
    setValues(prev => ({ ...prev, [fieldName]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Clean up: strip empty optional fields, ensure numbers are numbers
    const cleaned = {};
    for (const field of fields) {
      const name = f(field, 'name');
      const type = f(field, 'type');
      const required = f(field, 'required');
      let val = values[name];

      // Skip empty optional fields
      if (!required && (val === '' || val === null || val === undefined)) continue;

      // Ensure number fields are actual numbers
      if (type === 'number' && val !== '' && val !== undefined) {
        val = Number(val);
      }

      cleaned[name] = val;
    }
    onSubmit(cleaned);
  }

  function renderField(field) {
    const name = f(field, 'name');
    const type = f(field, 'type');
    const placeholder = f(field, 'placeholder') || '';
    const options = f(field, 'options') || [];
    const validation = f(field, 'validation') || {};
    const value = values[name] ?? '';
    const id = `field-${name}`;

    switch (type) {
      case 'select':
        return (
          <select id={id} value={value} onChange={e => handleChange(name, e.target.value)}>
            <option value="">-- Select --</option>
            {options.map(opt => {
              const optVal = typeof opt === 'object' ? (opt.value ?? opt.label) : opt;
              const optLabel = typeof opt === 'object' ? opt.label : opt;
              return <option key={optVal} value={optVal}>{optLabel}</option>;
            })}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            id={id} value={value}
            onChange={e => handleChange(name, e.target.value)}
            placeholder={placeholder}
            rows={f(field, 'rows') || 3}
          />
        );

      case 'number':
        return (
          <input
            id={id} type="number" value={value}
            onChange={e => handleChange(name, e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={placeholder}
            min={validation.min} max={validation.max} step={validation.step}
          />
        );

      case 'boolean':
        return (
          <select id={id} value={String(value)} onChange={e => handleChange(name, e.target.value === 'true')}>
            <option value="">-- Select --</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );

      case 'date':
        return (
          <input id={id} type="date" value={value} onChange={e => handleChange(name, e.target.value)} />
        );

      default: // text, email, phone
        return (
          <input
            id={id} type="text" value={value}
            onChange={e => handleChange(name, e.target.value)}
            placeholder={placeholder}
          />
        );
    }
  }

  return (
    <form className="input-form" onSubmit={handleSubmit}>
      {fields.map((field, i) => {
        const name = f(field, 'name');
        const label = f(field, 'label') || name;
        const required = f(field, 'required');
        return (
          <div key={name || i} className="form-field">
            <label htmlFor={`field-${name}`}>
              {label}
              {required && <span className="required">*</span>}
            </label>
            {renderField(field)}
          </div>
        );
      })}
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
