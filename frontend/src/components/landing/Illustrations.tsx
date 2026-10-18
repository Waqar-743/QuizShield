import { memo, useEffect, useId, useRef, type ReactNode } from "react";
import "./illustrations.css";

// Original QuizShield artwork. Motion is CSS-only; React does not render frames.
const Illustration = ({
  title,
  description,
  viewBox,
  children,
  className = "",
}: {
  title: string;
  description: string;
  viewBox: string;
  children: ReactNode;
  className?: string;
}) => {
  const id = useId();
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      element.dataset.inView = "true";
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        element.dataset.inView = String(entry.isIntersecting);
      },
      { rootMargin: "80px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={frame}
      className={`qs-art ${className}`}
      data-illustration
      data-in-view="false"
    >
      <svg
        viewBox={viewBox}
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
      >
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-desc`}>{description}</desc>
        {children}
      </svg>
    </div>
  );
};

const Check = ({
  x,
  y,
  size = 24,
}: {
  x: number;
  y: number;
  size?: number;
}) => (
  <svg
    x={x}
    y={y}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="m5 12 4 4L19 6"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Lock = ({ x, y, size = 28 }: { x: number; y: number; size?: number }) => (
  <svg
    x={x}
    y={y}
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
  >
    <rect
      x="7"
      y="14"
      width="18"
      height="14"
      rx="4"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M11 14V9a5 5 0 0 1 10 0v5"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M16 20v3"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const Paper = ({
  x,
  y,
  width = 136,
  height = 170,
  dark = false,
}: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  dark?: boolean;
}) => (
  <g transform={`translate(${x} ${y})`}>
    <rect
      width={width}
      height={height}
      rx="16"
      fill={dark ? "#161e26" : "#fff"}
      stroke={dark ? "#32424a" : "#dce7e2"}
    />
    <rect
      x="18"
      y="20"
      width="28"
      height="6"
      rx="3"
      fill={dark ? "#6ce8b7" : "#047857"}
    />
    <path
      d={`M18 46h${width - 38}M18 56h${width - 65}`}
      stroke={dark ? "#6c8383" : "#b7c9c1"}
      strokeWidth="4"
      strokeLinecap="round"
    />
    {[78, 104, 130]
      .filter((top) => top < height - 15)
      .map((top, i) => (
        <g key={top}>
          <rect
            x="18"
            y={top}
            width="12"
            height="12"
            rx="4"
            fill={i === 1 ? "#d0fbe9" : dark ? "#23353a" : "#f0f5f2"}
            stroke={i === 1 ? "#6ce8b7" : "none"}
          />
          <path
            d={`M40 ${top + 6}h${width - 62}`}
            stroke={dark ? "#425d60" : "#dce7e2"}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      ))}
  </g>
);

const Shield = ({
  x,
  y,
  size = 144,
}: {
  x: number;
  y: number;
  size?: number;
}) => (
  <svg
    x={x}
    y={y}
    width={size}
    height={size}
    viewBox="0 0 160 160"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="m80 12 51 18v39c0 30-20 57-51 70-31-13-51-40-51-70V30L80 12Z"
      fill="#ecfef7"
      stroke="#a4f4d3"
      strokeWidth="1.5"
    />
    <path
      d="m80 26 39 14v30c0 23-15 44-39 55-24-11-39-32-39-55V40l39-14Z"
      fill="#047857"
    />
    <path
      d="m60 76 14 14 29-31"
      stroke="#6ce8b7"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="qs-draw qs-motion"
      pathLength="1"
    />
    <path
      d="m80 12 51 18v39c0 30-20 57-51 70-31-13-51-40-51-70V30L80 12Z"
      stroke="#10b981"
      strokeOpacity=".45"
      strokeWidth="1.5"
      className="qs-trace qs-motion"
      pathLength="100"
    />
  </svg>
);

export const AssessmentJourney = memo(function AssessmentJourney() {
  const id = useId().replace(/:/g, "");
  return (
    <Illustration
      title="From course questions to teacher-reviewed results"
      description="A quiz document passes through QuizShield's enrolment and schedule checks to teacher review. Results are held until teacher review. This is an illustration, not a live session."
      viewBox="0 0 960 410"
      className="qs-journey"
    >
      <defs>
        <radialGradient id={`${id}-wash`}>
          <stop stopColor="#d0fbe9" />
          <stop offset="1" stopColor="#f7faf8" stopOpacity="0" />
        </radialGradient>
        <pattern
          id={`${id}-grid`}
          width="32"
          height="32"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="1" fill="#047857" fillOpacity=".12" />
        </pattern>
      </defs>
      <rect width="960" height="410" fill={`url(#${id}-grid)`} />
      <ellipse cx="480" cy="185" rx="350" ry="210" fill={`url(#${id}-wash)`} />
      <path d="M238 206H394M566 206h156" stroke="#bfded0" strokeWidth="1.5" />
      <path
        d="M238 206H394M566 206h156"
        stroke="#10b981"
        strokeWidth="2"
        strokeDasharray="4 18"
        className="qs-flow qs-motion"
      />
      <path
        d="M480 118V74c0-13 11-24 24-24h156M480 282v42c0 13-11 24-24 24H294"
        stroke="#b7cfc4"
        strokeDasharray="3 6"
      />
      <g className="qs-float qs-motion">
        <rect
          x="100"
          y="106"
          width="160"
          height="214"
          rx="22"
          fill="#dce7e2"
          fillOpacity=".45"
          transform="rotate(-7 180 213)"
        />
        <Paper x={100} y={96} width={160} height={210} />
        <rect x="118" y="256" width="124" height="30" rx="8" fill="#f0f5f2" />
        <text x="180" y="276" textAnchor="middle" className="qs-label">
          Course questions
        </text>
      </g>
      <circle
        cx="480"
        cy="200"
        r="103"
        fill="#fff"
        fillOpacity=".65"
        stroke="#d8eee3"
      />
      <circle cx="480" cy="200" r="88" stroke="#a4f4d3" strokeDasharray="2 9" />
      <Shield x={400} y={119} size={160} />
      <g className="qs-float qs-float--late qs-motion">
        <rect
          x="710"
          y="104"
          width="160"
          height="214"
          rx="22"
          fill="#cfe7de"
          fillOpacity=".5"
          transform="rotate(7 790 211)"
        />
        <Paper x={704} y={96} width={160} height={210} />
        <rect
          x="721"
          y="161"
          width="126"
          height="94"
          rx="10"
          fill="#ecfef7"
          stroke="#d0fbe9"
        />
        <circle cx="784" cy="201" r="23" fill="#fff" stroke="#a4f4d3" />
        <Lock x={770} y={186} />
        <text x="784" y="277" textAnchor="middle" className="qs-label">
          Teacher review
        </text>
      </g>
      <g>
        <rect
          x="620"
          y="31"
          width="212"
          height="40"
          rx="20"
          fill="#fff"
          stroke="#dce7e2"
        />
        <circle cx="643" cy="51" r="4" fill="#10b981" />
        <text x="658" y="56" className="qs-label">
          Enrolment &amp; schedule checks
        </text>
      </g>
      <g>
        <rect
          x="130"
          y="328"
          width="214"
          height="40"
          rx="20"
          fill="#fff"
          stroke="#dce7e2"
        />
        <Lock x={143} y={338} size={20} />
        <text x="173" y="353" className="qs-label">
          Teacher-reviewed results
        </text>
      </g>
      <text x="480" y="393" textAnchor="middle" className="qs-caption">
        A teacher-led assessment, from start to finish.
      </text>
    </Illustration>
  );
});

export const CompactJourney = memo(function CompactJourney() {
  return (
    <Illustration
      title="A teacher-led assessment workflow"
      description="Course questions, QuizShield checks and a teacher-reviewed result. Results are held until teacher review."
      viewBox="0 0 340 310"
      className="qs-journey-compact"
    >
      <circle cx="170" cy="148" r="114" fill="#ecfef7" stroke="#d0fbe9" />
      <path
        d="M73 109 146 165 269 111M170 175v83"
        stroke="#a4d5c0"
        strokeDasharray="3 7"
      />
      <g className="qs-float qs-motion">
        <Paper x={25} y={40} width={98} height={130} />
      </g>
      <g className="qs-float qs-float--late qs-motion">
        <Paper x={217} y={40} width={98} height={130} />
        <Lock x={252} y={125} size={23} />
      </g>
      <Shield x={104} y={105} size={132} />
      <rect
        x="75"
        y="254"
        width="190"
        height="36"
        rx="18"
        fill="#fff"
        stroke="#dce7e2"
      />
      <Lock x={91} y={263} size={18} />
      <text x="120" y="277" className="qs-label">
        Teacher-reviewed
      </text>
    </Illustration>
  );
});

export const ActivityReviewGraphic = memo(function ActivityReviewGraphic() {
  return (
    <Illustration
      title="Assessment activity, ready for review"
      description="Recorded browser events sit alongside the submitted assessment, with teacher review as the final step. Events provide context, not an automatic cheating verdict."
      viewBox="0 0 520 340"
      className="qs-activity-full"
    >
      <circle cx="240" cy="170" r="132" fill="#e5f6ee" />
      <g transform="rotate(-6 215 170)">
        <Paper x={90} y={66} width={190} height={228} />
      </g>
      <path
        d="M270 112h40m-40 66h40m-40 66h40M310 112v132"
        stroke="#a6c8b7"
        strokeWidth="1.5"
      />
      <path
        d="M310 112v132"
        stroke="#059669"
        strokeWidth="2"
        strokeDasharray="3 13"
        className="qs-flow qs-motion"
      />
      {[
        { y: 91, label: "Answer submitted", color: "#047857" },
        { y: 157, label: "Focus event", color: "#9a6700" },
        { y: 223, label: "Teacher review", color: "#047857" },
      ].map(({ y, label, color }, i) => (
        <g key={label} className={`qs-event qs-event--${i} qs-motion`}>
          <rect
            x="327"
            y={y}
            width="166"
            height="43"
            rx="12"
            fill="#fff"
            stroke="#dce7e2"
          />
          <circle cx="347" cy={y + 22} r="4" fill={color} />
          <text x="360" y={y + 26} className="qs-label">
            {label}
          </text>
          <circle cx="310" cy={y + 22} r="4" fill="#fff" stroke="#10b981" />
        </g>
      ))}
      <rect x="116" y="255" width="138" height="26" rx="8" fill="#ecfef7" />
      <text x="185" y="273" textAnchor="middle" className="qs-small-label">
        Context for your review
      </text>
    </Illustration>
  );
});

export const CompactActivityGraphic = memo(function CompactActivityGraphic() {
  return (
    <Illustration
      title="Submitted work and browser events for teacher review"
      description="A compact assessment sheet connects to submitted work, a focus event and teacher review. These are workflow illustrations."
      viewBox="0 0 340 260"
      className="qs-activity-compact"
    >
      <circle cx="127" cy="127" r="101" fill="#e5f6ee" />
      <Paper x={20} y={40} width={138} height={180} />
      <path
        d="M159 82h26v120m-26-60h26m0-60h18m-18 60h18m-18 60h18"
        stroke="#a6c8b7"
        strokeWidth="1.5"
      />
      <path
        d="M185 82v120"
        stroke="#059669"
        strokeWidth="2"
        strokeDasharray="3 13"
        className="qs-flow qs-motion"
      />
      {["Submitted", "Focus event", "Review"].map((label, i) => (
        <g key={label} className={`qs-event qs-event--${i} qs-motion`}>
          <rect
            x="202"
            y={62 + i * 60}
            width="125"
            height="39"
            rx="11"
            fill="#fff"
            stroke="#dce7e2"
          />
          <circle
            cx="216"
            cy={82 + i * 60}
            r="3"
            fill={i === 1 ? "#9a6700" : "#047857"}
          />
          <text x="226" y={87 + i * 60} className="qs-label">
            {label}
          </text>
        </g>
      ))}
    </Illustration>
  );
});

export const FocusGraphic = memo(function FocusGraphic() {
  return (
    <Illustration
      title="A browser focus change becomes a reviewable event"
      description="The quiz browser tab and a recorded focus event are connected by a dotted trail. No camera or video monitoring is involved."
      viewBox="0 0 400 220"
      className="qs-art--dark qs-focus"
    >
      <rect width="400" height="220" fill="#101b22" />
      <rect
        x="31"
        y="37"
        width="224"
        height="146"
        rx="14"
        fill="#192b32"
        stroke="#36525b"
      />
      <path d="M31 72h224" stroke="#36525b" />
      <rect x="44" y="47" width="101" height="25" rx="6" fill="#284c47" />
      <circle cx="58" cy="59" r="3" fill="#6ce8b7" />
      <text x="69" y="63" className="qs-small-label" fill="#a4f4d3">
        Quiz tab
      </text>
      <path
        d="M53 96h126M53 109h92"
        stroke="#4f6d73"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <rect
        x="51"
        y="132"
        width="181"
        height="27"
        rx="7"
        fill="#21473f"
        stroke="#3c7863"
      />
      <Check x={61} y={138} size={16} />
      <path
        d="M91 146h105"
        stroke="#74a493"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M253 114h46v23"
        stroke="#6ce8b7"
        strokeDasharray="3 6"
        className="qs-flow qs-motion"
      />
      <g className="qs-float qs-float--late qs-motion">
        <rect
          x="213"
          y="137"
          width="159"
          height="49"
          rx="12"
          fill="#ecfef7"
          stroke="#6ce8b7"
        />
        <circle cx="234" cy="161" r="5" fill="#059669" />
        <text x="250" y="166" className="qs-label">
          Focus event
        </text>
      </g>
    </Illustration>
  );
});

export const CopyGuardGraphic = memo(function CopyGuardGraphic() {
  return (
    <Illustration
      title="Copy and paste shortcuts are guarded during an attempt"
      description="A quiz page sits next to Control C and Control V keycaps, with a small lock indicating the browser interaction guard."
      viewBox="0 0 400 220"
    >
      <circle cx="136" cy="111" r="78" fill="#e9e8f1" />
      <Paper x={72} y={30} width={128} height={160} />
      <g className="qs-key qs-motion">
        <rect
          x="235"
          y="57"
          width="57"
          height="40"
          rx="9"
          fill="#fff"
          stroke="#d2d3e2"
        />
        <text x="263" y="82" textAnchor="middle" className="qs-label">
          Ctrl
        </text>
        <rect
          x="299"
          y="57"
          width="37"
          height="40"
          rx="9"
          fill="#fff"
          stroke="#d2d3e2"
        />
        <text x="317" y="82" textAnchor="middle" className="qs-label">
          C
        </text>
      </g>
      <g className="qs-key qs-key--late qs-motion">
        <rect
          x="235"
          y="113"
          width="57"
          height="40"
          rx="9"
          fill="#fff"
          stroke="#d2d3e2"
        />
        <text x="263" y="138" textAnchor="middle" className="qs-label">
          Ctrl
        </text>
        <rect
          x="299"
          y="113"
          width="37"
          height="40"
          rx="9"
          fill="#fff"
          stroke="#d2d3e2"
        />
        <text x="317" y="138" textAnchor="middle" className="qs-label">
          V
        </text>
      </g>
      <circle cx="191" cy="155" r="28" fill="#f5f3ff" stroke="#c4b5fd" />
      <Lock x={176} y={139} size={30} />
    </Illustration>
  );
});

export const PracticeGraphic = memo(function PracticeGraphic() {
  return (
    <Illustration
      title="Course learning and practice resources"
      description="A reviewed result connects to practice materials. The illustration represents the sequence, not a student's performance data."
      viewBox="0 0 360 210"
    >
      <rect
        x="31"
        y="51"
        width="123"
        height="112"
        rx="15"
        fill="#fff"
        stroke="#dce7e2"
      />
      <circle cx="92" cy="85" r="18" fill="#d0fbe9" />
      <Check x={80} y={73} />
      <path
        d="M55 122h73M66 137h51"
        stroke="#c0d8cb"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M155 106h48"
        stroke="#a4d5c0"
        strokeDasharray="3 6"
        className="qs-flow qs-motion"
      />
      <g className="qs-float qs-motion">
        <path
          d="M211 60q28-12 57 0v107q-29-12-57 0Zm57 0q28-12 57 0v107q-29-12-57 0Z"
          fill="#ecfef7"
          stroke="#97cdb5"
          strokeWidth="1.5"
        />
        <path
          d="M225 86h27m-27 14h27m-27 14h19m38-28h27m-27 14h27m-27 14h19"
          stroke="#9ac5b0"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <text x="92" y="188" textAnchor="middle" className="qs-small-label">
        Reviewed work
      </text>
      <text x="268" y="188" textAnchor="middle" className="qs-small-label">
        Practice next
      </text>
    </Illustration>
  );
});

export const CourseGraphic = memo(function CourseGraphic() {
  return (
    <Illustration
      title="Course submissions in one place"
      description="An assessment folder connects to three submitted answer sheets, representing a teacher's course view without invented student counts or scores."
      viewBox="0 0 360 210"
    >
      <path
        d="M38 65a12 12 0 0 1 12-12h51l13 17h38a12 12 0 0 1 12 12v71a12 12 0 0 1-12 12H50a12 12 0 0 1-12-12Z"
        fill="#e2f5ee"
        stroke="#9dcdb8"
      />
      <rect
        x="38"
        y="81"
        width="126"
        height="84"
        rx="12"
        fill="#fff"
        stroke="#b4dbcb"
      />
      <path
        d="M61 107h79M61 123h53"
        stroke="#b6cec4"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M165 124h29V63h23m-23 61h23m-23 0v60h23" stroke="#b4dbcb" />
      {[42, 103, 164].map((top, i) => (
        <g key={top} className={`qs-event qs-event--${i} qs-motion`}>
          <rect
            x="216"
            y={top}
            width="111"
            height="39"
            rx="10"
            fill="#fff"
            stroke="#dce7e2"
          />
          <rect
            x="229"
            y={top + 11}
            width="15"
            height="17"
            rx="3"
            fill="#ecfeff"
            stroke="#a5d9df"
          />
          <path
            d={`M254 ${top + 15}h56m-56 9h39`}
            stroke="#c3d4d5"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      ))}
    </Illustration>
  );
});

export const ExportGraphic = memo(function ExportGraphic() {
  return (
    <Illustration
      title="Assessment records and teacher feedback"
      description="A reviewed assessment table connects to a results record. The table contains illustration marks rather than real or simulated statistics."
      viewBox="0 0 360 210"
    >
      <rect
        x="30"
        y="47"
        width="177"
        height="117"
        rx="14"
        fill="#fff"
        stroke="#d9d5e7"
      />
      <path
        d="M30 80h177M30 108h177M30 136h177M87 80v84M153 80v84"
        stroke="#e7e4ef"
      />
      <rect x="47" y="60" width="57" height="6" rx="3" fill="#b7a7d5" />
      {[84, 112, 140].map((top, i) => (
        <g key={top} className={`qs-event qs-event--${i} qs-motion`}>
          <Check x={162} y={top} size={18} />
          <path
            d={`M47 ${top + 11}h24m32 0h32`}
            stroke="#c6bfd4"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      ))}
      <path
        d="M208 105h28"
        stroke="#aa9bbe"
        strokeDasharray="3 5"
        className="qs-flow qs-motion"
      />
      <g className="qs-float qs-float--late qs-motion">
        <path
          d="M255 53h42l29 29v72a12 12 0 0 1-12 12h-59a12 12 0 0 1-12-12V65a12 12 0 0 1 12-12Z"
          fill="#f5f3ff"
          stroke="#bfb2d9"
        />
        <path d="M297 53v23a6 6 0 0 0 6 6h23" stroke="#bfb2d9" />
        <text x="285" y="121" textAnchor="middle" className="qs-file-label">
          Notes
        </text>
        <path
          d="M273 139h25"
          stroke="#c4b5fd"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </Illustration>
  );
});

export const WorkflowGraphic = memo(function WorkflowGraphic() {
  return (
    <Illustration
      title="Create, schedule, review, grade"
      description="Four connected steps, from course questions to teacher feedback."
      viewBox="0 0 420 108"
      className="qs-workflow"
    >
      <path d="M60 39h300" stroke="#c4ddd1" strokeWidth="1.5" />
      <path
        d="M60 39h300"
        stroke="#059669"
        strokeWidth="2"
        strokeDasharray="3 21"
        className="qs-flow qs-motion"
      />
      {["Create", "Schedule", "Review", "Grade"].map((label, i) => (
        <g key={label}>
          <circle
            cx={54 + i * 104}
            cy="39"
            r="23"
            fill={i === 3 ? "#047857" : "#fff"}
            stroke={i === 3 ? "#047857" : "#c5ddd0"}
          />
          <text
            x={54 + i * 104}
            y="44"
            textAnchor="middle"
            className="qs-label"
            fill={i === 3 ? "#fff" : undefined}
          >
            {String(i + 1).padStart(2, "0")}
          </text>
          <text
            x={54 + i * 104}
            y="88"
            textAnchor="middle"
            className="qs-label"
          >
            {label}
          </text>
        </g>
      ))}
    </Illustration>
  );
});

export const PrivateResultsGraphic = memo(function PrivateResultsGraphic() {
  const id = useId().replace(/:/g, "");
  return (
    <Illustration
      title="Results are held until teacher review"
      description="A locked assessment sheet is held within the teacher's review space. Enrolment, scheduling and browser-event records support a human review. The lock remains closed throughout the illustration."
      viewBox="0 0 480 460"
      className="qs-art--dark qs-private"
    >
      <defs>
        <radialGradient id={`${id}-light`}>
          <stop stopColor="#10b981" stopOpacity=".18" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="240" cy="227" rx="227" ry="216" fill={`url(#${id}-light)`} />
      <path
        d="M80 76h43M80 76v43m320-43h-43m43 0v43M80 354h43m-43 0v-43m320 43h-43m43 0v-43"
        stroke="#36564d"
        strokeWidth="1.5"
      />
      <g transform="rotate(9 240 230)">
        <rect
          x="150"
          y="94"
          width="196"
          height="269"
          rx="19"
          fill="#0e2925"
          stroke="#2e5a4b"
        />
      </g>
      <g className="qs-float qs-motion">
        <Paper x={134} y={76} width={196} height={269} dark />
        <path
          d="M155 275h153M155 292h104"
          stroke="#2e4c49"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <rect x="156" y="313" width="81" height="7" rx="3.5" fill="#345e53" />
      </g>
      <circle cx="240" cy="220" r="56" fill="#0d3027" stroke="#477c68" />
      <circle
        cx="240"
        cy="220"
        r="47"
        stroke="#6ce8b7"
        strokeOpacity=".35"
        className="qs-trace qs-motion"
        pathLength="100"
      />
      <g color="#a4f4d3">
        <Lock x={213} y={190} size={54} />
      </g>
      <g>
        <rect
          x="33"
          y="121"
          width="129"
          height="39"
          rx="12"
          fill="#182d2c"
          stroke="#385b50"
        />
        <circle cx="52" cy="141" r="4" fill="#6ce8b7" />
        <text x="65" y="145" className="qs-small-label" fill="#c5dfd3">
          Reviewed
        </text>
      </g>
      <g className="qs-float qs-float--late qs-motion">
        <rect
          x="294"
          y="285"
          width="152"
          height="44"
          rx="12"
          fill="#14382b"
          stroke="#4a8164"
        />
        <Lock x={306} y={297} size={19} />
        <text x="336" y="312" className="qs-small-label" fill="#a4f4d3">
          Teacher grade
        </text>
      </g>
      <path d="M120 381h240" stroke="#2a483e" />
      <circle cx="120" cy="381" r="4" fill="#6ce8b7" />
      <circle cx="240" cy="381" r="4" fill="#6ce8b7" />
      <circle cx="360" cy="381" r="4" fill="#0b1c17" stroke="#6ce8b7" />
      <text
        x="120"
        y="408"
        textAnchor="middle"
        className="qs-small-label"
        fill="#a0b9ae"
      >
        Submitted
      </text>
      <text
        x="240"
        y="408"
        textAnchor="middle"
        className="qs-small-label"
        fill="#a0b9ae"
      >
        Reviewed
      </text>
      <text
        x="360"
        y="408"
        textAnchor="middle"
        className="qs-small-label"
        fill="#a0b9ae"
      >
        Feedback
      </text>
    </Illustration>
  );
});
