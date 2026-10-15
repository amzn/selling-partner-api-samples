// Previous / Next bar at the bottom of a step. The Content step has its own (Save and next lives with Save).
type Props = {
  onPrev?: () => void;
  prevLabel?: string;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextTitle?: string;
};

export function StepFooter({
  onPrev,
  prevLabel = 'Previous',
  onNext,
  nextLabel = 'Next',
  nextDisabled,
  nextTitle,
}: Props) {
  return (
    <div className="actionbar step-footer">
      {onPrev && (
        <button type="button" onClick={onPrev}>
          ← {prevLabel}
        </button>
      )}
      <span className="spacer" />
      {onNext && (
        <button type="button" className="primary" onClick={onNext} disabled={nextDisabled} title={nextTitle}>
          {nextLabel} →
        </button>
      )}
    </div>
  );
}
