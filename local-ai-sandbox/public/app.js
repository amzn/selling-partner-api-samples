function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ===== Tab Switching Logic =====
const tabs = document.querySelectorAll('.tab-bar .tab');
const tabPanels = document.querySelectorAll('.tab-panel');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tabPanels.forEach((p) => p.classList.remove('active'));

    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    const panelId = tab.getAttribute('aria-controls');
    document.getElementById(panelId).classList.add('active');
  });

  tab.addEventListener('keydown', (e) => {
    const tabList = Array.from(tabs);
    const index = tabList.indexOf(tab);
    let newIndex = index;
    if (e.key === 'ArrowRight') newIndex = (index + 1) % tabList.length;
    if (e.key === 'ArrowLeft') newIndex = (index - 1 + tabList.length) % tabList.length;
    if (newIndex !== index) {
      e.preventDefault();
      tabList[newIndex].focus();
      tabList[newIndex].click();
    }
  });
});

// ===== Data Generator (Chat) Logic =====
const promptInput = document.getElementById("prompt-input");
const sendBtn = document.getElementById("send");
const clearBtn = document.getElementById("clear");
const responseContainer = document.getElementById("response-container");
const loadingContainer = document.getElementById("loading-container");
const responseContent = document.getElementById("response-content");
const statusBadge = document.getElementById("status-badge");
const statusText = document.getElementById("status-text");

function setLoading(loading) {
  sendBtn.disabled = loading;
  loadingContainer.style.display = loading ? "" : "none";
  if (loading) responseContainer.style.display = "none";
}

function showResult(text, isError) {
  responseContainer.style.display = "";
  responseContent.textContent = text;
  statusBadge.className = "status-badge " + (isError ? "error" : "success");
  statusText.textContent = isError ? "Error" : "Success";
}

function showError(message, errorType, statusCode) {
  responseContainer.style.display = "";
  responseContent.innerHTML = "";

  const errorBox = document.createElement("div");
  errorBox.className = "error-detail";

  const errorHeader = document.createElement("div");
  errorHeader.className = "error-detail-header";

  if (errorType) {
    const typeBadge = document.createElement("span");
    typeBadge.className = "error-type-badge";
    typeBadge.textContent = errorType;
    errorHeader.appendChild(typeBadge);
  }

  if (statusCode) {
    const codeBadge = document.createElement("span");
    codeBadge.className = "error-status-code";
    codeBadge.textContent = "HTTP " + statusCode;
    errorHeader.appendChild(codeBadge);
  }

  const errorMessage = document.createElement("p");
  errorMessage.className = "error-detail-message";
  errorMessage.textContent = message;

  errorBox.appendChild(errorHeader);
  errorBox.appendChild(errorMessage);
  responseContent.appendChild(errorBox);

  statusBadge.className = "status-badge error";
  statusText.textContent = "Error";
}

sendBtn.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) return;
  setLoading(true);
  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok && data.error) {
      showError(data.error, data.errorType, res.status);
    } else {
      showResult(data.result, !res.ok);
    }
  } catch (err) {
    setLoading(false);
    showError("Request failed: " + err.message, "NetworkError");
  }
});

promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

clearBtn.addEventListener("click", () => {
  promptInput.value = "";
  responseContainer.style.display = "none";
  loadingContainer.style.display = "none";
  promptInput.focus();
});

// ===== Clear Data Button =====
const clearDataBtn = document.getElementById("clearDataBtn");

clearDataBtn.addEventListener("click", () => {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
  <div class="modal">
    <div class="modal-header">
      <h2>Clear Data</h2>
      <button class="modal-close" aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="modal-body" style="padding: var(--space-xxl); background: var(--color-background-container-content); color: var(--color-text-body-default); font-size: 14px;">
      <p>Are you sure you want to clear all data from the database? This action cannot be undone.</p>
      <div style="display: flex; gap: var(--space-s); justify-content: flex-end; margin-top: var(--space-xl);">
        <button class="btn btn-normal" id="clearDataCancel">Cancel</button>
        <button class="btn btn-primary" id="clearDataConfirm" style="background: #d91515; border-color: #d91515;">Yes</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  overlay.querySelector(".modal-close").addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  overlay.querySelector("#clearDataCancel").addEventListener("click", closeModal);

  overlay.querySelector("#clearDataConfirm").addEventListener("click", async () => {
    try {
      const res = await fetch("/data", { method: "DELETE" });
      if (res.ok) {
        closeModal();
        fetchDataViewer();
      } else {
        const data = await res.json();
        closeModal();
        const content = document.getElementById("data-viewer-content");
        content.innerHTML = '<p style="padding: var(--space-xl); color: var(--color-text-status-error); text-align: center;">Failed to clear data: ' + escapeHtml(data.error || "Unknown error") + '</p>';
      }
    } catch (err) {
      closeModal();
      const content = document.getElementById("data-viewer-content");
      content.innerHTML = '<p style="padding: var(--space-xl); color: var(--color-text-status-error); text-align: center;">Failed to clear data: ' + escapeHtml(err.message) + '</p>';
    }
  });
});

// ===== Notifications Tab Logic =====
let availableSchemas = [];
let currentSchema = null;
let notificationsSchemasLoaded = false;

const notificationTypeSelect = document.getElementById("notification-type-select");
const notificationFormContainer = document.getElementById("notification-form-container");

async function loadNotificationSchemas() {
  if (notificationsSchemasLoaded) return;
  notificationsSchemasLoaded = true;

  try {
    const res = await fetch("/manage/notifications/schemas");
    if (!res.ok) {
      notificationFormContainer.innerHTML =
        '<p style="padding: var(--space-xl); color: var(--color-text-status-error); text-align: center;">Unable to load notification schemas</p>';
      notificationsSchemasLoaded = false;
      return;
    }
    const schemas = await res.json();
    availableSchemas = schemas;

    // Clear existing options beyond the placeholder
    notificationTypeSelect.innerHTML = '<option value="">-- Select a notification type --</option>';

    if (schemas.length === 0) {
      notificationFormContainer.innerHTML =
        '<p style="padding: var(--space-xl); color: var(--color-text-body-secondary); text-align: center;">No notification types are configured</p>';
      return;
    }

    schemas.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.notificationType;
      option.textContent = entry.notificationType;
      notificationTypeSelect.appendChild(option);
    });
  } catch (err) {
    notificationFormContainer.innerHTML =
      '<p style="padding: var(--space-xl); color: var(--color-text-status-error); text-align: center;">Unable to load notification schemas</p>';
    notificationsSchemasLoaded = false;
  }
}

notificationTypeSelect.addEventListener("change", () => {
  const selectedType = notificationTypeSelect.value;
  const prefillActions = document.getElementById("prefill-actions");
  if (!selectedType) {
    currentSchema = null;
    notificationFormContainer.innerHTML = "";
    if (prefillActions) prefillActions.style.display = "none";
    return;
  }
  const entry = availableSchemas.find((s) => s.notificationType === selectedType);
  currentSchema = entry ? entry.schema : null;
  if (currentSchema) {
    if (prefillActions) prefillActions.style.display = "";
    renderSchemaForm(currentSchema, notificationFormContainer);
  }
});

// ===== Dynamic Form Generator =====

/**
 * Renders a dynamic form from a JSON Schema into the given container.
 * @param {object} schema - The JSON Schema object
 * @param {HTMLElement} container - The DOM container to render into
 */
function renderSchemaForm(schema, container) {
  container.innerHTML = "";
  if (!schema || !schema.properties) return;
  const requiredFields = Array.isArray(schema.required) ? schema.required : [];
  for (const [name, propSchema] of Object.entries(schema.properties)) {
    renderField(name, propSchema, container, requiredFields, name);
  }
  // Attach validation listeners for real-time error clearing
  attachValidationListeners(container, schema);
}

/**
 * Recursively renders a single field based on its JSON Schema definition.
 * @param {string} name - The property name
 * @param {object} propSchema - The JSON Schema for this property
 * @param {HTMLElement} parentContainer - The DOM container to append to
 * @param {string[]} requiredFields - Array of required field names at this level
 * @param {string} path - The dot-separated path for data-path attribute
 */
function renderField(name, propSchema, parentContainer, requiredFields, path) {
  const isRequired = requiredFields.includes(name);
  const type = resolveSchemaType(propSchema);

  if (type === "object" && propSchema.properties) {
    // Render as collapsible section. It carries data-path (like the leaf
    // inputs and array sections below) so validateForm can look up whether
    // this object itself is required and check it as a unit — a required
    // object whose individual children are all optional would otherwise
    // never be enforced.
    const section = document.createElement("div");
    section.className = "notification-collapsible";
    section.setAttribute("data-path", path);
    section.setAttribute("data-container-type", "object");

    const header = document.createElement("button");
    header.type = "button";
    header.className = "notification-collapsible-header";
    header.textContent = formatLabel(name) + (isRequired ? " *" : "");
    header.addEventListener("click", (e) => {
      e.stopPropagation();
      section.classList.toggle("open");
    });

    const errorSpan = document.createElement("span");
    errorSpan.className = "notification-container-error";
    errorSpan.style.display = "none";

    const content = document.createElement("div");
    content.className = "notification-collapsible-content";

    const nestedRequired = Array.isArray(propSchema.required) ? propSchema.required : [];
    for (const [childName, childSchema] of Object.entries(propSchema.properties)) {
      renderField(childName, childSchema, content, nestedRequired, path + "." + childName);
    }

    section.appendChild(header);
    section.appendChild(errorSpan);
    section.appendChild(content);
    parentContainer.appendChild(section);
    return;
  }

  if (type === "array" && propSchema.items) {
    // Render as a repeatable section with an "Add" button. This handles both
    // object-item arrays (each item is a group of fields) and scalar/enum-item
    // arrays (each item is a single input). addArrayItem renders the correct
    // per-item content based on the item schema.
    const section = document.createElement("div");
    section.className = "notification-array-section";
    section.setAttribute("data-path", path);
    section.setAttribute("data-container-type", "array");

    const label = document.createElement("label");
    label.style.fontWeight = "600";
    label.style.fontSize = "13px";
    label.style.display = "block";
    label.style.marginBottom = "var(--space-s)";
    label.textContent = formatLabel(name) + (isRequired ? " *" : "");
    section.appendChild(label);

    const errorSpan = document.createElement("span");
    errorSpan.className = "notification-container-error";
    errorSpan.style.display = "none";
    section.appendChild(errorSpan);

    const itemsContainer = document.createElement("div");
    itemsContainer.className = "notification-array-items";
    section.appendChild(itemsContainer);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "notification-add-btn";
    addBtn.textContent = "+ Add " + formatLabel(name);
    addBtn.addEventListener("click", () => {
      addArrayItem(propSchema.items, itemsContainer, path);
      // Adding an item satisfies "at least one item" — clear any stale error.
      clearContainerError(section);
    });
    section.appendChild(addBtn);

    parentContainer.appendChild(section);
    return;
  }

  // Render as a simple input field
  const fieldDiv = document.createElement("div");
  fieldDiv.className = "order-form-field";

  const labelEl = document.createElement("label");
  labelEl.textContent = formatLabel(name) + (isRequired ? " *" : "");
  fieldDiv.appendChild(labelEl);

  let input;

  if (propSchema.enum) {
    // Select dropdown for enum
    input = document.createElement("select");
    input.setAttribute("data-path", path);
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- Select --";
    input.appendChild(defaultOption);
    propSchema.enum.forEach((val) => {
      const option = document.createElement("option");
      option.value = val;
      option.textContent = val;
      input.appendChild(option);
    });
  } else if (type === "boolean") {
    input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("data-path", path);
  } else if (type === "integer" || type === "number") {
    input = document.createElement("input");
    input.type = "number";
    input.setAttribute("data-path", path);
    if (propSchema.examples && propSchema.examples.length > 0) {
      input.placeholder = String(propSchema.examples[0]);
    }
  } else {
    // Default to text input (string or unknown)
    input = document.createElement("input");
    input.type = "text";
    input.setAttribute("data-path", path);
    if (propSchema.examples && propSchema.examples.length > 0) {
      const example = propSchema.examples[0];
      input.placeholder = typeof example === "string" ? example : JSON.stringify(example);
    }
  }

  fieldDiv.appendChild(input);

  // Add error span
  const errorSpan = document.createElement("span");
  errorSpan.className = "field-error";
  errorSpan.style.display = "none";
  fieldDiv.appendChild(errorSpan);

  parentContainer.appendChild(fieldDiv);
}

/**
 * Adds a new array item to a repeatable section.
 * @param {object} itemSchema - The JSON Schema for array items
 * @param {HTMLElement} itemsContainer - The container for array items
 * @param {string} basePath - The base path for the array
 */
function addArrayItem(itemSchema, itemsContainer, basePath) {
  // Count only direct children so nested array items (e.g. a scalar array
  // inside an object item) don't inflate this array's next index.
  const index = itemsContainer.querySelectorAll(":scope > .notification-array-item").length;
  const itemDiv = document.createElement("div");
  itemDiv.className = "notification-array-item";

  if (resolveSchemaType(itemSchema) === "object" && itemSchema.properties) {
    // Object items: render each property as its own field.
    const itemRequired = Array.isArray(itemSchema.required) ? itemSchema.required : [];
    for (const [childName, childSchema] of Object.entries(itemSchema.properties)) {
      renderField(childName, childSchema, itemDiv, itemRequired, basePath + "[" + index + "]." + childName);
    }
  } else {
    // Scalar/enum items: the element itself is a single leaf value. Render one
    // input whose data-path is the indexed path (e.g. "OrderPrograms[0]") so it
    // is collected as an array element rather than a JSON-encoded string.
    renderField("", itemSchema, itemDiv, [], basePath + "[" + index + "]");
  }

  // Add remove button
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-remove-item";
  removeBtn.textContent = "Remove";
  removeBtn.style.position = "absolute";
  removeBtn.style.top = "var(--space-s)";
  removeBtn.style.right = "var(--space-s)";
  removeBtn.addEventListener("click", () => {
    itemDiv.remove();
  });
  itemDiv.appendChild(removeBtn);

  itemsContainer.appendChild(itemDiv);

  // Attach validation listeners for the new inputs
  if (currentSchema) {
    attachValidationListeners(itemDiv, currentSchema);
  }
}

/**
 * Resolves the effective type from a JSON Schema property.
 * Handles array-type definitions like ["string", "null"].
 * @param {object} propSchema - The property schema
 * @returns {string} The resolved type string
 */
function resolveSchemaType(propSchema) {
  if (!propSchema || !propSchema.type) return "string";
  if (Array.isArray(propSchema.type)) {
    // Return the first non-null type
    return propSchema.type.find((t) => t !== "null") || "string";
  }
  return propSchema.type;
}

/**
 * Converts a camelCase or PascalCase field name to a human-readable label.
 * @param {string} name - The field name
 * @returns {string} Formatted label
 */
function formatLabel(name) {
  return name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

// ===== Prefill Form Logic =====

/**
 * Prefills the notification form with sample data from the schema's top-level examples[0].
 * Recursively populates nested objects and array items.
 * @param {object} schema - The JSON Schema object with an examples array
 * @param {HTMLElement} container - The form container element
 */
function prefillForm(schema, container) {
  if (!schema || !schema.examples || schema.examples.length === 0) return;
  const exampleData = schema.examples[0];
  if (!exampleData || typeof exampleData !== "object") return;

  // Clear existing validation errors
  container.querySelectorAll(".field-error").forEach((el) => {
    el.textContent = "";
    el.style.display = "none";
  });
  container.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
  container.querySelectorAll(".notification-array-section, .notification-collapsible").forEach(clearContainerError);

  // Recursively fill fields from example data
  prefillFields(exampleData, schema, container);
}

/**
 * Recursively fills form fields based on example data and schema structure.
 * Handles leaf inputs, nested objects, and nested arrays (including arrays
 * nested inside array items) uniformly. All lookups are scoped to `scope`, so
 * the same logic works at the top level and within an individual array item.
 * @param {object} data - The example data object
 * @param {object} schema - The JSON Schema for this level
 * @param {HTMLElement} scope - The DOM element to search for inputs within
 * @param {string} [pathPrefix] - The current path prefix for data-path matching
 */
function prefillFields(data, schema, scope, pathPrefix) {
  if (!data || typeof data !== "object" || !schema || !schema.properties) return;

  for (const [key, value] of Object.entries(data)) {
    const propSchema = schema.properties[key];
    if (!propSchema) continue;

    const currentPath = pathPrefix ? pathPrefix + "." + key : key;
    const type = resolveSchemaType(propSchema);

    if (type === "array" && Array.isArray(value) && propSchema.items) {
      // Find the array section by data-path, scoped to the current element
      const arraySection = scope.querySelector('.notification-array-section[data-path="' + currentPath + '"]');
      if (!arraySection) continue;

      const itemsContainer = arraySection.querySelector(".notification-array-items");
      if (!itemsContainer) continue;

      const itemIsObject = resolveSchemaType(propSchema.items) === "object";

      // Add array items and fill them
      value.forEach((itemData, index) => {
        addArrayItem(propSchema.items, itemsContainer, currentPath);
        // The just-added item is the last direct child; scoping to ":scope >"
        // avoids matching items belonging to any nested array sections.
        const addedItems = itemsContainer.querySelectorAll(":scope > .notification-array-item");
        const addedItem = addedItems[addedItems.length - 1];
        if (!addedItem) return;

        if (itemIsObject) {
          if (itemData && typeof itemData === "object") {
            // Recurse with the new item element as scope so nested objects AND
            // nested arrays within the item are populated.
            prefillFields(itemData, propSchema.items, addedItem, currentPath + "[" + index + "]");
          }
        } else {
          // Scalar/enum item: set the single indexed input directly.
          const input = addedItem.querySelector('[data-path="' + currentPath + "[" + index + "]" + '"]');
          if (input) {
            if (input.type === "checkbox") {
              input.checked = Boolean(itemData);
            } else {
              input.value = typeof itemData === "object" ? JSON.stringify(itemData) : String(itemData);
            }
          }
        }
      });
    } else if (type === "object" && propSchema.properties && typeof value === "object" && !Array.isArray(value)) {
      // Recurse into nested object (same scope, extended path)
      prefillFields(value, propSchema, scope, currentPath);
    } else {
      // Set value on input field matching data-path
      const input = scope.querySelector('[data-path="' + currentPath + '"]');
      if (!input) continue;

      if (input.type === "checkbox") {
        input.checked = Boolean(value);
      } else {
        input.value = typeof value === "object" ? JSON.stringify(value) : String(value);
      }
    }
  }
}

// Wire the "Prefill Sample Data" button for notifications
const btnPrefillNotification = document.getElementById("btn-prefill-notification");
btnPrefillNotification.addEventListener("click", () => {
  if (!currentSchema) return;
  // If no form is rendered yet, render it first
  if (notificationFormContainer.innerHTML.trim() === "" || !notificationFormContainer.querySelector("[data-path]")) {
    renderSchemaForm(currentSchema, notificationFormContainer);
  }
  prefillForm(currentSchema, notificationFormContainer);
});

// ===== Notification Form Validation =====

/**
 * Clears a container-level (required array / required object) validation error.
 * @param {HTMLElement} containerEl - A `.notification-array-section` or `.notification-collapsible` element
 */
function clearContainerError(containerEl) {
  containerEl.classList.remove("invalid");
  const errorSpan = Array.from(containerEl.children).find((el) => el.classList.contains("notification-container-error"));
  if (errorSpan) {
    errorSpan.textContent = "";
    errorSpan.style.display = "none";
  }
}

/**
 * Shows a container-level (required array / required object) validation error.
 * @param {HTMLElement} containerEl - A `.notification-array-section` or `.notification-collapsible` element
 * @param {string} message - The error message
 */
function showContainerError(containerEl, message) {
  containerEl.classList.add("invalid");
  const errorSpan = Array.from(containerEl.children).find((el) => el.classList.contains("notification-container-error"));
  if (errorSpan) {
    errorSpan.textContent = message;
    errorSpan.style.display = "block";
  }
}

/**
 * Determines whether a rendered object/array container currently holds any
 * user-provided data: a non-empty leaf input/select value, a checked
 * checkbox, or a nested array section with at least one item.
 * @param {HTMLElement} containerEl - The DOM subtree to inspect
 * @returns {boolean}
 */
function hasPopulatedContent(containerEl) {
  const leafInputs = containerEl.querySelectorAll("input[data-path], select[data-path]");
  for (const input of leafInputs) {
    if (input.type === "checkbox") {
      if (input.checked) return true;
    } else if (String(input.value).trim() !== "") {
      return true;
    }
  }

  const nestedArraySections = containerEl.querySelectorAll(".notification-array-section");
  for (const arraySection of nestedArraySections) {
    const itemsContainer = arraySection.querySelector(".notification-array-items");
    if (itemsContainer && itemsContainer.querySelectorAll(".notification-array-item").length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Validates the notification form against the schema and returns collected form data or null.
 * Checks required leaf fields have non-empty values, numeric fields have valid numbers,
 * required arrays have at least one item, and required objects have at least one
 * populated descendant field. Displays inline errors next to invalid fields/sections.
 * @param {object} schema - The JSON Schema object
 * @param {HTMLElement} container - The DOM container holding the form
 * @returns {object|null} Collected form data as nested JSON, or null if validation fails
 */
function validateForm(schema, container) {
  let isValid = true;

  // Leaf form controls only. Object sections (.notification-collapsible) and
  // array sections (.notification-array-section) also carry data-path (for
  // isFieldRequired lookups and prefill matching), but they're containers,
  // not value-holding controls, so they're excluded here and validated as
  // units below — otherwise a required array with zero items, or a required
  // object whose own children are all optional, would silently pass.
  const inputs = container.querySelectorAll("input[data-path], select[data-path]");
  const arraySections = container.querySelectorAll(".notification-array-section[data-path]");
  const objectSections = container.querySelectorAll(".notification-collapsible[data-path]");

  // Clear all existing errors first
  inputs.forEach((input) => {
    const errorSpan = input.parentElement.querySelector(".field-error");
    if (errorSpan) {
      errorSpan.textContent = "";
      errorSpan.style.display = "none";
    }
    input.classList.remove("invalid");
  });
  arraySections.forEach(clearContainerError);
  objectSections.forEach(clearContainerError);

  // Validate each leaf input
  inputs.forEach((input) => {
    const path = input.getAttribute("data-path");
    const inputType = input.type;
    const value = inputType === "checkbox" ? input.checked : input.value;

    // Check if this field is required based on the schema
    const isRequired = isFieldRequired(schema, path);

    // Required field validation (skip checkboxes - they always have a boolean value)
    if (isRequired && inputType !== "checkbox") {
      const strValue = String(value).trim();
      if (!strValue) {
        showNotificationFieldError(input, "This field is required");
        isValid = false;
        return;
      }
    }

    // Numeric validation for number-type inputs
    if (inputType === "number") {
      const strValue = input.value.trim();
      if (strValue !== "") {
        const num = Number(strValue);
        if (isNaN(num)) {
          showNotificationFieldError(input, "Must be a valid number");
          isValid = false;
          return;
        }
      }
    }
  });

  // Validate required array containers — must contain at least one item
  arraySections.forEach((section) => {
    const path = section.getAttribute("data-path");
    if (!isFieldRequired(schema, path)) return;
    const itemsContainer = section.querySelector(".notification-array-items");
    const itemCount = itemsContainer ? itemsContainer.querySelectorAll(".notification-array-item").length : 0;
    if (itemCount === 0) {
      showContainerError(section, "At least one item is required");
      isValid = false;
    }
  });

  // Validate required object containers — must have at least one populated field
  objectSections.forEach((section) => {
    const path = section.getAttribute("data-path");
    if (!isFieldRequired(schema, path)) return;
    const content = section.querySelector(".notification-collapsible-content");
    if (!content || !hasPopulatedContent(content)) {
      section.classList.add("open"); // reveal so the user can see what to fill in
      showContainerError(section, "At least one field in this section is required");
      isValid = false;
    }
  });

  if (!isValid) return null;

  // Collect form data
  const data = {};
  inputs.forEach((input) => {
    const path = input.getAttribute("data-path");
    const inputType = input.type;
    let value;

    if (inputType === "checkbox") {
      value = input.checked;
    } else if (inputType === "number") {
      const strValue = input.value.trim();
      value = strValue === "" ? undefined : Number(strValue);
    } else {
      value = input.value;
    }

    // Skip empty non-required fields (don't include them in the payload)
    if (value === undefined || (typeof value === "string" && value === "")) return;

    setNestedValue(data, path, value);
  });

  return data;
}

/**
 * Determines if a field is required based on the schema's required arrays at each nesting level.
 * @param {object} schema - The root JSON Schema
 * @param {string} path - The dot-separated data-path (e.g., "Payload.OrderChangeNotification.SellerId")
 * @returns {boolean}
 */
function isFieldRequired(schema, path) {
  // Parse the path into segments, handling array indices
  const segments = parseDataPath(path);
  let currentSchema = schema;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    // If this is an array index segment, traverse into items schema
    if (segment.isIndex) {
      if (currentSchema && resolveSchemaType(currentSchema) === "array" && currentSchema.items) {
        currentSchema = currentSchema.items;
      } else {
        return false;
      }
      continue;
    }

    // For the last segment, check if it's in the current schema's required array
    if (i === segments.length - 1) {
      const requiredList = Array.isArray(currentSchema.required) ? currentSchema.required : [];
      return requiredList.includes(segment.name);
    }

    // Navigate into the property schema for the next level
    if (currentSchema.properties && currentSchema.properties[segment.name]) {
      const propSchema = currentSchema.properties[segment.name];
      const type = resolveSchemaType(propSchema);
      if (type === "object") {
        currentSchema = propSchema;
      } else if (type === "array" && propSchema.items) {
        currentSchema = propSchema;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  return false;
}

/**
 * Parses a data-path string into segments.
 * Handles dot-separated paths and array index notation.
 * E.g., "Payload.Items[0].Name" → [{name:"Payload"}, {name:"Items"}, {isIndex:true, index:0}, {name:"Name"}]
 * @param {string} path
 * @returns {Array<{name?: string, isIndex?: boolean, index?: number}>}
 */
function parseDataPath(path) {
  const segments = [];
  const parts = path.split(".");

  for (const part of parts) {
    // Check for array notation like "Items[0]"
    const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/);
    if (arrayMatch) {
      segments.push({ name: arrayMatch[1] });
      segments.push({ isIndex: true, index: parseInt(arrayMatch[2], 10) });
    } else {
      segments.push({ name: part });
    }
  }

  return segments;
}

/**
 * Sets a value in a nested object based on a data-path string.
 * Handles dot-separated paths and array index notation.
 * @param {object} obj - The root object to set into
 * @param {string} path - The data-path (e.g., "Payload.Items[0].Name")
 * @param {*} value - The value to set
 */
function setNestedValue(obj, path, value) {
  const segments = parseDataPath(path);
  let current = obj;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];

    if (segment.isIndex) {
      // Current segment is an array index - ensure the array slot exists
      while (current.length <= segment.index) {
        current.push(nextSegment && nextSegment.isIndex ? [] : {});
      }
      current = current[segment.index];
    } else {
      // Current segment is a property name - ensure it exists
      if (!(segment.name in current)) {
        // Look ahead to determine if next level is array or object
        if (nextSegment && nextSegment.isIndex) {
          current[segment.name] = [];
        } else {
          current[segment.name] = {};
        }
      }
      current = current[segment.name];
    }
  }

  // Set the value at the last segment
  const lastSegment = segments[segments.length - 1];
  if (lastSegment.isIndex) {
    while (current.length <= lastSegment.index) {
      current.push(undefined);
    }
    current[lastSegment.index] = value;
  } else {
    current[lastSegment.name] = value;
  }
}

/**
 * Shows an inline error message for a notification form field.
 * @param {HTMLElement} input - The input element
 * @param {string} message - The error message
 */
function showNotificationFieldError(input, message) {
  input.classList.add("invalid");
  const errorSpan = input.parentElement.querySelector(".field-error");
  if (errorSpan) {
    errorSpan.textContent = message;
    errorSpan.style.display = "block";
  }
}

/**
 * Attaches input event listeners to clear validation errors when a field becomes valid.
 * @param {HTMLElement} container - The form container
 * @param {object} schema - The JSON Schema for re-validation
 */
function attachValidationListeners(container, schema) {
  const inputs = container.querySelectorAll("input[data-path], select[data-path]");
  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      const path = input.getAttribute("data-path");
      const inputType = input.type;
      const isRequired = isFieldRequired(schema, path);
      let hasError = false;

      if (isRequired && inputType !== "checkbox") {
        const strValue = input.value.trim();
        if (!strValue) {
          hasError = true;
        }
      }

      if (!hasError && inputType === "number") {
        const strValue = input.value.trim();
        if (strValue !== "" && isNaN(Number(strValue))) {
          hasError = true;
        }
      }

      if (!hasError) {
        input.classList.remove("invalid");
        const errorSpan = input.parentElement.querySelector(".field-error");
        if (errorSpan) {
          errorSpan.textContent = "";
          errorSpan.style.display = "none";
        }
      }

      // A field just became populated (or was already valid) — clear any
      // ancestor "required object" container error that this satisfies.
      let ancestor = input.closest(".notification-collapsible");
      while (ancestor) {
        if (ancestor.classList.contains("invalid")) {
          const content = ancestor.querySelector(".notification-collapsible-content");
          if (content && hasPopulatedContent(content)) {
            clearContainerError(ancestor);
          }
        }
        const parent = ancestor.parentElement;
        ancestor = parent ? parent.closest(".notification-collapsible") : null;
      }
    });
  });
}

// ===== Send Notification Flow =====
const btnSendNotification = document.getElementById("btn-send-notification");
const notificationStatus = document.getElementById("notification-status");

btnSendNotification.addEventListener("click", async () => {
  // Hide any previous status message
  notificationStatus.style.display = "none";
  notificationStatus.textContent = "";
  notificationStatus.className = "notification-status";

  // Ensure a notification type is selected
  if (!currentSchema) {
    notificationStatus.textContent = "Please select a notification type";
    notificationStatus.className = "notification-status error";
    notificationStatus.style.display = "block";
    return;
  }

  // Validate the form — returns payload object or null on failure
  const payload = validateForm(currentSchema, notificationFormContainer);
  if (!payload) return;

  // Disable button and show loading state
  btnSendNotification.disabled = true;
  const originalText = btnSendNotification.textContent;
  btnSendNotification.textContent = "Sending...";

  try {
    const res = await fetch("/manage/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      notificationStatus.textContent = "Notification sent successfully. Message ID: " + (data.messageId || "unknown");
      notificationStatus.className = "notification-status success";
      notificationStatus.style.display = "block";
    } else {
      const data = await res.json().catch(() => ({}));
      notificationStatus.textContent = data.error || "Failed to send notification (HTTP " + res.status + ")";
      notificationStatus.className = "notification-status error";
      notificationStatus.style.display = "block";
    }
  } catch (err) {
    notificationStatus.textContent = "Network error. Please check your connection.";
    notificationStatus.className = "notification-status error";
    notificationStatus.style.display = "block";
  } finally {
    btnSendNotification.disabled = false;
    btnSendNotification.textContent = originalText;
  }
});

// Fetch schemas when Notifications tab is activated
const tabNotifications = document.getElementById("tab-notifications");
tabNotifications.addEventListener("click", () => {
  loadNotificationSchemas();
});

// ===== Data Viewer Tab Logic =====
const dataViewerDomainLabels = {
  orders: "Orders",
  listings: "Listings",
  catalog: "Catalog Items",
  inventory: "FBA Inventory",
  pricing: "Product Pricing",
  reports: "Reports",
  extFulfillmentInventory: "Ext. Fulfillment Inventory",
  extFulfillmentReturns: "Ext. Fulfillment Returns",
  extFulfillmentShipments: "Ext. Fulfillment Shipments",
  listingsRestrictions: "Listings Restrictions",
  productTypeDefinitions: "Product Type Definitions",
};

function renderDataViewerDomainCard(domain, entities) {
  const keys = Object.keys(entities);
  const label = dataViewerDomainLabels[domain] || domain;
  const card = document.createElement("div");
  card.style.cssText = "border: 1px solid var(--color-border-divider-default); border-radius: var(--border-radius-input); margin-bottom: var(--space-m); overflow: hidden;";

  const header = document.createElement("div");
  header.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: var(--space-m) var(--space-l); background: var(--color-background-container-header);";
  header.innerHTML =
    '<span style="font-weight: 700; font-size: 14px;">' +
    escapeHtml(label) +
    '</span><span style="font-size: 12px; color: var(--color-text-body-secondary); background: var(--color-border-divider-default); padding: 2px 8px; border-radius: 10px;">' +
    keys.length +
    (keys.length === 1 ? " entity" : " entities") +
    "</span>";
  card.appendChild(header);

  if (keys.length > 0) {
    const body = document.createElement("div");
    body.style.cssText = "padding: 0; max-height: 300px; overflow-y: auto;";
    keys.forEach(function (key) {
      const row = document.createElement("details");
      row.style.cssText = "border-top: 1px solid var(--color-border-divider-default);";
      const summary = document.createElement("summary");
      summary.style.cssText = "padding: var(--space-s) var(--space-l); font-size: 13px; cursor: pointer; font-family: monospace; color: var(--color-text-interactive-default);";
      summary.textContent = key;
      row.appendChild(summary);
      const detailContent = document.createElement("div");
      detailContent.style.cssText = "padding: var(--space-s) var(--space-l) var(--space-m); background: var(--color-background-navigation); overflow-x: auto;";
      const pre = document.createElement("pre");
      pre.style.cssText = "font-size: 12px; color: #c5c8c6; margin: 0; white-space: pre-wrap; word-break: break-word;";
      pre.textContent = JSON.stringify(entities[key], null, 2);
      detailContent.appendChild(pre);
      row.appendChild(detailContent);
      body.appendChild(row);
    });
    card.appendChild(body);
  }

  return card;
}

async function fetchDataViewer() {
  const content = document.getElementById("data-viewer-content");
  content.innerHTML = '<p style="padding: var(--space-xl); color: var(--color-text-body-secondary); text-align: center;">Loading database contents...</p>';
  try {
    const res = await fetch("/data");
    const data = await res.json();
    content.textContent = "";

    const domains = Object.keys(data);
    const populated = domains.filter(function (d) {
      return Object.keys(data[d]).length > 0;
    });
    const empty = domains.filter(function (d) {
      return Object.keys(data[d]).length === 0;
    });

    if (populated.length === 0) {
      content.innerHTML =
        '<div style="text-align: center; padding: var(--space-xxl); color: var(--color-text-body-secondary); font-size: 14px;">No data in the sandbox. Use the data generator or seed a scenario to get started.</div>';
      return;
    }

    // Summary bar
    const totalEntities = populated.reduce(function (sum, d) {
      return sum + Object.keys(data[d]).length;
    }, 0);
    const summaryBar = document.createElement("div");
    summaryBar.style.cssText = "margin-bottom: var(--space-l); padding: var(--space-m) var(--space-l); background: var(--color-background-status-info); border-radius: var(--border-radius-input); font-size: 13px; color: var(--color-text-status-info);";
    summaryBar.textContent =
      totalEntities +
      " entities across " +
      populated.length +
      " domain" +
      (populated.length === 1 ? "" : "s") +
      (empty.length > 0 ? " · " + empty.length + " empty" : "");
    content.appendChild(summaryBar);

    // Render populated domains
    populated.forEach(function (domain) {
      content.appendChild(renderDataViewerDomainCard(domain, data[domain]));
    });
  } catch (err) {
    content.innerHTML = '<p style="padding: var(--space-xl); color: var(--color-text-status-error); text-align: center;">Failed to load data: ' + escapeHtml(err.message) + '</p>';
  }
}

// Fetch data when Data Viewer tab is activated
const tabDataViewer = document.getElementById("tab-data-viewer");
tabDataViewer.addEventListener("click", () => {
  fetchDataViewer();
});

// ===== Orders Tab Logic =====
const ordersListContent = document.getElementById("orders-list-content");
let ordersCache = [];

function formatDateTime(isoString) {
  if (!isoString) return "N/A";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const pad = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  } catch {
    return isoString;
  }
}

function getFulfillmentStatus(order) {
  if (order.fulfillment && order.fulfillment.fulfillmentStatus) {
    return order.fulfillment.fulfillmentStatus;
  }
  return "N/A";
}

function renderOrderList(orders) {
  ordersCache = orders || [];
  ordersListContent.innerHTML = "";

  if (ordersCache.length === 0) {
    ordersListContent.innerHTML = '<p class="orders-empty-state">No orders exist yet.</p>';
    return;
  }

  ordersCache.forEach((order) => {
    const orderId = order.orderId || order._key || "Unknown";
    const status = getFulfillmentStatus(order);
    const createdTime = formatDateTime(order.createdTime);

    const row = document.createElement("div");
    row.className = "order-row";
    row.setAttribute("data-order-id", orderId);

    row.innerHTML =
      '<div class="order-row-info">' +
        '<div class="order-row-id">' + escapeHtml(orderId) + '</div>' +
        '<div class="order-row-meta">' + escapeHtml(createdTime) + '</div>' +
      '</div>' +
      '<span class="order-status-badge">' + escapeHtml(status) + '</span>' +
      '<button class="order-row-delete" aria-label="Delete order ' + escapeAttr(orderId) + '" title="Delete order">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="3 6 5 6 21 6"/>' +
          '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
        '</svg>' +
      '</button>';

    ordersListContent.appendChild(row);
  });
}

async function fetchOrders() {
  ordersListContent.innerHTML = '<p class="orders-empty-state">Loading orders...</p>';
  try {
    const res = await fetch("/data");
    if (!res.ok) {
      ordersListContent.innerHTML = '<p class="orders-error-state">Unable to load orders. Please try again.</p>';
      return;
    }
    const data = await res.json();
    const ordersObj = data.orders || {};
    const orders = Object.entries(ordersObj).map(([key, val]) => ({ orderId: key, ...val }));
    renderOrderList(orders);
  } catch (err) {
    ordersListContent.innerHTML = '<p class="orders-error-state">Unable to load orders. Please try again.</p>';
  }
}

// Delete order with confirmation
async function deleteOrder(orderId, deleteBtn) {
  const confirmed = confirm("Are you sure you want to delete order " + orderId + "?");
  if (!confirmed) return;

  deleteBtn.disabled = true;

  const row = deleteBtn.closest(".order-row");
  const existingError = row.parentElement.querySelector('.order-delete-error[data-order-id="' + CSS.escape(orderId) + '"]');
  if (existingError) existingError.remove();

  try {
    const res = await fetch("/manage/orders/" + encodeURIComponent(orderId), {
      method: "DELETE",
    });

    if (res.ok) {
      row.remove();
      ordersCache = ordersCache.filter((o) => o.orderId !== orderId);
      if (editingOrderId === orderId) {
        switchToCreateMode();
      }
      if (ordersCache.length === 0) {
        ordersListContent.innerHTML = '<p class="orders-empty-state">No orders exist yet.</p>';
      }
    } else {
      deleteBtn.disabled = false;
      const errorData = await res.json().catch(() => ({ error: "Delete failed" }));
      const errorMsg = errorData.error || errorData.message || "Delete failed";
      const errorEl = document.createElement("div");
      errorEl.className = "order-delete-error";
      errorEl.setAttribute("data-order-id", orderId);
      errorEl.textContent = errorMsg;
      row.insertAdjacentElement("afterend", errorEl);
    }
  } catch (err) {
    deleteBtn.disabled = false;
    const errorEl = document.createElement("div");
    errorEl.className = "order-delete-error";
    errorEl.setAttribute("data-order-id", orderId);
    errorEl.textContent = "Network error. Please check your connection.";
    row.insertAdjacentElement("afterend", errorEl);
  }
}

// Event delegation for delete buttons
ordersListContent.addEventListener("click", (e) => {
  const deleteBtn = e.target.closest(".order-row-delete");
  if (!deleteBtn) return;
  e.stopPropagation();
  const row = deleteBtn.closest(".order-row");
  const orderId = row.getAttribute("data-order-id");
  if (orderId) {
    deleteOrder(orderId, deleteBtn);
  }
});

// Fetch orders when Orders tab is activated
const tabOrders = document.getElementById("tab-orders");
tabOrders.addEventListener("click", () => {
  fetchOrders();
});

// ===== Order Editor Logic =====
let editorMode = "create"; // "create" or "edit"
let editingOrderId = null;
let programsList = [];

const editorPlaceholder = document.getElementById("orders-editor-placeholder");
const editorFormContainer = document.getElementById("orders-editor-form-container");
const editorTitle = document.getElementById("editor-title");
const btnNewOrder = document.getElementById("btn-new-order");
const btnSubmitOrder = document.getElementById("btn-submit-order");
const btnPrefill = document.getElementById("btn-prefill");
const btnAddItem = document.getElementById("btn-add-item");
const orderItemsContainer = document.getElementById("order-items-container");
const programsTagsEl = document.getElementById("programs-tags");
const programInput = document.getElementById("field-programInput");
const formErrorMessage = document.getElementById("form-error-message");

function showEditorForm() {
  editorPlaceholder.style.display = "none";
  editorFormContainer.style.display = "";
}

function hideEditorForm() {
  editorPlaceholder.style.display = "";
  editorFormContainer.style.display = "none";
}

function switchToCreateMode() {
  editorMode = "create";
  editingOrderId = null;
  editorTitle.textContent = "Create Order";
  btnSubmitOrder.textContent = "Create Order";
  btnPrefill.style.display = "inline-flex";
  document.getElementById("field-orderId").readOnly = false;
  clearEditorForm();
  showEditorForm();
  addOrderItem(); // Ensure at least one item
  // Deselect any active order row
  document.querySelectorAll(".order-row.active").forEach((r) => r.classList.remove("active"));
}

function switchToEditMode(order) {
  editorMode = "edit";
  editingOrderId = order.orderId;
  editorTitle.textContent = "Edit Order";
  btnSubmitOrder.textContent = "Update Order";
  btnPrefill.style.display = "none";
  clearEditorForm();
  populateEditorForm(order);
  document.getElementById("field-orderId").readOnly = true;
  showEditorForm();
}

function clearEditorForm() {
  document.getElementById("field-orderId").value = "";
  document.getElementById("field-createdTime").value = "";
  document.getElementById("field-lastUpdatedTime").value = "";
  document.getElementById("field-channelName").value = "";
  document.getElementById("field-marketplaceId").value = "";
  document.getElementById("field-marketplaceName").value = "";
  document.getElementById("field-fulfillmentStatus").value = "";
  document.getElementById("field-fulfilledBy").value = "";
  document.getElementById("field-fulfillmentServiceLevel").value = "";
  document.getElementById("field-shipByEarliest").value = "";
  document.getElementById("field-shipByLatest").value = "";
  document.getElementById("field-deliverByEarliest").value = "";
  document.getElementById("field-deliverByLatest").value = "";
  document.getElementById("field-buyerName").value = "";
  document.getElementById("field-buyerEmail").value = "";
  document.getElementById("field-buyerCompanyName").value = "";
  document.getElementById("field-buyerPurchaseOrderNumber").value = "";
  document.getElementById("field-recipientName").value = "";
  document.getElementById("field-recipientCompanyName").value = "";
  document.getElementById("field-addressLine1").value = "";
  document.getElementById("field-addressLine2").value = "";
  document.getElementById("field-addressLine3").value = "";
  document.getElementById("field-city").value = "";
  document.getElementById("field-districtOrCounty").value = "";
  document.getElementById("field-stateOrRegion").value = "";
  document.getElementById("field-municipality").value = "";
  document.getElementById("field-postalCode").value = "";
  document.getElementById("field-countryCode").value = "";
  document.getElementById("field-phone").value = "";
  document.getElementById("field-addressType").value = "";
  document.getElementById("field-dropOffLocation").value = "";
  document.getElementById("field-addressInstruction").value = "";
  document.getElementById("field-grandTotalAmount").value = "";
  document.getElementById("field-grandTotalCurrency").value = "";
  document.getElementById("field-buyerInvoicePreference").value = "";
  document.getElementById("field-invoiceStatus").value = "";
  orderItemsContainer.innerHTML = "";
  document.getElementById("order-aliases-container").innerHTML = "";
  document.getElementById("associated-orders-container").innerHTML = "";
  document.getElementById("proceeds-breakdowns-container").innerHTML = "";
  document.getElementById("payment-executions-container").innerHTML = "";
  document.getElementById("tax-registrations-container").innerHTML = "";
  programsList = [];
  renderProgramsTags();
  clearValidationErrors();
  hideFormError();
}

function populateEditorForm(order) {
  document.getElementById("field-orderId").value = order.orderId || "";
  document.getElementById("field-createdTime").value = order.createdTime || "";
  document.getElementById("field-lastUpdatedTime").value = order.lastUpdatedTime || "";
  document.getElementById("field-channelName").value = (order.salesChannel && order.salesChannel.channelName) || "";
  document.getElementById("field-marketplaceId").value = (order.salesChannel && order.salesChannel.marketplaceId) || "";
  document.getElementById("field-marketplaceName").value = (order.salesChannel && order.salesChannel.marketplaceName) || "";

  // Fulfillment
  const ful = order.fulfillment || {};
  document.getElementById("field-fulfillmentStatus").value = ful.fulfillmentStatus || "";
  document.getElementById("field-fulfilledBy").value = ful.fulfilledBy || "";
  document.getElementById("field-fulfillmentServiceLevel").value = ful.fulfillmentServiceLevel || "";
  const shipBy = ful.shipByWindow || {};
  document.getElementById("field-shipByEarliest").value = shipBy.earliestDateTime || "";
  document.getElementById("field-shipByLatest").value = shipBy.latestDateTime || "";
  const deliverBy = ful.deliverByWindow || {};
  document.getElementById("field-deliverByEarliest").value = deliverBy.earliestDateTime || "";
  document.getElementById("field-deliverByLatest").value = deliverBy.latestDateTime || "";

  // Buyer
  const buyer = order.buyer || {};
  document.getElementById("field-buyerName").value = buyer.buyerName || "";
  document.getElementById("field-buyerEmail").value = buyer.buyerEmail || "";
  document.getElementById("field-buyerCompanyName").value = buyer.buyerCompanyName || "";
  document.getElementById("field-buyerPurchaseOrderNumber").value = buyer.buyerPurchaseOrderNumber || "";

  // Recipient
  const recipient = order.recipient || {};
  const addr = recipient.deliveryAddress || {};
  const deliveryPref = recipient.deliveryPreference || {};
  document.getElementById("field-recipientName").value = addr.name || "";
  document.getElementById("field-recipientCompanyName").value = addr.companyName || "";
  document.getElementById("field-addressLine1").value = addr.addressLine1 || "";
  document.getElementById("field-addressLine2").value = addr.addressLine2 || "";
  document.getElementById("field-addressLine3").value = addr.addressLine3 || "";
  document.getElementById("field-city").value = addr.city || "";
  document.getElementById("field-districtOrCounty").value = addr.districtOrCounty || "";
  document.getElementById("field-stateOrRegion").value = addr.stateOrRegion || "";
  document.getElementById("field-municipality").value = addr.municipality || "";
  document.getElementById("field-postalCode").value = addr.postalCode || "";
  document.getElementById("field-countryCode").value = addr.countryCode || "";
  document.getElementById("field-phone").value = addr.phone || "";
  document.getElementById("field-addressType").value = addr.addressType || "";
  document.getElementById("field-dropOffLocation").value = deliveryPref.dropOffLocation || "";
  document.getElementById("field-addressInstruction").value = deliveryPref.addressInstruction || "";

  // Proceeds
  const proceeds = order.proceeds || {};
  const grandTotal = proceeds.grandTotal || {};
  document.getElementById("field-grandTotalAmount").value = grandTotal.amount || "";
  document.getElementById("field-grandTotalCurrency").value = grandTotal.currencyCode || "";
  (proceeds.breakdowns || []).forEach((b) => addProceedsBreakdown(b));

  // Payment
  const payment = order.payment || {};
  (payment.paymentExecutions || []).forEach((pe) => addPaymentExecution(pe));

  // Tax
  const tax = order.tax || {};
  const taxInvoicing = tax.taxInvoicing || {};
  document.getElementById("field-buyerInvoicePreference").value = taxInvoicing.buyerInvoicePreference || "";
  document.getElementById("field-invoiceStatus").value = taxInvoicing.invoiceStatus || "";
  (tax.taxRegistrations || []).forEach((tr) => addTaxRegistration(tr));

  // Order Aliases
  (order.orderAliases || []).forEach((a) => addAlias(a));

  // Associated Orders
  (order.associatedOrders || []).forEach((ao) => addAssociatedOrder(ao));

  // Populate order items
  const items = order.orderItems || [];
  if (items.length === 0) {
    addOrderItem();
  } else {
    items.forEach((item) => addOrderItem(item));
  }

  // Populate programs
  programsList = Array.isArray(order.programs) ? [...order.programs] : [];
  renderProgramsTags();
}

// ===== Dynamic Section Helpers =====

// --- Order Aliases ---
function addAlias(data) {
  const container = document.getElementById("order-aliases-container");
  const block = document.createElement("div");
  block.className = "order-item-block";
  block.innerHTML =
    '<div class="order-item-block-header">' +
      '<span class="order-item-block-title">Alias</span>' +
      '<button type="button" class="btn-remove-item btn-remove-alias">Remove</button>' +
    '</div>' +
    '<div class="order-form-row">' +
      '<div class="order-form-field">' +
        '<label>Alias Type</label>' +
        '<input type="text" class="alias-type" placeholder="e.g. SELLER_ORDER_ID" value="' + escapeAttr((data && data.aliasType) || "") + '" />' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Alias ID</label>' +
        '<input type="text" class="alias-id" placeholder="Alternative order identifier" value="' + escapeAttr((data && data.aliasId) || "") + '" />' +
      '</div>' +
    '</div>';
  container.appendChild(block);
}

document.getElementById("btn-add-alias").addEventListener("click", () => addAlias());
document.getElementById("order-aliases-container").addEventListener("click", (e) => {
  if (e.target.closest(".btn-remove-alias")) e.target.closest(".order-item-block").remove();
});

// --- Associated Orders ---
function addAssociatedOrder(data) {
  const container = document.getElementById("associated-orders-container");
  const block = document.createElement("div");
  block.className = "order-item-block";
  block.innerHTML =
    '<div class="order-item-block-header">' +
      '<span class="order-item-block-title">Associated Order</span>' +
      '<button type="button" class="btn-remove-item btn-remove-associated">Remove</button>' +
    '</div>' +
    '<div class="order-form-row">' +
      '<div class="order-form-field">' +
        '<label>Order ID</label>' +
        '<input type="text" class="assoc-orderId" placeholder="123-1234567-1234567" value="' + escapeAttr((data && data.orderId) || "") + '" />' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Association Type</label>' +
        '<select class="assoc-type">' +
          '<option value="">-- Select --</option>' +
          '<option value="REPLACEMENT_ORIGINAL_ID"' + (data && data.associationType === "REPLACEMENT_ORIGINAL_ID" ? " selected" : "") + '>REPLACEMENT_ORIGINAL_ID</option>' +
          '<option value="EXCHANGE_ORIGINAL_ID"' + (data && data.associationType === "EXCHANGE_ORIGINAL_ID" ? " selected" : "") + '>EXCHANGE_ORIGINAL_ID</option>' +
        '</select>' +
      '</div>' +
    '</div>';
  container.appendChild(block);
}

document.getElementById("btn-add-associated-order").addEventListener("click", () => addAssociatedOrder());
document.getElementById("associated-orders-container").addEventListener("click", (e) => {
  if (e.target.closest(".btn-remove-associated")) e.target.closest(".order-item-block").remove();
});

// --- Proceeds Breakdowns ---
function addProceedsBreakdown(data) {
  const container = document.getElementById("proceeds-breakdowns-container");
  const block = document.createElement("div");
  block.className = "order-item-block";
  const subtotal = (data && data.subtotal) || {};
  block.innerHTML =
    '<div class="order-item-block-header">' +
      '<span class="order-item-block-title">Breakdown</span>' +
      '<button type="button" class="btn-remove-item btn-remove-breakdown">Remove</button>' +
    '</div>' +
    '<div class="order-form-row">' +
      '<div class="order-form-field">' +
        '<label>Type</label>' +
        '<select class="breakdown-type">' +
          '<option value="">-- Select --</option>' +
          '<option value="ITEM"' + (data && data.type === "ITEM" ? " selected" : "") + '>ITEM</option>' +
          '<option value="SHIPPING"' + (data && data.type === "SHIPPING" ? " selected" : "") + '>SHIPPING</option>' +
          '<option value="GIFT_WRAP"' + (data && data.type === "GIFT_WRAP" ? " selected" : "") + '>GIFT_WRAP</option>' +
          '<option value="COD_FEE"' + (data && data.type === "COD_FEE" ? " selected" : "") + '>COD_FEE</option>' +
          '<option value="TAX"' + (data && data.type === "TAX" ? " selected" : "") + '>TAX</option>' +
          '<option value="DISCOUNT"' + (data && data.type === "DISCOUNT" ? " selected" : "") + '>DISCOUNT</option>' +
          '<option value="DELIVERY_TIP"' + (data && data.type === "DELIVERY_TIP" ? " selected" : "") + '>DELIVERY_TIP</option>' +
          '<option value="OTHER"' + (data && data.type === "OTHER" ? " selected" : "") + '>OTHER</option>' +
        '</select>' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Amount</label>' +
        '<input type="text" class="breakdown-amount" placeholder="e.g. 5.99" value="' + escapeAttr(subtotal.amount || "") + '" />' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Currency</label>' +
        '<input type="text" class="breakdown-currency" placeholder="e.g. USD" value="' + escapeAttr(subtotal.currencyCode || "") + '" />' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Status</label>' +
        '<input type="text" class="breakdown-status" placeholder="e.g. PENDING, FINALIZED" value="' + escapeAttr((data && data.status) || "") + '" />' +
      '</div>' +
    '</div>';
  container.appendChild(block);
}

document.getElementById("btn-add-proceeds-breakdown").addEventListener("click", () => addProceedsBreakdown());
document.getElementById("proceeds-breakdowns-container").addEventListener("click", (e) => {
  if (e.target.closest(".btn-remove-breakdown")) e.target.closest(".order-item-block").remove();
});

// --- Payment Executions ---
function addPaymentExecution(data) {
  const container = document.getElementById("payment-executions-container");
  const block = document.createElement("div");
  block.className = "order-item-block";
  const paymentAmount = (data && data.paymentAmount) || {};
  block.innerHTML =
    '<div class="order-item-block-header">' +
      '<span class="order-item-block-title">Payment Execution</span>' +
      '<button type="button" class="btn-remove-item btn-remove-payment">Remove</button>' +
    '</div>' +
    '<div class="order-form-row">' +
      '<div class="order-form-field">' +
        '<label>Payment Method</label>' +
        '<input type="text" class="payment-method" placeholder="e.g. CreditCard, Invoice, Pix" value="' + escapeAttr((data && data.paymentMethod) || "") + '" />' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Amount</label>' +
        '<input type="text" class="payment-amount" placeholder="e.g. 29.99" value="' + escapeAttr(paymentAmount.amount || "") + '" />' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Currency</label>' +
        '<input type="text" class="payment-currency" placeholder="e.g. USD" value="' + escapeAttr(paymentAmount.currencyCode || "") + '" />' +
      '</div>' +
    '</div>' +
    '<div class="order-form-row">' +
      '<div class="order-form-field">' +
        '<label>Acquirer ID</label>' +
        '<input type="text" class="payment-acquirerId" placeholder="Brazil only" value="' + escapeAttr((data && data.acquirerId) || "") + '" />' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Card Brand</label>' +
        '<input type="text" class="payment-cardBrand" placeholder="e.g. Visa, Mastercard" value="' + escapeAttr((data && data.cardBrand) || "") + '" />' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Authorization Code</label>' +
        '<input type="text" class="payment-authCode" placeholder="Brazil only" value="' + escapeAttr((data && data.authorizationCode) || "") + '" />' +
      '</div>' +
    '</div>';
  container.appendChild(block);
}

document.getElementById("btn-add-payment-execution").addEventListener("click", () => addPaymentExecution());
document.getElementById("payment-executions-container").addEventListener("click", (e) => {
  if (e.target.closest(".btn-remove-payment")) e.target.closest(".order-item-block").remove();
});

// --- Tax Registrations ---
function addTaxRegistration(data) {
  const container = document.getElementById("tax-registrations-container");
  const block = document.createElement("div");
  block.className = "order-item-block";
  block.innerHTML =
    '<div class="order-item-block-header">' +
      '<span class="order-item-block-title">Tax Registration</span>' +
      '<button type="button" class="btn-remove-item btn-remove-tax-reg">Remove</button>' +
    '</div>' +
    '<div class="order-form-row">' +
      '<div class="order-form-field">' +
        '<label>Entity Type</label>' +
        '<select class="taxreg-entityType">' +
          '<option value="">-- Select --</option>' +
          '<option value="BUYER"' + (data && data.entityType === "BUYER" ? " selected" : "") + '>BUYER</option>' +
          '<option value="MERCHANT"' + (data && data.entityType === "MERCHANT" ? " selected" : "") + '>MERCHANT</option>' +
          '<option value="MARKETPLACE"' + (data && data.entityType === "MARKETPLACE" ? " selected" : "") + '>MARKETPLACE</option>' +
        '</select>' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Legal Name</label>' +
        '<input type="text" class="taxreg-legalName" placeholder="Legal name" value="' + escapeAttr((data && data.legalName) || "") + '" />' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Registration Type</label>' +
        '<select class="taxreg-type">' +
          '<option value="">-- Select --</option>' +
          '<option value="BUSINESS"' + (data && data.taxRegistrationType === "BUSINESS" ? " selected" : "") + '>BUSINESS</option>' +
          '<option value="VAT"' + (data && data.taxRegistrationType === "VAT" ? " selected" : "") + '>VAT</option>' +
          '<option value="CST"' + (data && data.taxRegistrationType === "CST" ? " selected" : "") + '>CST</option>' +
          '<option value="CPF"' + (data && data.taxRegistrationType === "CPF" ? " selected" : "") + '>CPF</option>' +
          '<option value="CNPJ"' + (data && data.taxRegistrationType === "CNPJ" ? " selected" : "") + '>CNPJ</option>' +
        '</select>' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Registration Number</label>' +
        '<input type="text" class="taxreg-number" placeholder="Tax registration number" value="' + escapeAttr((data && data.taxRegistrationNumber) || "") + '" />' +
      '</div>' +
    '</div>';
  container.appendChild(block);
}

document.getElementById("btn-add-tax-registration").addEventListener("click", () => addTaxRegistration());
document.getElementById("tax-registrations-container").addEventListener("click", (e) => {
  if (e.target.closest(".btn-remove-tax-reg")) e.target.closest(".order-item-block").remove();
});

// ===== Order Items Management =====
let orderItemCount = 0;

function addOrderItem(data) {
  const currentItems = orderItemsContainer.querySelectorAll(".order-item-block");
  if (currentItems.length >= 50) return;

  orderItemCount++;
  const idx = orderItemCount;
  const block = document.createElement("div");
  block.className = "order-item-block";
  block.setAttribute("data-item-idx", idx);

  const product = (data && data.product) || {};
  const condition = product.condition || {};
  const price = product.price || {};
  const unitPrice = price.unitPrice || {};
  const itemFulfillment = (data && data.fulfillment) || {};
  const cancellation = (data && data.cancellation && data.cancellation.cancellationRequest) || {};
  const itemProceeds = (data && data.proceeds) || {};
  const proceedsTotal = itemProceeds.proceedsTotal || {};
  const itemPrograms = (data && data.programs) || [];

  block.innerHTML =
    '<div class="order-item-block-header">' +
      '<span class="order-item-block-title">Item #' + (currentItems.length + 1) + '</span>' +
      '<button type="button" class="btn-remove-item" data-item-idx="' + idx + '">Remove</button>' +
    '</div>' +
    '<div class="order-form-row">' +
      '<div class="order-form-field">' +
        '<label>Order Item ID *</label>' +
        '<input type="text" class="item-orderItemId" placeholder="123-1234567-1234567" value="' + escapeAttr((data && data.orderItemId) || "") + '" />' +
        '<span class="field-error item-error-orderItemId"></span>' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Quantity Ordered *</label>' +
        '<input type="number" class="item-quantityOrdered" min="1" step="1" placeholder="1" value="' + escapeAttr((data && data.quantityOrdered != null) ? String(data.quantityOrdered) : "") + '" />' +
        '<span class="field-error item-error-quantityOrdered"></span>' +
      '</div>' +
    '</div>' +
    '<div class="order-form-row">' +
      '<div class="order-form-field">' +
        '<label>ASIN *</label>' +
        '<input type="text" class="item-asin" placeholder="e.g. B0EXAMPLE01" value="' + escapeAttr(product.asin || "") + '" />' +
        '<span class="field-error item-error-asin"></span>' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Title</label>' +
        '<input type="text" class="item-title" placeholder="Product title" value="' + escapeAttr(product.title || "") + '" />' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Seller SKU</label>' +
        '<input type="text" class="item-sellerSku" placeholder="Seller SKU" value="' + escapeAttr(product.sellerSku || "") + '" />' +
      '</div>' +
    '</div>' +
    '<div class="order-form-row">' +
      '<div class="order-form-field">' +
        '<label>Condition Type</label>' +
        '<select class="item-conditionType">' +
          '<option value="">-- Select --</option>' +
          '<option value="NEW"' + (condition.conditionType === "NEW" ? " selected" : "") + '>NEW</option>' +
          '<option value="USED"' + (condition.conditionType === "USED" ? " selected" : "") + '>USED</option>' +
          '<option value="COLLECTIBLE"' + (condition.conditionType === "COLLECTIBLE" ? " selected" : "") + '>COLLECTIBLE</option>' +
          '<option value="REFURBISHED"' + (condition.conditionType === "REFURBISHED" ? " selected" : "") + '>REFURBISHED</option>' +
          '<option value="PREORDER"' + (condition.conditionType === "PREORDER" ? " selected" : "") + '>PREORDER</option>' +
          '<option value="CLUB"' + (condition.conditionType === "CLUB" ? " selected" : "") + '>CLUB</option>' +
        '</select>' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Condition Subtype</label>' +
        '<select class="item-conditionSubtype">' +
          '<option value="">-- Select --</option>' +
          '<option value="NEW"' + (condition.conditionSubtype === "NEW" ? " selected" : "") + '>NEW</option>' +
          '<option value="MINT"' + (condition.conditionSubtype === "MINT" ? " selected" : "") + '>MINT</option>' +
          '<option value="VERY_GOOD"' + (condition.conditionSubtype === "VERY_GOOD" ? " selected" : "") + '>VERY_GOOD</option>' +
          '<option value="GOOD"' + (condition.conditionSubtype === "GOOD" ? " selected" : "") + '>GOOD</option>' +
          '<option value="ACCEPTABLE"' + (condition.conditionSubtype === "ACCEPTABLE" ? " selected" : "") + '>ACCEPTABLE</option>' +
          '<option value="POOR"' + (condition.conditionSubtype === "POOR" ? " selected" : "") + '>POOR</option>' +
          '<option value="REFURBISHED"' + (condition.conditionSubtype === "REFURBISHED" ? " selected" : "") + '>REFURBISHED</option>' +
          '<option value="OTHER"' + (condition.conditionSubtype === "OTHER" ? " selected" : "") + '>OTHER</option>' +
        '</select>' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Condition Note</label>' +
        '<input type="text" class="item-conditionNote" placeholder="Condition description" value="' + escapeAttr(condition.conditionNote || "") + '" />' +
      '</div>' +
    '</div>' +
    '<div class="order-form-row">' +
      '<div class="order-form-field">' +
        '<label>Unit Price Amount</label>' +
        '<input type="text" class="item-unitPriceAmount" placeholder="e.g. 19.99" value="' + escapeAttr(unitPrice.amount || "") + '" />' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Unit Price Currency</label>' +
        '<input type="text" class="item-unitPriceCurrency" placeholder="e.g. USD" value="' + escapeAttr(unitPrice.currencyCode || "") + '" />' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Price Designation</label>' +
        '<input type="text" class="item-priceDesignation" placeholder="e.g. BUSINESS_PRICE" value="' + escapeAttr(price.priceDesignation || "") + '" />' +
      '</div>' +
    '</div>' +
    '<div class="order-form-row">' +
      '<div class="order-form-field">' +
        '<label>Qty Fulfilled</label>' +
        '<input type="number" class="item-quantityFulfilled" min="0" step="1" placeholder="0" value="' + escapeAttr(itemFulfillment.quantityFulfilled != null ? String(itemFulfillment.quantityFulfilled) : "") + '" />' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Qty Unfulfilled</label>' +
        '<input type="number" class="item-quantityUnfulfilled" min="0" step="1" placeholder="0" value="' + escapeAttr(itemFulfillment.quantityUnfulfilled != null ? String(itemFulfillment.quantityUnfulfilled) : "") + '" />' +
      '</div>' +
    '</div>' +
    '<div class="order-form-row">' +
      '<div class="order-form-field">' +
        '<label>Proceeds Total Amount</label>' +
        '<input type="text" class="item-proceedsTotalAmount" placeholder="e.g. 19.99" value="' + escapeAttr(proceedsTotal.amount || "") + '" />' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Proceeds Total Currency</label>' +
        '<input type="text" class="item-proceedsTotalCurrency" placeholder="e.g. USD" value="' + escapeAttr(proceedsTotal.currencyCode || "") + '" />' +
      '</div>' +
    '</div>' +
    '<div class="order-form-row">' +
      '<div class="order-form-field">' +
        '<label>Cancellation Requester</label>' +
        '<input type="text" class="item-cancelRequester" placeholder="e.g. BUYER" value="' + escapeAttr(cancellation.requester || "") + '" />' +
      '</div>' +
      '<div class="order-form-field">' +
        '<label>Cancel Reason</label>' +
        '<input type="text" class="item-cancelReason" placeholder="Cancellation reason" value="' + escapeAttr(cancellation.cancelReason || "") + '" />' +
      '</div>' +
    '</div>' +
    '<div class="order-form-row">' +
      '<div class="order-form-field">' +
        '<label>Item Programs (comma-separated)</label>' +
        '<input type="text" class="item-programs" placeholder="e.g. TRANSPARENCY, SUBSCRIBE_AND_SAVE" value="' + escapeAttr(itemPrograms.join(", ")) + '" />' +
      '</div>' +
    '</div>';

  orderItemsContainer.appendChild(block);
  updateItemNumbers();
  updateAddRemoveButtons();
}

function removeOrderItem(idx) {
  const block = orderItemsContainer.querySelector('.order-item-block[data-item-idx="' + idx + '"]');
  if (block) {
    block.remove();
    updateItemNumbers();
    updateAddRemoveButtons();
  }
}

function updateItemNumbers() {
  const blocks = orderItemsContainer.querySelectorAll(".order-item-block");
  blocks.forEach((block, i) => {
    block.querySelector(".order-item-block-title").textContent = "Item #" + (i + 1);
  });
}

function updateAddRemoveButtons() {
  const blocks = orderItemsContainer.querySelectorAll(".order-item-block");
  const count = blocks.length;
  btnAddItem.disabled = count >= 50;
  blocks.forEach((block) => {
    const removeBtn = block.querySelector(".btn-remove-item");
    removeBtn.disabled = count <= 1;
  });
}

btnAddItem.addEventListener("click", () => {
  addOrderItem();
});

orderItemsContainer.addEventListener("click", (e) => {
  const removeBtn = e.target.closest(".btn-remove-item");
  if (removeBtn) {
    const idx = removeBtn.getAttribute("data-item-idx");
    removeOrderItem(idx);
  }
});

// ===== Programs Management =====
programInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const val = programInput.value.trim();
    if (val && !programsList.includes(val)) {
      programsList.push(val);
      renderProgramsTags();
    }
    programInput.value = "";
  }
});

function renderProgramsTags() {
  programsTagsEl.innerHTML = "";
  programsList.forEach((prog, idx) => {
    const tag = document.createElement("span");
    tag.className = "program-tag";
    tag.innerHTML = escapeHtml(prog) + ' <button type="button" data-prog-idx="' + idx + '">&times;</button>';
    programsTagsEl.appendChild(tag);
  });
}

programsTagsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-prog-idx]");
  if (btn) {
    const idx = parseInt(btn.getAttribute("data-prog-idx"), 10);
    programsList.splice(idx, 1);
    renderProgramsTags();
  }
});

// New Order button
btnNewOrder.addEventListener("click", () => {
  switchToCreateMode();
});

// Select order from list (edit mode)
function selectOrder(order) {
  document.querySelectorAll(".order-row").forEach((r) => r.classList.remove("active"));
  const row = document.querySelector('.order-row[data-order-id="' + CSS.escape(order.orderId) + '"]');
  if (row) row.classList.add("active");
  switchToEditMode(order);
}

// Delegate click on order rows to selectOrder
ordersListContent.addEventListener("click", (e) => {
  if (e.target.closest(".order-row-delete")) return;
  const row = e.target.closest(".order-row");
  if (row) {
    const orderId = row.getAttribute("data-order-id");
    const order = ordersCache.find((o) => o.orderId === orderId);
    if (order) selectOrder(order);
  }
});

// ===== Validation Helpers =====
function clearValidationErrors() {
  document.querySelectorAll("#order-editor-form .invalid").forEach((el) => el.classList.remove("invalid"));
  document.querySelectorAll("#order-editor-form .field-error").forEach((el) => {
    el.textContent = "";
    el.style.display = "none";
  });
}

function showFieldError(input, errorEl, message) {
  input.classList.add("invalid");
  errorEl.textContent = message;
  errorEl.style.display = "block";
}

function hideFormError() {
  formErrorMessage.textContent = "";
  formErrorMessage.style.display = "none";
}

function showFormError(message) {
  formErrorMessage.textContent = message;
  formErrorMessage.style.display = "inline";
}

// ===== Validation Functions =====
function validateOrderId(value) {
  return /^\d{3}-\d{7}-\d{7}$/.test(value);
}

function validateISODate(value) {
  if (!value) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

function validateQuantity(value) {
  const num = Number(value);
  return Number.isInteger(num) && num >= 1;
}

// Full form validation - returns true if valid, false otherwise
function validateOrderForm() {
  clearValidationErrors();
  hideFormError();
  let isValid = true;

  // Validate orderId
  const orderIdInput = document.getElementById("field-orderId");
  const orderIdError = document.getElementById("error-orderId");
  const orderIdVal = orderIdInput.value.trim();
  if (!orderIdVal) {
    showFieldError(orderIdInput, orderIdError, "Order ID is required");
    isValid = false;
  } else if (!validateOrderId(orderIdVal)) {
    showFieldError(orderIdInput, orderIdError, "Order ID must match format: 123-1234567-1234567");
    isValid = false;
  }

  // Validate createdTime
  const createdTimeInput = document.getElementById("field-createdTime");
  const createdTimeError = document.getElementById("error-createdTime");
  const createdTimeVal = createdTimeInput.value.trim();
  if (!createdTimeVal) {
    showFieldError(createdTimeInput, createdTimeError, "Created Time is required");
    isValid = false;
  } else if (!validateISODate(createdTimeVal)) {
    showFieldError(createdTimeInput, createdTimeError, "Created Time must be a valid ISO 8601 date-time");
    isValid = false;
  }

  // Validate lastUpdatedTime
  const lastUpdatedTimeInput = document.getElementById("field-lastUpdatedTime");
  const lastUpdatedTimeError = document.getElementById("error-lastUpdatedTime");
  const lastUpdatedTimeVal = lastUpdatedTimeInput.value.trim();
  if (!lastUpdatedTimeVal) {
    showFieldError(lastUpdatedTimeInput, lastUpdatedTimeError, "Last Updated Time is required");
    isValid = false;
  } else if (!validateISODate(lastUpdatedTimeVal)) {
    showFieldError(lastUpdatedTimeInput, lastUpdatedTimeError, "Last Updated Time must be a valid ISO 8601 date-time");
    isValid = false;
  }

  // Validate salesChannel.channelName
  const channelNameInput = document.getElementById("field-channelName");
  const channelNameError = document.getElementById("error-channelName");
  if (!channelNameInput.value) {
    showFieldError(channelNameInput, channelNameError, "Channel Name is required");
    isValid = false;
  }

  // Validate order items
  const blocks = orderItemsContainer.querySelectorAll(".order-item-block");
  if (blocks.length === 0) {
    const orderItemsError = document.getElementById("error-orderItems");
    orderItemsError.textContent = "At least one order item is required";
    orderItemsError.style.display = "block";
    isValid = false;
  }

  blocks.forEach((block) => {
    const itemIdInput = block.querySelector(".item-orderItemId");
    const itemIdError = block.querySelector(".item-error-orderItemId");
    const itemIdVal = itemIdInput.value.trim();
    if (!itemIdVal) {
      showFieldError(itemIdInput, itemIdError, "Order Item ID is required");
      isValid = false;
    }

    const qtyInput = block.querySelector(".item-quantityOrdered");
    const qtyError = block.querySelector(".item-error-quantityOrdered");
    const qtyVal = qtyInput.value.trim();
    if (!qtyVal) {
      showFieldError(qtyInput, qtyError, "Quantity is required");
      isValid = false;
    } else if (!validateQuantity(qtyVal)) {
      showFieldError(qtyInput, qtyError, "Quantity must be an integer >= 1");
      isValid = false;
    }

    const asinInput = block.querySelector(".item-asin");
    const asinError = block.querySelector(".item-error-asin");
    const asinVal = asinInput.value.trim();
    if (!asinVal) {
      showFieldError(asinInput, asinError, "Product ASIN is required");
      isValid = false;
    }
  });

  return isValid;
}

// ===== Prefill Logic =====
function generateOrderId() {
  const digits = (n) => {
    let s = "";
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
    return s;
  };
  return digits(3) + "-" + digits(7) + "-" + digits(7);
}

function generateAsin() {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "B";
  for (let i = 0; i < 9; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateUniqueOrderId(existingIds) {
  let id = generateOrderId();
  let attempts = 0;
  while (existingIds.includes(id) && attempts < 1000) {
    id = generateOrderId();
    attempts++;
  }
  return id;
}

function prefillOrder() {
  if (editorMode !== "create") return;

  const existingIds = ordersCache.map((o) => o.orderId);
  const orderId = generateUniqueOrderId(existingIds);
  const now = new Date().toISOString();
  const shipByDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const deliverByDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

  document.getElementById("field-orderId").value = orderId;
  document.getElementById("field-createdTime").value = now;
  document.getElementById("field-lastUpdatedTime").value = now;
  document.getElementById("field-channelName").value = "AMAZON";
  document.getElementById("field-marketplaceId").value = "ATVPDKIKX0DER";
  document.getElementById("field-marketplaceName").value = "Amazon.com";
  document.getElementById("field-fulfillmentStatus").value = "UNSHIPPED";
  document.getElementById("field-fulfilledBy").value = "MERCHANT";
  document.getElementById("field-fulfillmentServiceLevel").value = "STANDARD";
  document.getElementById("field-shipByEarliest").value = now;
  document.getElementById("field-shipByLatest").value = shipByDate;
  document.getElementById("field-deliverByEarliest").value = shipByDate;
  document.getElementById("field-deliverByLatest").value = deliverByDate;
  document.getElementById("field-buyerName").value = "Test Buyer";
  document.getElementById("field-buyerEmail").value = "testbuyer@marketplace.amazon.com";
  document.getElementById("field-recipientName").value = "Test Buyer";
  document.getElementById("field-addressLine1").value = "123 Main Street";
  document.getElementById("field-city").value = "Seattle";
  document.getElementById("field-stateOrRegion").value = "WA";
  document.getElementById("field-postalCode").value = "98101";
  document.getElementById("field-countryCode").value = "US";
  document.getElementById("field-addressType").value = "RESIDENTIAL";
  document.getElementById("field-grandTotalAmount").value = "29.99";
  document.getElementById("field-grandTotalCurrency").value = "USD";

  orderItemsContainer.innerHTML = "";
  const orderItemId = generateOrderId();
  const asin = generateAsin();
  const sellerSku = "SKU-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  addOrderItem({
    orderItemId: orderItemId,
    quantityOrdered: 1,
    product: {
      asin: asin,
      sellerSku: sellerSku,
      title: "Sample Product",
      condition: { conditionType: "NEW", conditionSubtype: "NEW" },
      price: { unitPrice: { amount: "29.99", currencyCode: "USD" } },
    },
    proceeds: { proceedsTotal: { amount: "29.99", currencyCode: "USD" } },
    fulfillment: { quantityFulfilled: 0, quantityUnfulfilled: 1 },
  });

  clearValidationErrors();
  hideFormError();
}

btnPrefill.addEventListener("click", () => {
  prefillOrder();
});

// ===== Collect Form Data =====
function collectFormData() {
  const order = {};
  order.orderId = document.getElementById("field-orderId").value.trim();
  order.createdTime = document.getElementById("field-createdTime").value.trim();
  order.lastUpdatedTime = document.getElementById("field-lastUpdatedTime").value.trim();

  // Sales Channel
  const channelName = document.getElementById("field-channelName").value;
  const marketplaceId = document.getElementById("field-marketplaceId").value.trim();
  const marketplaceName = document.getElementById("field-marketplaceName").value.trim();
  order.salesChannel = { channelName };
  if (marketplaceId) order.salesChannel.marketplaceId = marketplaceId;
  if (marketplaceName) order.salesChannel.marketplaceName = marketplaceName;

  // Order Aliases
  const aliasBlocks = document.getElementById("order-aliases-container").querySelectorAll(".order-item-block");
  if (aliasBlocks.length > 0) {
    order.orderAliases = [];
    aliasBlocks.forEach((block) => {
      const aliasType = block.querySelector(".alias-type").value.trim();
      const aliasId = block.querySelector(".alias-id").value.trim();
      if (aliasType || aliasId) {
        order.orderAliases.push({ aliasType, aliasId });
      }
    });
    if (order.orderAliases.length === 0) delete order.orderAliases;
  }

  // Associated Orders
  const assocBlocks = document.getElementById("associated-orders-container").querySelectorAll(".order-item-block");
  if (assocBlocks.length > 0) {
    order.associatedOrders = [];
    assocBlocks.forEach((block) => {
      const assocOrderId = block.querySelector(".assoc-orderId").value.trim();
      const associationType = block.querySelector(".assoc-type").value;
      if (assocOrderId || associationType) {
        const ao = {};
        if (assocOrderId) ao.orderId = assocOrderId;
        if (associationType) ao.associationType = associationType;
        order.associatedOrders.push(ao);
      }
    });
    if (order.associatedOrders.length === 0) delete order.associatedOrders;
  }

  // Order items
  order.orderItems = [];
  const blocks = orderItemsContainer.querySelectorAll(".order-item-block");
  blocks.forEach((block) => {
    const item = {
      orderItemId: block.querySelector(".item-orderItemId").value.trim(),
      quantityOrdered: parseInt(block.querySelector(".item-quantityOrdered").value, 10) || 0,
      product: {
        asin: block.querySelector(".item-asin").value.trim(),
      },
    };

    const title = block.querySelector(".item-title").value.trim();
    const sellerSku = block.querySelector(".item-sellerSku").value.trim();
    if (title) item.product.title = title;
    if (sellerSku) item.product.sellerSku = sellerSku;

    const conditionType = block.querySelector(".item-conditionType").value;
    const conditionSubtype = block.querySelector(".item-conditionSubtype").value;
    const conditionNote = block.querySelector(".item-conditionNote").value.trim();
    if (conditionType || conditionSubtype || conditionNote) {
      item.product.condition = {};
      if (conditionType) item.product.condition.conditionType = conditionType;
      if (conditionSubtype) item.product.condition.conditionSubtype = conditionSubtype;
      if (conditionNote) item.product.condition.conditionNote = conditionNote;
    }

    const unitPriceAmount = block.querySelector(".item-unitPriceAmount").value.trim();
    const unitPriceCurrency = block.querySelector(".item-unitPriceCurrency").value.trim();
    const priceDesignation = block.querySelector(".item-priceDesignation").value.trim();
    if (unitPriceAmount || unitPriceCurrency || priceDesignation) {
      item.product.price = {};
      if (unitPriceAmount || unitPriceCurrency) {
        item.product.price.unitPrice = {};
        if (unitPriceAmount) item.product.price.unitPrice.amount = unitPriceAmount;
        if (unitPriceCurrency) item.product.price.unitPrice.currencyCode = unitPriceCurrency;
      }
      if (priceDesignation) item.product.price.priceDesignation = priceDesignation;
    }

    const qtyFulfilled = block.querySelector(".item-quantityFulfilled").value.trim();
    const qtyUnfulfilled = block.querySelector(".item-quantityUnfulfilled").value.trim();
    if (qtyFulfilled || qtyUnfulfilled) {
      item.fulfillment = {};
      if (qtyFulfilled) item.fulfillment.quantityFulfilled = parseInt(qtyFulfilled, 10);
      if (qtyUnfulfilled) item.fulfillment.quantityUnfulfilled = parseInt(qtyUnfulfilled, 10);
    }

    const proceedsTotalAmount = block.querySelector(".item-proceedsTotalAmount").value.trim();
    const proceedsTotalCurrency = block.querySelector(".item-proceedsTotalCurrency").value.trim();
    if (proceedsTotalAmount || proceedsTotalCurrency) {
      item.proceeds = { proceedsTotal: {} };
      if (proceedsTotalAmount) item.proceeds.proceedsTotal.amount = proceedsTotalAmount;
      if (proceedsTotalCurrency) item.proceeds.proceedsTotal.currencyCode = proceedsTotalCurrency;
    }

    const cancelRequester = block.querySelector(".item-cancelRequester").value.trim();
    const cancelReason = block.querySelector(".item-cancelReason").value.trim();
    if (cancelRequester || cancelReason) {
      item.cancellation = { cancellationRequest: {} };
      if (cancelRequester) item.cancellation.cancellationRequest.requester = cancelRequester;
      if (cancelReason) item.cancellation.cancellationRequest.cancelReason = cancelReason;
    }

    const itemProgramsVal = block.querySelector(".item-programs").value.trim();
    if (itemProgramsVal) {
      item.programs = itemProgramsVal.split(",").map((s) => s.trim()).filter(Boolean);
    }

    order.orderItems.push(item);
  });

  // Fulfillment
  const fulfillmentStatus = document.getElementById("field-fulfillmentStatus").value;
  const fulfilledBy = document.getElementById("field-fulfilledBy").value;
  const fulfillmentServiceLevel = document.getElementById("field-fulfillmentServiceLevel").value;
  const shipByEarliest = document.getElementById("field-shipByEarliest").value.trim();
  const shipByLatest = document.getElementById("field-shipByLatest").value.trim();
  const deliverByEarliest = document.getElementById("field-deliverByEarliest").value.trim();
  const deliverByLatest = document.getElementById("field-deliverByLatest").value.trim();
  if (fulfillmentStatus || fulfilledBy || fulfillmentServiceLevel || shipByEarliest || shipByLatest || deliverByEarliest || deliverByLatest) {
    order.fulfillment = {};
    if (fulfillmentStatus) order.fulfillment.fulfillmentStatus = fulfillmentStatus;
    if (fulfilledBy) order.fulfillment.fulfilledBy = fulfilledBy;
    if (fulfillmentServiceLevel) order.fulfillment.fulfillmentServiceLevel = fulfillmentServiceLevel;
    if (shipByEarliest || shipByLatest) {
      order.fulfillment.shipByWindow = {};
      if (shipByEarliest) order.fulfillment.shipByWindow.earliestDateTime = shipByEarliest;
      if (shipByLatest) order.fulfillment.shipByWindow.latestDateTime = shipByLatest;
    }
    if (deliverByEarliest || deliverByLatest) {
      order.fulfillment.deliverByWindow = {};
      if (deliverByEarliest) order.fulfillment.deliverByWindow.earliestDateTime = deliverByEarliest;
      if (deliverByLatest) order.fulfillment.deliverByWindow.latestDateTime = deliverByLatest;
    }
  }

  // Buyer
  const buyerName = document.getElementById("field-buyerName").value.trim();
  const buyerEmail = document.getElementById("field-buyerEmail").value.trim();
  const buyerCompanyName = document.getElementById("field-buyerCompanyName").value.trim();
  const buyerPurchaseOrderNumber = document.getElementById("field-buyerPurchaseOrderNumber").value.trim();
  if (buyerName || buyerEmail || buyerCompanyName || buyerPurchaseOrderNumber) {
    order.buyer = {};
    if (buyerName) order.buyer.buyerName = buyerName;
    if (buyerEmail) order.buyer.buyerEmail = buyerEmail;
    if (buyerCompanyName) order.buyer.buyerCompanyName = buyerCompanyName;
    if (buyerPurchaseOrderNumber) order.buyer.buyerPurchaseOrderNumber = buyerPurchaseOrderNumber;
  }

  // Recipient
  const recipientName = document.getElementById("field-recipientName").value.trim();
  const recipientCompanyName = document.getElementById("field-recipientCompanyName").value.trim();
  const addressLine1 = document.getElementById("field-addressLine1").value.trim();
  const addressLine2 = document.getElementById("field-addressLine2").value.trim();
  const addressLine3 = document.getElementById("field-addressLine3").value.trim();
  const city = document.getElementById("field-city").value.trim();
  const districtOrCounty = document.getElementById("field-districtOrCounty").value.trim();
  const stateOrRegion = document.getElementById("field-stateOrRegion").value.trim();
  const municipality = document.getElementById("field-municipality").value.trim();
  const postalCode = document.getElementById("field-postalCode").value.trim();
  const countryCode = document.getElementById("field-countryCode").value.trim();
  const phone = document.getElementById("field-phone").value.trim();
  const addressType = document.getElementById("field-addressType").value;
  const dropOffLocation = document.getElementById("field-dropOffLocation").value.trim();
  const addressInstruction = document.getElementById("field-addressInstruction").value.trim();

  const hasAddress = recipientName || recipientCompanyName || addressLine1 || addressLine2 || addressLine3 || city || districtOrCounty || stateOrRegion || municipality || postalCode || countryCode || phone || addressType;
  const hasDeliveryPref = dropOffLocation || addressInstruction;

  if (hasAddress || hasDeliveryPref) {
    order.recipient = {};
    if (hasAddress) {
      order.recipient.deliveryAddress = {};
      if (recipientName) order.recipient.deliveryAddress.name = recipientName;
      if (recipientCompanyName) order.recipient.deliveryAddress.companyName = recipientCompanyName;
      if (addressLine1) order.recipient.deliveryAddress.addressLine1 = addressLine1;
      if (addressLine2) order.recipient.deliveryAddress.addressLine2 = addressLine2;
      if (addressLine3) order.recipient.deliveryAddress.addressLine3 = addressLine3;
      if (city) order.recipient.deliveryAddress.city = city;
      if (districtOrCounty) order.recipient.deliveryAddress.districtOrCounty = districtOrCounty;
      if (stateOrRegion) order.recipient.deliveryAddress.stateOrRegion = stateOrRegion;
      if (municipality) order.recipient.deliveryAddress.municipality = municipality;
      if (postalCode) order.recipient.deliveryAddress.postalCode = postalCode;
      if (countryCode) order.recipient.deliveryAddress.countryCode = countryCode;
      if (phone) order.recipient.deliveryAddress.phone = phone;
      if (addressType) order.recipient.deliveryAddress.addressType = addressType;
    }
    if (hasDeliveryPref) {
      order.recipient.deliveryPreference = {};
      if (dropOffLocation) order.recipient.deliveryPreference.dropOffLocation = dropOffLocation;
      if (addressInstruction) order.recipient.deliveryPreference.addressInstruction = addressInstruction;
    }
  }

  // Programs
  if (programsList.length > 0) {
    order.programs = [...programsList];
  }

  // Proceeds
  const grandTotalAmount = document.getElementById("field-grandTotalAmount").value.trim();
  const grandTotalCurrency = document.getElementById("field-grandTotalCurrency").value.trim();
  const breakdownBlocks = document.getElementById("proceeds-breakdowns-container").querySelectorAll(".order-item-block");
  if (grandTotalAmount || grandTotalCurrency || breakdownBlocks.length > 0) {
    order.proceeds = {};
    if (grandTotalAmount || grandTotalCurrency) {
      order.proceeds.grandTotal = {};
      if (grandTotalAmount) order.proceeds.grandTotal.amount = grandTotalAmount;
      if (grandTotalCurrency) order.proceeds.grandTotal.currencyCode = grandTotalCurrency;
    }
    if (breakdownBlocks.length > 0) {
      order.proceeds.breakdowns = [];
      breakdownBlocks.forEach((block) => {
        const bType = block.querySelector(".breakdown-type").value;
        const bAmount = block.querySelector(".breakdown-amount").value.trim();
        const bCurrency = block.querySelector(".breakdown-currency").value.trim();
        const bStatus = block.querySelector(".breakdown-status").value.trim();
        if (bType || bAmount || bCurrency) {
          const breakdown = {};
          if (bType) breakdown.type = bType;
          if (bAmount || bCurrency) {
            breakdown.subtotal = {};
            if (bAmount) breakdown.subtotal.amount = bAmount;
            if (bCurrency) breakdown.subtotal.currencyCode = bCurrency;
          }
          if (bStatus) breakdown.status = bStatus;
          order.proceeds.breakdowns.push(breakdown);
        }
      });
      if (order.proceeds.breakdowns.length === 0) delete order.proceeds.breakdowns;
    }
  }

  // Payment
  const paymentBlocks = document.getElementById("payment-executions-container").querySelectorAll(".order-item-block");
  if (paymentBlocks.length > 0) {
    const executions = [];
    paymentBlocks.forEach((block) => {
      const method = block.querySelector(".payment-method").value.trim();
      const amount = block.querySelector(".payment-amount").value.trim();
      const currency = block.querySelector(".payment-currency").value.trim();
      const acquirerId = block.querySelector(".payment-acquirerId").value.trim();
      const cardBrand = block.querySelector(".payment-cardBrand").value.trim();
      const authCode = block.querySelector(".payment-authCode").value.trim();
      if (method || amount || currency) {
        const pe = {};
        if (method) pe.paymentMethod = method;
        if (amount || currency) {
          pe.paymentAmount = {};
          if (amount) pe.paymentAmount.amount = amount;
          if (currency) pe.paymentAmount.currencyCode = currency;
        }
        if (acquirerId) pe.acquirerId = acquirerId;
        if (cardBrand) pe.cardBrand = cardBrand;
        if (authCode) pe.authorizationCode = authCode;
        executions.push(pe);
      }
    });
    if (executions.length > 0) {
      order.payment = { paymentExecutions: executions };
    }
  }

  // Tax
  const buyerInvoicePreference = document.getElementById("field-buyerInvoicePreference").value;
  const invoiceStatus = document.getElementById("field-invoiceStatus").value;
  const taxRegBlocks = document.getElementById("tax-registrations-container").querySelectorAll(".order-item-block");
  if (buyerInvoicePreference || invoiceStatus || taxRegBlocks.length > 0) {
    order.tax = {};
    if (buyerInvoicePreference || invoiceStatus) {
      order.tax.taxInvoicing = {};
      if (buyerInvoicePreference) order.tax.taxInvoicing.buyerInvoicePreference = buyerInvoicePreference;
      if (invoiceStatus) order.tax.taxInvoicing.invoiceStatus = invoiceStatus;
    }
    if (taxRegBlocks.length > 0) {
      order.tax.taxRegistrations = [];
      taxRegBlocks.forEach((block) => {
        const entityType = block.querySelector(".taxreg-entityType").value;
        const legalName = block.querySelector(".taxreg-legalName").value.trim();
        const regType = block.querySelector(".taxreg-type").value;
        const regNumber = block.querySelector(".taxreg-number").value.trim();
        if (entityType || legalName || regType || regNumber) {
          const tr = {};
          if (entityType) tr.entityType = entityType;
          if (legalName) tr.legalName = legalName;
          if (regType) tr.taxRegistrationType = regType;
          if (regNumber) tr.taxRegistrationNumber = regNumber;
          order.tax.taxRegistrations.push(tr);
        }
      });
      if (order.tax.taxRegistrations.length === 0) delete order.tax.taxRegistrations;
    }
  }

  return order;
}

// ===== Form Submit Handler =====
document.getElementById("order-editor-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideFormError();

  if (!validateOrderForm()) {
    return;
  }

  const orderData = collectFormData();
  btnSubmitOrder.disabled = true;

  try {
    if (editorMode === "create") {
      const res = await fetch("/manage/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });
      if (res.ok) {
        await fetchOrders();
        switchToCreateMode();
      } else {
        const data = await res.json().catch(() => ({}));
        showFormError(data.error || "Failed to create order (HTTP " + res.status + ")");
      }
    } else {
      const res = await fetch("/manage/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });
      if (res.ok) {
        await fetchOrders();
        const updatedOrder = ordersCache.find((o) => o.orderId === editingOrderId);
        if (updatedOrder) switchToEditMode(updatedOrder);
      } else {
        const data = await res.json().catch(() => ({}));
        showFormError(data.error || "Failed to update order (HTTP " + res.status + ")");
      }
    }
  } catch (err) {
    showFormError("Network error. Please check your connection.");
  } finally {
    btnSubmitOrder.disabled = false;
  }
});

// ===== Guided Scenarios =====
const scenariosBody = document.getElementById("scenarios-body");

function chipLabel(status) {
  return status === "runnable" ? "Runnable" : status === "pass-through" ? "Pass-through" : "Planned";
}

function renderTrack(track) {
  const section = document.createElement("details");
  section.className = "scenario-steps";
  const summary = document.createElement("summary");
  summary.innerHTML = '<strong>' + escapeHtml(track.title) + '</strong> <span style="font-weight: 400; color: var(--color-text-body-secondary);">— ' + track.steps.length + ' steps (' + track.runnableCount + ' runnable)</span>';
  section.appendChild(summary);

  const desc = document.createElement("div");
  desc.style.cssText = "font-size: 12px; color: var(--color-text-body-secondary); padding: var(--space-xs) 0 var(--space-s) 0;";
  desc.textContent = track.description;
  section.appendChild(desc);

  track.steps.forEach(function (step, i) {
    const row = document.createElement("div");
    row.className = "scenario-step";

    const chip = document.createElement("span");
    chip.className = "step-chip " + step.status;
    chip.textContent = chipLabel(step.status);

    const main = document.createElement("div");
    main.className = "step-main";
    const stepTitle = document.createElement("div");
    stepTitle.className = "step-title";
    stepTitle.textContent = (i + 1) + ". " + step.title;
    const stepPath = document.createElement("div");
    stepPath.className = "step-path";
    stepPath.textContent = step.method + " " + step.path;
    const stepNote = document.createElement("div");
    stepNote.className = "step-note";
    stepNote.textContent = step.note;
    main.appendChild(stepTitle);
    main.appendChild(stepPath);
    main.appendChild(stepNote);

    // Try it button for runnable steps
    if (step.status === "runnable") {
      const tryBtn = document.createElement("button");
      tryBtn.className = "btn btn-normal btn-seed";
      tryBtn.textContent = "Try it";
      tryBtn.style.cssText = "margin-top: var(--space-s); font-size: 12px; padding: 4px 12px;";
      tryBtn.addEventListener("click", async function () {
        tryBtn.disabled = true;
        tryBtn.textContent = "Running...";
        // Remove previous inline result if any
        const prevResult = main.querySelector(".step-result");
        if (prevResult) prevResult.remove();

        try {
          const fetchOpts = { method: step.method, headers: { "Content-Type": "application/json" } };
          if (step.body && !["GET", "HEAD", "DELETE"].includes(step.method.toUpperCase())) {
            fetchOpts.body = JSON.stringify(step.body);
          }
          const res = await fetch(step.path, fetchOpts);
          const text = await res.text();
          let display;
          try {
            display = JSON.stringify(JSON.parse(text), null, 2);
          } catch (e) {
            display = text;
          }

          const resultBox = document.createElement("div");
          resultBox.className = "step-result";
          resultBox.style.cssText = "margin-top: var(--space-s); border-radius: var(--border-radius-input); padding: var(--space-s) var(--space-m); font-size: 12px; overflow-x: auto; max-height: 200px; overflow-y: auto;";
          if (res.ok) {
            resultBox.style.background = "var(--color-background-status-success)";
            resultBox.style.border = "1px solid var(--color-border-status-success)";
          } else {
            resultBox.style.background = "var(--color-background-status-error)";
            resultBox.style.border = "1px solid var(--color-border-status-error)";
          }
          const statusLine = document.createElement("div");
          statusLine.style.cssText = "font-weight: 700; margin-bottom: var(--space-xs); color: " + (res.ok ? "var(--color-text-status-success)" : "var(--color-text-status-error)") + ";";
          statusLine.textContent = "HTTP " + res.status;
          resultBox.appendChild(statusLine);
          const pre = document.createElement("pre");
          pre.style.cssText = "margin: 0; white-space: pre-wrap; word-break: break-word; font-family: monospace; font-size: 12px;";
          pre.textContent = display || "(empty response)";
          resultBox.appendChild(pre);
          main.appendChild(resultBox);
        } catch (err) {
          const resultBox = document.createElement("div");
          resultBox.className = "step-result";
          resultBox.style.cssText = "margin-top: var(--space-s); padding: var(--space-s) var(--space-m); background: var(--color-background-status-error); border: 1px solid var(--color-border-status-error); border-radius: var(--border-radius-input); font-size: 12px; color: var(--color-text-status-error);";
          resultBox.textContent = "Request failed: " + err.message;
          main.appendChild(resultBox);
        } finally {
          tryBtn.textContent = "Try it";
          tryBtn.disabled = false;
        }
      });
      main.appendChild(tryBtn);
    }

    row.appendChild(chip);
    row.appendChild(main);
    section.appendChild(row);
  });

  return section;
}

function renderScenarioCard(scenario) {
  const card = document.createElement("div");
  card.className = "scenario-card";

  const header = document.createElement("div");
  header.className = "scenario-card-header";

  const titleWrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "scenario-title";
  title.textContent = scenario.title;
  const tagline = document.createElement("div");
  tagline.className = "scenario-tagline";
  tagline.textContent = scenario.tagline;
  titleWrap.appendChild(title);
  titleWrap.appendChild(tagline);

  const actions = document.createElement("div");
  actions.className = "scenario-actions";
  const seedBtn = document.createElement("button");
  seedBtn.className = "btn btn-primary btn-seed";
  seedBtn.textContent = scenario.seedCount > 0 ? "Seed data" : "No seed data yet";
  seedBtn.disabled = scenario.seedCount === 0;
  seedBtn.addEventListener("click", async function () {
    seedBtn.disabled = true;
    const original = seedBtn.textContent;
    seedBtn.textContent = "Seeding...";
    try {
      const res = await fetch("/scenarios/" + scenario.id + "/seed", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showResult(data.message, false);
      } else {
        showError((data.errors && data.errors[0] && data.errors[0].message) || "Seeding failed", "SeedError", res.status);
      }
    } catch (err) {
      showError("Seeding failed: " + err.message, "NetworkError");
    } finally {
      seedBtn.textContent = original;
      seedBtn.disabled = false;
    }
  });
  actions.appendChild(seedBtn);

  header.appendChild(titleWrap);
  header.appendChild(actions);
  card.appendChild(header);

  // Track summary line
  const totalSteps = scenario.tracks.reduce(function (sum, t) {
    return sum + t.steps.length;
  }, 0);
  const totalRunnable = scenario.tracks.reduce(function (sum, t) {
    return sum + t.runnableCount;
  }, 0);
  const trackSummary = document.createElement("div");
  trackSummary.style.cssText = "font-size: 12px; color: var(--color-text-body-secondary); padding: var(--space-s) 0 var(--space-m) 0;";
  trackSummary.textContent = scenario.tracks.length + " tracks · " + totalSteps + " steps · " + totalRunnable + " runnable now";
  card.appendChild(trackSummary);

  // Render each track
  scenario.tracks.forEach(function (track) {
    card.appendChild(renderTrack(track));
  });

  return card;
}

async function loadScenarioCards() {
  try {
    const res = await fetch("/scenarios");
    const data = await res.json();
    if (!res.ok) {
      throw new Error((data.errors && data.errors[0] && data.errors[0].message) || "Server error (HTTP " + res.status + ")");
    }
    scenariosBody.textContent = "";
    const list = document.createElement("div");
    list.className = "scenario-list";
    data.scenarios.forEach(function (s) {
      list.appendChild(renderScenarioCard(s));
    });
    scenariosBody.appendChild(list);
  } catch (err) {
    scenariosBody.textContent = "Failed to load scenarios: " + err.message;
  }
}

loadScenarioCards();
