import { mkdtempSync, chmodSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { diagnoseLaunch, explainLaunchFailure, realChecks, type Checks } from './diagnose';

/** The exact sentence the Agent SDK produces for any spawn errno. */
const SDK_MESSAGE =
  "Claude Code native binary at /app/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude exists but failed to launch. This usually means the binary does not match this system's libc — e.g. spawning a musl-linked binary on a glibc Linux host fails because the musl dynamic loader (/lib/ld-musl-*) is missing. Specify a matching binary with options.pathToClaudeCodeExecutable.";

/** Everything is fine unless a test says otherwise. */
function checks(overrides: Partial<Checks> = {}): Checks {
  return {
    isDirectory: () => true,
    isFile: () => true,
    isExecutable: () => true,
    archOf: () => 'x64',
    ...overrides,
  };
}

const subject = { binary: '/app/node_modules/x/claude', cwd: '/data/workspace', arch: 'x64' };

describe('diagnosing a spawn that failed', () => {
  it('names the working directory, which fails exactly like a missing binary', () => {
    const found = diagnoseLaunch(subject, checks({ isDirectory: () => false }));
    expect(found).toMatch(/\/data\/workspace does not exist/);
    expect(found).toMatch(/FZT_AGENT_WORKSPACE/);
  });

  it('says so when the binary is not there', () => {
    expect(diagnoseLaunch(subject, checks({ isFile: () => false }))).toMatch(/is not there/);
  });

  it('says so when the binary cannot be executed by this user', () => {
    expect(diagnoseLaunch(subject, checks({ isExecutable: () => false }))).toMatch(
      /not executable/,
    );
  });

  it('names both architectures when they disagree', () => {
    const found = diagnoseLaunch(subject, checks({ archOf: () => 'arm64' }));
    expect(found).toMatch(/built for arm64 and this machine is x64/);
  });

  it('asks nothing of the filesystem about a name resolved against PATH', () => {
    const onPath = { binary: 'claude', cwd: '/data/workspace', arch: 'x64' };
    expect(diagnoseLaunch(onPath, checks({ isFile: () => false }))).toBeNull();
  });

  it('claims nothing when every check passes', () => {
    expect(diagnoseLaunch(subject, checks())).toBeNull();
  });

  it('checks the directory before the binary: the SDK already blamed the binary', () => {
    const found = diagnoseLaunch(
      subject,
      checks({ isDirectory: () => false, isFile: () => false }),
    );
    expect(found).toMatch(/working directory/);
  });
});

describe('rewriting the SDK message', () => {
  it('leads with the real cause and keeps the original underneath', () => {
    const text = explainLaunchFailure(SDK_MESSAGE, subject, checks({ isDirectory: () => false }));
    expect(text.startsWith('The assistant could not start because its working directory')).toBe(
      true,
    );
    expect(text).toContain(SDK_MESSAGE);
  });

  it('leaves the message alone when nothing here explains it', () => {
    expect(explainLaunchFailure(SDK_MESSAGE, subject, checks())).toBe(SDK_MESSAGE);
  });

  it('leaves the SDK to say the binary is missing, which it says correctly', () => {
    const notFound = 'Claude Code native binary not found at /app/claude.';
    expect(explainLaunchFailure(notFound, subject, checks({ isDirectory: () => false }))).toBe(
      notFound,
    );
  });

  it('never touches an error that is not about launching', () => {
    const other = 'Claude API error: 429 rate limited';
    expect(explainLaunchFailure(other, subject, checks({ isDirectory: () => false }))).toBe(other);
  });
});

describe('the checks themselves', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fzt-diagnose-'));

  it('reads the architecture out of a real ELF header', () => {
    // A 20-byte stub is enough: magic, class, endianness and e_machine.
    const elf = Buffer.alloc(20);
    elf.write('\x7fELF', 0, 'binary');
    elf[4] = 2; // 64-bit
    elf[5] = 1; // little endian
    elf.writeUInt16LE(0xb7, 18); // aarch64
    const file = path.join(dir, 'fake-arm64');
    writeFileSync(file, elf);
    expect(realChecks.archOf(file)).toBe('arm64');
  });

  it('is silent about a file that is not ELF, rather than guessing', () => {
    const file = path.join(dir, 'script');
    writeFileSync(file, '#!/bin/sh\necho hi\n');
    expect(realChecks.archOf(file)).toBeNull();
  });

  it('tells a missing directory from a real one, and an executable from a plain file', () => {
    const file = path.join(dir, 'plain');
    writeFileSync(file, 'x');
    chmodSync(file, 0o644);
    expect(realChecks.isDirectory(dir)).toBe(true);
    expect(realChecks.isDirectory(path.join(dir, 'nope'))).toBe(false);
    expect(realChecks.isFile(file)).toBe(true);
    expect(realChecks.isExecutable(file)).toBe(false);
    chmodSync(file, 0o755);
    expect(realChecks.isExecutable(file)).toBe(true);
  });
});
