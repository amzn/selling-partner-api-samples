import React from 'react';

const EVENT_LABELS = {
  ExecutionStarted: 'Started',
  ExecutionSucceeded: 'Succeeded',
  ExecutionFailed: 'Failed',
  ExecutionAborted: 'Aborted',
  StateEntered: 'State Entered',
  StateExited: 'State Exited',
  StateFailed: 'State Failed',
  TaskScheduled: 'Task Scheduled',
  TaskSucceeded: 'Task Completed',
  TaskFailed: 'Task Failed',
  CallbackRequested: 'Input Requested',
  CallbackReceived: 'Input Received',
};

export default function EventTimeline({ events }) {
  return (
    <div className="timeline">
      <div className="timeline-list">
        {[...events].reverse().map(event => (
          <div key={event.id} className={`timeline-event event-${event.type}`}>
            <span className="event-id">#{event.id}</span>
            <span className="event-type">{EVENT_LABELS[event.type] || event.type}</span>
            {event.state_name && <span className="event-state">{event.state_name}</span>}
            <span className="event-time">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
