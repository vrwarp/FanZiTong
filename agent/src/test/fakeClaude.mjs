/**
 * Stands in for `claude auth login`, reproducing what the real CLI does over
 * pipes: print a sign-in URL, wait for a pasted code on stdin, then exit 0 and
 * leave credentials behind, or print "Login failed:" and exit 1.
 *
 * Driven by env vars so one script covers every case a test needs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const configDir = process.env.CLAUDE_CONFIG_DIR ?? '/tmp';
const accept = process.env.FAKE_ACCEPT_CODE ?? 'good-code';

if (process.env.FAKE_NO_URL === '1') {
  process.stdout.write('Something went wrong before any link\n');
} else {
  process.stdout.write('Opening browser to sign in…\n');
  process.stdout.write(
    "If the browser didn't open, visit: https://claude.com/cai/oauth/authorize?code=true&state=abc123\n",
  );
  process.stdout.write('Paste code here if prompted > ');
}

if (process.env.FAKE_EXIT_EARLY === '1') process.exit(1);

let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();
  if (!buffer.includes('\n')) return;
  const code = buffer.split('\n')[0].trim();
  if (code === accept) {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      path.join(configDir, '.credentials.json'),
      JSON.stringify({ claudeAiOauth: { accessToken: 'staged-token' } }),
    );
    process.stdout.write('\nLogin successful\n');
    process.exit(0);
  }
  process.stderr.write('Login failed: Request failed with status code 400\n');
  process.exit(1);
});
