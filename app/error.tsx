"use client";

export default function Error({ retry }: { error: Error; retry: () => void }) {
  return (
    <section className="py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <button
        className="mt-6 min-h-11 rounded-[10px] border border-hairline px-4 font-medium"
        onClick={() => retry()}
        type="button"
      >
        Try again
      </button>
    </section>
  );
}
