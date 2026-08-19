import React, { useMemo } from 'react';

export default function ProgressBar({ schema, events, currentStatus }) {
  // Extract Input state names (these are the user-facing steps)
  const inputStates = useMemo(() => {
    if (!schema?.States) return [];
    return Object.entries(schema.States)
      .filter(([, state]) => state.Type === 'Input')
      .map(([name]) => name);
  }, [schema]);

  // Find which Input states have been entered/exited
  const completedInputs = useMemo(() => {
    const inputSet = new Set(inputStates);
    const entered = new Set();
    const exited = new Set();
    let lastEnteredInput = null;
    for (const event of events) {
      if (event.type === 'StateEntered' && event.state_name) {
        entered.add(event.state_name);
        if (inputSet.has(event.state_name)) lastEnteredInput = event.state_name;
      }
      if (event.type === 'StateExited' && event.state_name) exited.add(event.state_name);
      // CallbackReceived may lack state_name — infer from last entered Input state
      if (event.type === 'CallbackReceived') {
        if (event.state_name) {
          exited.add(event.state_name);
        } else if (lastEnteredInput) {
          exited.add(lastEnteredInput);
        }
      }
    }
    return { entered, exited };
  }, [events, inputStates]);

  // Find the current Input state (entered but not exited)
  const currentInput = useMemo(() => {
    for (const name of [...inputStates].reverse()) {
      if (completedInputs.entered.has(name) && !completedInputs.exited.has(name)) {
        return name;
      }
    }
    return null;
  }, [inputStates, completedInputs]);

  if (inputStates.length === 0) return null;

  const completedCount = inputStates.filter(n => completedInputs.exited.has(n)).length;
  const isTerminal = currentStatus === 'SUCCEEDED' || currentStatus === 'FAILED';

  return (
    <div className="progress-bar">
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${isTerminal ? 100 : (completedCount / inputStates.length) * 100}%`
          }}
        />
      </div>
      <div className="progress-label">
        {isTerminal
          ? currentStatus === 'SUCCEEDED' ? 'Complete' : 'Failed'
          : currentInput
            ? `Step: ${currentInput}`
            : `${completedCount}/${inputStates.length} input steps`
        }
      </div>
    </div>
  );
}
