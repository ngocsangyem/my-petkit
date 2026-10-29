const COUNT = ['None', 'One', 'Two', 'Three'] as const;

interface ProvisionProgressProps {
  wifiDone: boolean;
  serverDone: boolean;
  sent: boolean;
}

/** The finding line, a 6px bar and the three steps, with the next one marked. */
export function ProvisionProgress({ wifiDone, serverDone, sent }: ProvisionProgressProps) {
  const steps = [
    { label: 'Wi-Fi network', done: wifiDone, next: 'fill in the Wi-Fi network' },
    { label: 'Server and time zone', done: serverDone, next: 'fill in the server address' },
    { label: 'Send to the device', done: sent, next: 'send them to the device' },
  ];
  const done = steps.filter(s => s.done).length;
  const next = steps.find(s => !s.done);
  return (
    <div className="provision-progress">
      <p className="provision-progress__finding">
        {next ? (
          <>
            <span className="provision-strong">
              {COUNT[done]} of three steps {done === 1 ? 'is' : 'are'} done.
            </span>{' '}
            Next: {next.next}.
          </>
        ) : (
          <span className="provision-strong">All three steps are done.</span>
        )}
      </p>
      <div
        role="progressbar"
        aria-label="Provisioning progress"
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={done}
        className="provision-progress__track"
      >
        <span className="provision-progress__fill" style={{ width: `${(done / 3) * 100}%` }} />
      </div>
      <ol className="provision-progress__steps">
        {steps.map(s => (
          <li key={s.label} aria-current={s === next ? 'step' : undefined}>
            {s.label}, {s.done ? 'done' : s === next ? 'next' : 'to do'}
          </li>
        ))}
      </ol>
    </div>
  );
}
