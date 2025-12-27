interface SubmittedStatusProps {
  submittedAnswer: string;
  partnerName: string | null;
  partnerSubmitted: boolean;
  totalAnswersCount: number;
}

export function SubmittedStatus({
  submittedAnswer,
  partnerName,
  partnerSubmitted,
  totalAnswersCount
}: SubmittedStatusProps) {
  return (
    <div className="box">
      <h2 className="subtitle is-4 has-text-success mb-4">✓ Answer Submitted!</h2>
      <div className="notification is-success is-light mb-4">
        <p className="has-text-weight-semibold mb-2">You said:</p>
        <p className="is-size-5">{submittedAnswer}</p>
      </div>
      {partnerName && (
        <div className="notification is-info is-light mb-4">
          <p>
            <strong>{partnerName}:</strong>{' '}
            <i>{partnerSubmitted ? '✓ Submitted' : 'is thinking...'}</i>
          </p>
        </div>
      )}
      {totalAnswersCount < 4 && (
        <p className="has-text-centered has-text-grey">Waiting for other players to finish...</p>
      )}
    </div>
  );
}
