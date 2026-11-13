type SkeletonKind = "browse" | "ride" | "profile" | "form";

export function LoadingSkeleton({ kind }: { kind: SkeletonKind }) {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse motion-reduce:animate-none"
    >
      <div className="h-8 w-40 rounded bg-surface" />
      {kind === "browse" ? (
        <>
          <div className="mt-6 h-11 rounded-[10px] bg-surface" />
          <div className="-mx-4 mt-4 flex gap-2 overflow-hidden px-4">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                className="h-11 w-24 shrink-0 rounded-full bg-surface"
                key={index}
              />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                className="h-11 w-20 shrink-0 rounded-full bg-surface"
                key={index}
              />
            ))}
          </div>
          <div className="mt-8 space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="h-28 rounded-[12px] bg-surface" key={index} />
            ))}
          </div>
        </>
      ) : kind === "ride" ? (
        <div className="mt-8 space-y-5">
          <div className="h-16 w-40 rounded bg-surface" />
          <div className="h-48 rounded-[12px] bg-surface" />
          <div className="h-28 rounded-[12px] bg-surface" />
        </div>
      ) : kind === "profile" ? (
        <div className="mt-8 space-y-5">
          <div className="h-40 rounded-[12px] bg-surface" />
          <div className="h-28 rounded-[12px] bg-surface" />
          <div className="h-28 rounded-[12px] bg-surface" />
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          <div className="h-11 rounded-[10px] bg-surface" />
          <div className="h-24 rounded-[12px] bg-surface" />
          <div className="h-11 rounded-[10px] bg-surface" />
          <div className="h-28 rounded-[12px] bg-surface" />
        </div>
      )}
    </div>
  );
}
