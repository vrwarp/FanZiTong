import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, inputClass } from '@/components/ui/Field';
import { repository } from '@/db/repository';
import type { AiBatch } from '@/types';
import { useAssistant } from '@/lib/assistant/assistantContext';
import { forgetPairing, isSecureEndpoint, loadConfig, saveEndpoint } from '@/lib/assistant/config';

const STATUS: Record<string, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  offline: 'Offline',
  unauthorized: 'Rejected',
  error: 'Not reachable',
  unconfigured: 'Not set up',
};

/**
 * Pairing lives here rather than in `UserSettings`, because settings are
 * written into the JSON backup and a token does not belong in a file the
 * learner emails to themselves.
 */
export function AssistantSettings() {
  const assistant = useAssistant();
  const [config, setConfig] = useState(() => loadConfig());
  const [endpoint, setEndpoint] = useState(config.endpoint);
  const [token, setToken] = useState(config.token);
  const [saved, setSaved] = useState(false);
  // A one-shot read rather than a live query: this is an audit list that only
  // changes when the assistant writes something or an undo happens here, and a
  // standing database observer on the settings screen earns nothing.
  const [batches, setBatches] = useState<AiBatch[]>([]);
  const refresh = useCallback(() => {
    void repository.listAssistantBatches(10).then(setBatches);
  }, []);
  useEffect(refresh, [refresh]);

  const insecure = endpoint.trim().length > 0 && !isSecureEndpoint(endpoint);

  const save = () => {
    saveEndpoint(endpoint, token);
    setConfig(loadConfig());
    setSaved(true);
    assistant.reconnect();
  };

  return (
    <section className="card-surface flex flex-col gap-4 p-4" data-testid="assistant-settings">
      <div>
        <h2 className="text-sm font-bold text-stone-500 uppercase dark:text-stone-400">
          Assistant 助教
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Optional. Runs on your own machine with your own Claude Code login, and only while this
          app is open. Your words never leave your device unless you ask it something.
        </p>
      </div>

      <Field
        label="Address 位址"
        htmlFor="assistant-endpoint"
        hint="The sidecar prints this when it starts, e.g. wss://fanzitong-agent.your-tailnet.ts.net"
      >
        <input
          id="assistant-endpoint"
          className={inputClass}
          value={endpoint}
          onChange={(event) => {
            setEndpoint(event.target.value);
            setSaved(false);
          }}
          placeholder="wss://…"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <Field label="Pairing token 配對碼" htmlFor="assistant-token">
        <input
          id="assistant-token"
          type="password"
          className={inputClass}
          value={token}
          onChange={(event) => {
            setToken(event.target.value);
            setSaved(false);
          }}
          autoComplete="off"
        />
      </Field>

      {insecure && (
        <p role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
          Use wss:// so the connection is encrypted. Plain ws:// only works on this machine.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={insecure}>
          Save & connect
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            forgetPairing();
            setEndpoint('');
            setToken('');
            setConfig(loadConfig());
            assistant.reconnect();
          }}
        >
          Forget
        </Button>
        <span className="text-sm text-stone-500 dark:text-stone-400" data-testid="assistant-status">
          {STATUS[assistant.state.connection] ?? assistant.state.connection}
          {assistant.state.account?.email ? ` · ${assistant.state.account.email}` : ''}
          {saved ? ' · saved' : ''}
        </span>
      </div>

      {assistant.state.connectionDetail && (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {assistant.state.connectionDetail}
        </p>
      )}

      {batches.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200">
            Recent changes 最近的修改
          </h3>
          <ul className="flex flex-col gap-1" data-testid="assistant-changes">
            {batches.map((batch) => (
              <li key={batch.id} className="flex items-center justify-between gap-2 text-sm">
                <span className={batch.undoneAt ? 'text-stone-400 line-through' : ''}>
                  {batch.summary} — {batch.reason}
                </span>
                {!batch.undoneAt && (
                  <Button variant="ghost" size="sm" onClick={() => void assistant.undo(batch.id)}>
                    Undo
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
