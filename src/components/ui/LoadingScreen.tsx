export function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <span lang="zh-Hant-TW" className="hanzi text-5xl font-bold text-brand-600">
        繁字通
      </span>
      <p role="status" className="max-w-sm text-sm text-stone-600 dark:text-stone-300">
        {message}
      </p>
    </div>
  );
}
