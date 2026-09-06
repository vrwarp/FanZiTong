import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, inputClass } from '@/components/ui/Field';
import { repository } from '@/db/repository';
import type { AiBatch } from '@/types';
import { useAssistant } from '@/lib/assistant/assistantContext';
import {
  cancelSignIn,
  fetchAuthState,
  normalizeCode,
  signOut,
  startSignIn,
  submitSignInCode,
  type AuthState,
} from '@/lib/assistant/authClient';
import { forgetPairing, isSecureEndpoint, loadConfig, saveEndpoint } from '@/lib/assistant/config';

const CONNECTION: Record<string, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  offline: 'Offline',
  unauthorized: 'Signed out',
  error: 'Not reachable',
  unconfigured: 'Not set up',
};

type Phase =
  | { step: 'idle' }
  | { step: 'starting' }
  | { step: 'code'; loginId: string; url: string }
  | { step: 'finishing' };

/**
 * Setting up the assistant.
 *
 * There is no password to invent here. The sidecar belongs to whoever can sign
 * in to its Claude account, so this shows the link Claude Code produced, takes
 * the code back, and stores the session that comes out of it.
 */
export function AssistantSettings() {
  const assistant = useAssistant();
  const [config, setConfig] = useState(() => loadConfig());
  const [endpoint, setEndpoint] = useState(config.endpoint);
  const [remote, setRemote] = useState<AuthState | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: 'idle' });
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<AiBatch[]>([]);

  const refreshChanges = useCallback(() => {
    void repository.listAssistantBatches(10).then(setBatches);
  }, []);
  useEffect(refreshChanges, [refreshChanges]);

  const ready = endpoint.trim().length > 0 && isSecureEndpoint(endpoint);
  const insecure = endpoint.trim().length > 0 && !isSecureEndpoint(endpoint);

  // Ask the sidecar where things stand: claimed by an account, and does this
  // device still hold a session? Handlers ask for a fresh look by bumping the
  // counter rather than calling in, so the request always belongs to an effect
  // that can cancel it.
  const [reload, setReload] = useState(0);
  const refreshRemote = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchAuthState(endpoint, loadConfig().token || null)
      .then((next) => {
        if (cancelled) return;
        setRemote(next);
        setError(null);
      })
      .catch((problem: unknown) => {
        if (cancelled) return;
        setRemote(null);
        setError(problem instanceof Error ? problem.message : 'Could not reach that address.');
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, ready, reload]);

  // An address that is not usable has no state to speak of.
  const status = ready ? remote : null;

  const beginSignIn = async () => {
    setError(null);
    setPhase({ step: 'starting' });
    try {
      const login = await startSignIn(endpoint, loadConfig().token || null);
      // The sidecar hands back a link to open. Only ever render an https one,
      // so a misconfigured or hostile address cannot turn this into a
      // javascript: link.
      if (!/^https:\/\//i.test(login.url)) {
        throw new Error('That assistant offered a sign-in link that is not safe to open.');
      }
      setPhase({ step: 'code', loginId: login.loginId, url: login.url });
    } catch (problem) {
      setPhase({ step: 'idle' });
      setError(problem instanceof Error ? problem.message : 'Could not start the sign-in.');
    }
  };

  const finishSignIn = async () => {
    if (phase.step !== 'code') return;
    setError(null);
    const { loginId } = phase;
    setPhase({ step: 'finishing' });
    try {
      const session = await submitSignInCode(endpoint, loginId, normalizeCode(code));
      saveEndpoint(endpoint, session.token);
      setConfig(loadConfig());
      setCode('');
      setPhase({ step: 'idle' });
      assistant.reconnect();
      refreshRemote();
    } catch (problem) {
      setPhase({ step: 'code', loginId, url: phase.step === 'code' ? phase.url : '' });
      setError(problem instanceof Error ? problem.message : 'That code was not accepted.');
    }
  };

  const disconnect = async () => {
    await signOut(endpoint, loadConfig().token || null);
    forgetPairing();
    setConfig(loadConfig());
    setEndpoint('');
    assistant.reconnect();
    setRemote(null);
  };

  const connected = assistant.state.connection === 'connected';
  const accountName =
    status?.account?.email ?? assistant.state.account?.email ?? status?.account?.subscriptionType;

  return (
    <section className="card-surface flex flex-col gap-4 p-4" data-testid="assistant-settings">
      <div>
        <h2 className="text-sm font-bold text-stone-500 uppercase dark:text-stone-400">
          Assistant 助教
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Optional. It runs on a machine you own and signs in with your own Claude account. Your
          words stay on this device unless you ask it something.
        </p>
      </div>

      <Field
        label="Address 位址"
        htmlFor="assistant-endpoint"
        hint="Printed when the assistant starts, e.g. wss://agent.your-domain.com"
      >
        <input
          id="assistant-endpoint"
          className={inputClass}
          value={endpoint}
          onChange={(event) => setEndpoint(event.target.value)}
          onBlur={refreshRemote}
          placeholder="wss://…"
          autoComplete="off"
          spellCheck={false}
          data-testid="assistant-endpoint"
        />
      </Field>

      {insecure && (
        <p role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
          Use wss:// so the connection is encrypted. Plain ws:// only works on this machine.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* Step one: ask the assistant for a Claude sign-in link. */}
      {ready && phase.step !== 'code' && phase.step !== 'finishing' && (
        <div className="flex flex-wrap items-center gap-2">
          {!config.token || status?.authenticated === false ? (
            <Button
              size="sm"
              onClick={() => void beginSignIn()}
              disabled={phase.step === 'starting' || status?.canSignIn === false}
              data-testid="assistant-signin"
            >
              {phase.step === 'starting' ? 'Opening…' : 'Sign in with Claude'}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => void disconnect()}>
              Sign out
            </Button>
          )}
          <span
            className="text-sm text-stone-500 dark:text-stone-400"
            data-testid="assistant-status"
          >
            {CONNECTION[assistant.state.connection] ?? assistant.state.connection}
            {connected && accountName ? ` · ${accountName}` : ''}
          </span>
        </div>
      )}

      {status?.canSignIn === false && !config.token && (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          This assistant already belongs to a Claude account. Sign in from a device that is already
          connected, or restart it with <code>FZT_ALLOW_RECLAIM=true</code>.
        </p>
      )}

      {/* Step two: they open the link, approve, and bring the code back. */}
      {phase.step === 'code' && (
        <div className="flex flex-col gap-3" data-testid="assistant-signin-code">
          <ol className="ml-4 list-decimal space-y-2 text-sm">
            <li>
              <a
                href={phase.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-brand-600 underline dark:text-brand-500"
                data-testid="assistant-signin-link"
              >
                Open the Claude sign-in page
              </a>
            </li>
            <li>Approve access, then copy the code it shows you.</li>
            <li>Paste it here.</li>
          </ol>
          <Field label="Code 授權碼" htmlFor="assistant-code">
            <input
              id="assistant-code"
              className={inputClass}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Paste the code (or the whole address it sends you to)"
              autoComplete="off"
              spellCheck={false}
              data-testid="assistant-code"
            />
          </Field>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => void finishSignIn()}
              disabled={code.trim().length === 0}
              data-testid="assistant-code-submit"
            >
              Finish
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void cancelSignIn(endpoint, phase.loginId);
                setPhase({ step: 'idle' });
                setCode('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {phase.step === 'finishing' && (
        <p role="status" className="text-sm text-stone-500 dark:text-stone-400">
          Checking that code with Claude…
        </p>
      )}

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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void assistant.undo(batch.id).then(refreshChanges)}
                  >
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
