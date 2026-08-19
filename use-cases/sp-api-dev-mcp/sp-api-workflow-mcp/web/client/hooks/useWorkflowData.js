import { useState, useCallback, useEffect } from 'react';

/**
 * Hook for fetching live workflow data (schema + diagram) from the store.
 * This is the single source of truth — no stale snapshots.
 */
export default function useWorkflowData(workflowId) {
  const [workflow, setWorkflow] = useState(null); // { workflow_id, name, description, schema }
  const [diagram, setDiagram] = useState(null);   // { workflowId, mermaid, stateCount }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!workflowId) return;
    try {
      const [wfRes, diagRes] = await Promise.all([
        fetch(`/api/workflows/${workflowId}`),
        fetch(`/api/workflows/${workflowId}/diagram`),
      ]);

      if (!wfRes.ok) throw new Error('Workflow not found');
      const wfData = await wfRes.json();
      setWorkflow(wfData);

      if (diagRes.ok) {
        const diagData = await diagRes.json();
        setDiagram(diagData);
      }

      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  // Fetch on mount and when workflowId changes
  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  return {
    workflow,
    schema: workflow?.schema || null,
    diagram,
    loading,
    error,
    refresh: fetchData,
  };
}
