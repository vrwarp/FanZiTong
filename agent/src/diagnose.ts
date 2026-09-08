/**
 * Why Claude Code would not start.
 *
 * The SDK has one sentence for seven different errno values: when the file is
 * on disk and spawn fails with ENOENT, EACCES, EPERM, ENOTDIR, ELOOP,
 * ENAMETOOLONG or EROFS, it reports that the binary "exists but failed to
 * launch" and offers a mismatched libc as the likely reason. A missing
 * working directory is also an ENOENT from spawn — the errno names the call,
 * not the file — so a perfectly good binary produces a message about a musl
 * loader that was never involved, and the search starts in the wrong place.
 *
 * Nothing here guesses. It asks the machine four questions whose answers are
 * cheap and certain, and says only what it found.
 */
import { accessSync, constants, openSync, readSync, closeSync, statSync } from 'node:fs';

/** ELF `e_machine` values for the platforms Claude Code ships a binary for. */
const ELF_MACHINES = new Map<number, string>([
  [0x03, 'ia32'],
  [0x3e, 'x64'],
  [0x28, 'arm'],
  [0xb7, 'arm64'],
]);

export interface Checks {
  /** Whether the path is a directory that can be entered. */
  isDirectory(path: string): boolean;
  /** Whether the path is a file. */
  isFile(path: string): boolean;
  /** Whether this process may execute the file. */
  isExecutable(path: string): boolean;
  /** The architecture the file is compiled for, or null when it is not ELF. */
  archOf(path: string): string | null;
}

export const realChecks: Checks = {
  isDirectory(path) {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  },
  isFile(path) {
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  },
  isExecutable(path) {
    try {
      accessSync(path, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  },
  archOf(path) {
    let fd: number | null = null;
    try {
      fd = openSync(path, 'r');
      const header = Buffer.alloc(20);
      // e_machine is a 16-bit field at offset 18 of every ELF header.
      if (readSync(fd, header, 0, 20, 0) < 20) return null;
      if (header.toString('binary', 0, 4) !== '\x7fELF') return null;
      const little = header[5] !== 2;
      const machine = little ? header.readUInt16LE(18) : header.readUInt16BE(18);
      return ELF_MACHINES.get(machine) ?? `ELF machine 0x${machine.toString(16)}`;
    } catch {
      return null;
    } finally {
      if (fd !== null) closeSync(fd);
    }
  },
};

export interface LaunchSubject {
  /** The binary that was spawned, where the caller knows which one it was. */
  binary?: string;
  /** The directory it was spawned in. A missing one fails the same way. */
  cwd?: string;
  /** This machine's architecture; overridable for tests. */
  arch?: string;
}

/**
 * The one thing that is demonstrably wrong, or null when everything checked
 * here is fine and the cause is somewhere else.
 *
 * The working directory comes first because it is the failure the SDK's
 * message describes least well and the one a container deployment actually
 * hits: `/data/workspace` is created in the image, and an operator who
 * bind-mounts `/data` from the host replaces it with a directory that has
 * neither of the image's subdirectories in it.
 */
export function diagnoseLaunch(subject: LaunchSubject, checks: Checks = realChecks): string | null {
  const { binary, cwd } = subject;
  const arch = subject.arch ?? process.arch;

  if (cwd && !checks.isDirectory(cwd)) {
    return `The assistant could not start because its working directory ${cwd} does not exist. A missing working directory fails the same way a missing program does, which is why the message below blames the binary. Create that directory, or set FZT_AGENT_WORKSPACE to one that exists.`;
  }
  if (!binary) return null;
  // A bare name is resolved against PATH, so asking the filesystem about it
  // answers a different question than the one that failed.
  if (!binary.includes('/')) return null;
  if (!checks.isFile(binary)) {
    return `The assistant could not start because ${binary} is not there.`;
  }
  if (!checks.isExecutable(binary)) {
    return `The assistant could not start because ${binary} is not executable by the user this process runs as.`;
  }
  const built = checks.archOf(binary);
  if (built && built !== arch) {
    return `The assistant could not start because ${binary} is built for ${built} and this machine is ${arch}.`;
  }
  return null;
}

/**
 * The SDK's wording for a spawn that failed with the file present. Only this
 * one: when it says the binary is not there it has already said something
 * true, and leading with the working directory would bury it.
 */
const LAUNCH_FAILED = /exists but failed to launch/;

/**
 * Turn the SDK's guess into what was actually checked, and leave every other
 * error exactly as it was: this rewrites a diagnosis, not a failure.
 */
export function explainLaunchFailure(
  message: string,
  subject: LaunchSubject,
  checks: Checks = realChecks,
): string {
  if (!LAUNCH_FAILED.test(message)) return message;
  const found = diagnoseLaunch(subject, checks);
  return found ? `${found}\n\nThe underlying error was: ${message}` : message;
}
