interface WaitingStatusProps {
  hostName: string;
}

export function WaitingStatus({ hostName }: WaitingStatusProps) {
  return (
    <div className="box has-text-centered">
      <h2 className="subtitle is-4 mb-4">🎄 Your host is setting up the next round!</h2>
      <p className="has-text-grey">Waiting for {hostName} to start the round...</p>
    </div>
  );
}
