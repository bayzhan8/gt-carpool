import Link from "next/link";
import "./hero.css";

const windowColumns = [38, 50, 62, 72, 114, 124, 136, 148];
const buildingWindows = [116, 132, 150]
  .flatMap((y) =>
    windowColumns.map(
      (x) => `M${x} ${y + 8}V${y + 2.5}a2.5 2.5 0 0 1 5 0V${y + 8}Z`,
    ),
  )
  .join("");
const towerWindows =
  "M88 64h5v8h-5ZM97 64h5v8h-5ZM88 100V87a7 7 0 0 1 14 0V100ZM95 80V100M88 112h5v8h-5ZM97 112h5v8h-5Z";
const entranceArches =
  "M85 172V162a4.5 4.5 0 0 1 9 0V172ZM96 172V162a4.5 4.5 0 0 1 9 0V172Z";

function Scene() {
  return (
    <svg
      aria-hidden="true"
      className="hero-scene"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 560 190"
    >
      <g className="hero-fill">
        <path
          className="hero-brick"
          d="M30 172V108H160V172ZM82 108V58H108V108Z"
        />
        <path
          className="hero-slate"
          d="M30 108L36 100H154L160 108ZM34 100L42 90L50 100ZM140 100L148 90L156 100ZM80 48L95 14L110 48Z"
        />
        <path className="hero-band" d="M79 58V48H111V58Z" />
        <path className="hero-glow" d={`${buildingWindows}${towerWindows}`} />
        <path className="hero-door" d={entranceArches} />
      </g>
      <g className="hero-clouds">
        <path
          d="M196 58a10 10 0 0 1 19-4 8 8 0 0 1 13 7h-32a5 5 0 0 1 0-3Z"
          pathLength={1}
          style={{ "--i": 14 } as React.CSSProperties}
        />
        <path
          d="M300 34a8 8 0 0 1 15-3 6 6 0 0 1 10 6h-25a4 4 0 0 1 0-3Z"
          pathLength={1}
          style={{ "--i": 15 } as React.CSSProperties}
        />
      </g>

      <g className="hero-draw">
        <path
          d="M12 172H548"
          pathLength={1}
          style={{ "--i": 0 } as React.CSSProperties}
        />

        {/* Tech Tower */}
        <path
          d="M30 172V108H82M108 108H160V172"
          pathLength={1}
          style={{ "--i": 1 } as React.CSSProperties}
        />
        <path
          d="M30 108L36 100H82M108 100H154L160 108M34 100L42 90L50 100M140 100L148 90L156 100"
          pathLength={1}
          style={{ "--i": 2 } as React.CSSProperties}
        />
        <path
          d="M82 172V58H108V172M79 58V48H111V58Z"
          pathLength={1}
          style={{ "--i": 2 } as React.CSSProperties}
        />
        <path
          d="M80 48L95 14L110 48"
          pathLength={1}
          style={{ "--i": 3 } as React.CSSProperties}
        />
        <path
          d={buildingWindows}
          pathLength={1}
          style={{ "--i": 4 } as React.CSSProperties}
        />
        <path
          d="M30 128H82M108 128H160M30 144H82M108 144H160M82 76H108M82 104H108"
          pathLength={1}
          style={{ "--i": 5 } as React.CSSProperties}
        />
        <path
          d={towerWindows}
          pathLength={1}
          style={{ "--i": 5 } as React.CSSProperties}
        />
        <path
          d={entranceArches}
          pathLength={1}
          style={{ "--i": 6 } as React.CSSProperties}
        />

        {/* Trees */}
        <path
          d="M178 172v-12M169 151a9 9 0 1 0 18 0a9 9 0 1 0-18 0"
          pathLength={1}
          style={{ "--i": 7 } as React.CSSProperties}
        />
        <path
          d="M18 172v-10M11 155a7 7 0 1 0 14 0a7 7 0 1 0-14 0"
          pathLength={1}
          style={{ "--i": 7 } as React.CSSProperties}
        />

        {/* Road markings */}
        <path
          d="M190 180h14M224 180h14M258 180h14M292 180h14M326 180h14M360 180h14M394 180h14"
          pathLength={1}
          style={{ "--i": 8 } as React.CSSProperties}
        />

        {/* Airport */}
        <path
          d="M430 172V146q55-12 110 0V172"
          pathLength={1}
          style={{ "--i": 9 } as React.CSSProperties}
        />
        <path
          d="M444 172v-12M462 172v-14M480 172v-15M498 172v-15M516 172v-14"
          pathLength={1}
          style={{ "--i": 10 } as React.CSSProperties}
        />
        <path
          d="M418 172V112"
          pathLength={1}
          style={{ "--i": 11 } as React.CSSProperties}
        />
        <path
          d="M404 112h28l-4-14h-20Z"
          pathLength={1}
          style={{ "--i": 12 } as React.CSSProperties}
        />
        <path
          d="M410 98v-6h16v6M418 92v-8"
          pathLength={1}
          style={{ "--i": 13 } as React.CSSProperties}
        />
      </g>

      <g className="hero-sign">
        <path d="M95 14V7" className="hero-finial" />
        <circle cx={95} cy={6} r={1.6} />
        <text x={95} y={55.6} textAnchor="middle">
          TECH
        </text>
      </g>

      <g className="hero-plane">
        <path className="hero-trail" d="M330 96q30-12 60-30" pathLength={1} />
        <g transform="translate(392 54) rotate(-18)">
          <path
            d="M0 6h30c5 0 8 2 8 4s-3 4-8 4H4L-2 4Z"
            className="hero-body"
          />
          <path d="M14 10L6 22h6l12-12Z" className="hero-wing" />
          <path d="M2 6L-2 -2h5l6 8" className="hero-wing" />
        </g>
      </g>

      <g className="hero-car">
        <g className="hero-bounce">
          <path
            className="hero-car-body"
            d="M0 160v-7q0-3 3-3h6l7-7h20l9 7h6q3 0 3 3v7Z"
          />
          <path className="hero-window" d="M18 145h8v5h-13ZM29 145h6l6 5H29Z" />
          <circle className="hero-wheel" cx="12" cy="161" r="4.5" />
          <circle className="hero-wheel" cx="42" cy="161" r="4.5" />
        </g>
      </g>
    </svg>
  );
}

export function HeroBanner() {
  return (
    <div className="mb-8 overflow-hidden rounded-[16px] bg-surface px-3 pt-4 pb-1">
      <Scene />
    </div>
  );
}

export function Hero() {
  return (
    <section className="mb-10">
      <div className="overflow-hidden rounded-[16px] bg-surface px-3 pt-6 pb-2">
        <Scene />
      </div>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        Split the ride to ATL and back.
      </h1>
      <p className="mt-2 text-muted">
        Heading to the airport or coming back to campus? Find Georgia Tech
        students traveling around the same time, share one Uber or Lyft, and
        split the fare.
      </p>
      <ol className="mt-6 grid gap-2 sm:grid-cols-3 sm:gap-3">
        {[
          ["Find or post", "Campus ⇄ ATL Domestic or International."],
          ["Join the ride", "Riders see each other's numbers to coordinate."],
          [
            "Split the fare",
            "The app never charges you; your group splits it.",
          ],
        ].map(([title, body], index) => (
          <li
            className="flex gap-3 rounded-[12px] border border-hairline p-4 sm:block"
            key={title}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <div>
              <p className="font-medium sm:mt-3">{title}</p>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] border border-hairline px-4 py-3">
        <p className="flex-1 text-sm">
          <span className="font-medium">Georgia Tech students only.</span>{" "}
          <span className="text-muted">
            Sign in with your @gatech.edu email.
          </span>
        </p>
        <Link
          className="inline-flex min-h-11 items-center rounded-[10px] bg-primary px-4 text-sm font-medium text-white"
          href="/signin"
        >
          Sign in
        </Link>
      </div>
    </section>
  );
}
