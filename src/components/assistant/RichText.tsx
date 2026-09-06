import { Fragment } from 'react';
import { Hanzi } from '@/components/ui/Hanzi';

/**
 * The assistant's replies, rendered plainly.
 *
 * Just enough markdown for a phone: paragraphs, bullets and bold. Chinese runs
 * go through `Hanzi` so they get Taiwan glyph forms rather than whatever the
 * system font decides.
 */
const HAN_RUN = /([\p{Script=Han}\p{Script=Bopomofo}，。、！？；：「」『』（）]+)/u;

function withHanzi(text: string, keyPrefix: string) {
  return text
    .split(HAN_RUN)
    .map((part, index) =>
      HAN_RUN.test(part) ? (
        <Hanzi key={`${keyPrefix}-${index}`}>{part}</Hanzi>
      ) : (
        <Fragment key={`${keyPrefix}-${index}`}>{part}</Fragment>
      ),
    );
}

function inline(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((chunk, index) => {
    const key = `${keyPrefix}-${index}`;
    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      return <strong key={key}>{withHanzi(chunk.slice(2, -2), key)}</strong>;
    }
    if (chunk.startsWith('`') && chunk.endsWith('`')) {
      return (
        <code key={key} className="rounded bg-stone-200/70 px-1 text-[0.9em] dark:bg-stone-700/60">
          {chunk.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={key}>{withHanzi(chunk, key)}</Fragment>;
  });
}

export function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n');
        const bullets = lines.every((line) => /^\s*[-*•]\s+/.test(line));
        if (bullets) {
          return (
            <ul key={blockIndex} className="ml-4 list-disc space-y-1">
              {lines.map((line, index) => (
                <li key={index}>
                  {inline(line.replace(/^\s*[-*•]\s+/, ''), `${blockIndex}-${index}`)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={blockIndex} className="whitespace-pre-wrap">
            {inline(block, String(blockIndex))}
          </p>
        );
      })}
    </>
  );
}
