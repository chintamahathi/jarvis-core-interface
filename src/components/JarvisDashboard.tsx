import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BatteryCharging,
  Bluetooth,
  ChevronRight,
  CloudSun,
  Cpu,
  Gauge,
  LocateFixed,
  MapPin,
  Mic,
  Network,
  Radio,
  Settings2,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Volume2,
  Wifi,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Movable, resetLayout } from "@/components/Movable";
import { cn } from "@/lib/utils";
import {
  useJarvisAgent,
  VoiceState,
  TelemetryData,
  ActivityItem,
  SystemLogEntry,
  DebugInfo,
} from "@/hooks/useJarvisAgent";

type View = "HOME" | "DASHBOARD" | "SETTINGS" | "ABOUT";

const navItems: View[] = ["HOME", "DASHBOARD", "SETTINGS", "ABOUT"];

function HudPanel({
  title,
  icon,
  className,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Movable id={`panel:${title}`} className={className}>
      <section className="hud-panel group">
        <div className="hud-panel-corner" aria-hidden="true" />
        <header className="hud-panel-header">
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          <span className="status-dot" aria-label="Online" />
        </header>
        {children}
      </section>
    </Movable>
  );
}

function LocationPanel() {
  return (
    <HudPanel title="LOCATION" icon={<LocateFixed className="size-3" />}>
      <div className="location-body">
        <div className="map-plot" aria-hidden="true">
          <span className="map-ring" />
          <span className="map-ping" />
          <svg viewBox="0 0 130 70" role="presentation">
            <path d="M2 57L24 45l13 6 22-31 18 16 18-9 33 24" />
            <path d="M8 16h108M15 33h102M24 51h95M27 3v64M60 3v64M94 3v64" />
          </svg>
        </div>
        <div className="location-copy">
          <p className="location-city"><span>🇮🇳</span> Local Station</p>
          <p>Windows Host Terminal</p>
          <div className="coordinate-row">
            <span>SYS HOST // WIN32</span>
            <span>SECURE LOCAL LOOP</span>
          </div>
        </div>
      </div>
    </HudPanel>
  );
}

function StatusPanel({
  expanded = false,
  telemetry,
}: {
  expanded?: boolean;
  telemetry: TelemetryData;
}) {
  const batteryTone =
    telemetry.batteryPercent < 20
      ? "danger"
      : telemetry.batteryPercent < 50
      ? "warning"
      : "active";

  const telemetryItems: { label: string; value: string; icon: any; tone: string; meter?: number }[] = [
    {
      label: "BATTERY",
      value: `${telemetry.batteryPercent}%`,
      icon: BatteryCharging,
      tone: batteryTone,
      meter: telemetry.batteryPercent,
    },
    {
      label: "NETWORK",
      value: telemetry.networkStatus,
      icon: Wifi,
      tone: telemetry.networkStatus === "ONLINE" ? "active" : "danger",
    },
    {
      label: "CONNECTION",
      value: telemetry.networkType,
      icon: Network,
      tone: "active",
    },
    {
      label: "BLUETOOTH",
      value: "READY",
      icon: Bluetooth,
      tone: "active",
    },
  ];

  return (
    <HudPanel title="SYSTEM STATUS" icon={<Gauge className="size-3" />}>
      <div className={cn("telemetry-grid", expanded && "telemetry-grid-expanded")}>
        {telemetryItems.map(({ label, value, icon: Icon, tone, meter }) => (
          <div className="telemetry-cell" key={label}>
            <Icon className="telemetry-icon" />
            <div className="min-w-0">
              <span>{label}</span>
              <strong className={`tone-${tone}`}>{value}</strong>
              {label === "BATTERY" && (
                <i className="battery-meter">
                  <b style={{ width: `${meter}%` }} />
                </i>
              )}
            </div>
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

function ActivityPanel({
  activities,
  voiceState,
}: {
  activities: ActivityItem[];
  voiceState: VoiceState;
}) {
  return (
    <HudPanel title="ACTIVITY MONITOR" icon={<Activity className="size-3" />}>
      <div className="response-state">
        <Volume2 /> <span>{voiceState}</span>
      </div>
      <div className="activity-stream">
        {activities.map((act) => (
          <div className="activity-row" key={act.id}>
            <time>{act.time}</time>
            <i />
            <span className={`tone-${act.tone}`}>{act.state}</span>
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

function JarvisCore({ state }: { state: VoiceState }) {
  const points = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: 16 + ((i * 37) % 70),
        y: 12 + ((i * 53) % 76),
        delay: (i % 7) * 0.42,
      })),
    []
  );

  return (
    <div className={cn("core-stage", `core-${state.toLowerCase()}`)}>
      <div className="core-kicker">
        <Cpu /> J.A.R.V.I.S. CORE <span>ONLINE</span>
      </div>
      <div className="core-assembly" role="img" aria-label={`JARVIS core ${state.toLowerCase()}`}>
        <div className="core-reticle reticle-one" />
        <div className="core-reticle reticle-two" />
        <div className="orbital orbital-a"><i /><i /><i /></div>
        <div className="orbital orbital-b"><i /><i /></div>
        <div className="orbital orbital-c" />
        <div className="core-orb">
          <div className="orb-scan" />
          <div className="orb-contour" />
          <div className="orb-contour orb-contour-two" />
          <div className="orb-eye" />
          {points.map((point) => (
            <span
              className="orb-particle"
              key={point.id}
              style={{ left: `${point.x}%`, top: `${point.y}%`, animationDelay: `${point.delay}s` }}
            />
          ))}
        </div>
        <div className="core-axis axis-horizontal" />
        <div className="core-axis axis-vertical" />
      </div>
      <div className="core-state"><span /> {state}</div>
    </div>
  );
}

function Waveform({ active }: { active: boolean }) {
  return (
    <div className={cn("waveform", active && "waveform-active")} aria-hidden="true">
      {Array.from({ length: 17 }, (_, index) => (
        <i key={index} style={{ animationDelay: `${index * -0.08}s` }} />
      ))}
    </div>
  );
}

function VoiceControl({
  state,
  executingLabel,
  interimTranscript,
  onActivate,
}: {
  state: VoiceState;
  executingLabel?: string | null;
  interimTranscript?: string;
  onActivate: () => void;
}) {
  const displayText =
    state === "LISTENING" && interimTranscript
      ? interimTranscript
      : state === "EXECUTING" && executingLabel
      ? executingLabel
      : state === "IDLE"
      ? "TAP TO SPEAK"
      : state;

  return (
    <div className="voice-control">
      <Waveform active={state !== "IDLE"} />
      <Button
        variant="hud"
        size="icon"
        className={cn("mic-button", state !== "IDLE" && "mic-button-active")}
        onClick={onActivate}
        disabled={state !== "IDLE"}
        aria-label={state === "IDLE" ? "Activate JARVIS voice control" : state}
      >
        <Mic />
        <span className="mic-ring" />
      </Button>
      <p className="max-w-[280px] truncate text-center">{displayText}</p>
      <span className="voice-sequence">VOICE CHANNEL // 01</span>
    </div>
  );
}

function SystemInfo({
  now,
  telemetry,
  commandCount,
}: {
  now: Date;
  telemetry: TelemetryData;
  commandCount: number;
}) {
  const clock = now.toLocaleTimeString("en-GB", { hour12: false });
  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  return (
    <HudPanel title="SYSTEM-INFO" icon={<Radio className="size-3" />} className="system-info">
      <div className="clock">{clock}</div>
      <div className="date-line">{date}</div>
      <div className="weather-row">
        <CloudSun />
        <div><strong>28°C</strong><span>CLEAR</span></div>
      </div>
      <div className="system-location"><MapPin /> Windows Host</div>
      <div className="info-divider"><i /></div>
      <div className="stat-pair">
        <div><span>UPTIME</span><strong>{telemetry.uptimeFormatted}</strong></div>
        <div><span>COMMANDS</span><strong>{commandCount}</strong></div>
      </div>
    </HudPanel>
  );
}

function SystemLog({
  lastCommand,
  lastResponse,
  systemLogs,
}: {
  lastCommand: string;
  lastResponse: string;
  systemLogs: SystemLogEntry[];
}) {
  return (
    <HudPanel title="SYSTEM_LOG // J.A.R.V.I.S." icon={<TerminalSquare className="size-3" />} className="system-log">
      <div className="command-line">
        <ChevronRight />
        <span>USER&gt;</span> {lastCommand}
        <i />
      </div>
      <div className="text-[7.5px] font-mono text-muted-foreground mt-0.5 truncate">
        JARVIS&gt; {lastResponse}
      </div>
      {systemLogs && systemLogs.length > 0 && (
        <div className="mt-2 space-y-0.5 max-h-[88px] overflow-y-auto font-mono text-[7.5px] border-t border-border/40 pt-1">
          {systemLogs.slice(-4).map((entry) => (
            <div key={entry.id} className="flex items-center gap-1.5 leading-tight">
              <span className={cn(
                "px-1 py-0.2 rounded text-[6.5px] font-bold",
                entry.level === "INFO" && "text-cyan-400 bg-cyan-950/40",
                entry.level === "SUCCESS" && "text-emerald-400 bg-emerald-950/40",
                entry.level === "WARN" && "text-amber-400 bg-amber-950/40",
                entry.level === "ERROR" && "text-rose-400 bg-rose-950/40"
              )}>
                [{entry.level}]
              </span>
              <span className="text-foreground/90 truncate">{entry.text}</span>
            </div>
          ))}
        </div>
      )}
    </HudPanel>
  );
}

function DeveloperDebugPanel({
  debugInfo,
  onClose,
}: {
  debugInfo: DebugInfo;
  onClose: () => void;
}) {
  return (
    <div className="hud-debug-panel animate-scale-in">
      <div className="hud-debug-header">
        <span className="flex items-center gap-2">
          <TerminalSquare className="size-3 text-primary" />
          DEVELOPER ACTION & INTENT PIPELINE
        </span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-primary transition-colors text-[11px] px-1"
          aria-label="Close debug console"
        >
          ✕
        </button>
      </div>
      <div className="hud-debug-grid">
        <div>
          <span>USER COMMAND</span>
          <strong>{debugInfo.userCommand}</strong>
        </div>
        <div>
          <span>TRANSCRIPT</span>
          <strong>{debugInfo.transcript}</strong>
        </div>
        <div>
          <span>INTENT</span>
          <strong className="text-primary">{debugInfo.intent}</strong>
        </div>
        <div>
          <span>TARGET</span>
          <strong>{debugInfo.target}</strong>
        </div>
        <div>
          <span>PERMISSION</span>
          <strong>{debugInfo.permission}</strong>
        </div>
        <div>
          <span>LOCAL AGENT</span>
          <strong className={debugInfo.agentStatus === "CONNECTED" ? "text-success" : "text-danger"}>
            ● {debugInfo.agentStatus}
          </strong>
        </div>
        <div>
          <span>ACTION</span>
          <strong>{debugInfo.action}</strong>
        </div>
        <div>
          <span>RESULT</span>
          <strong
            className={
              debugInfo.result === "SUCCESS"
                ? "text-success"
                : debugInfo.result === "FAILED"
                ? "text-danger"
                : "text-warning"
            }
          >
            {debugInfo.result}
          </strong>
        </div>
      </div>
    </div>
  );
}

function ExpandedDashboard({
  telemetry,
  latencyMs,
}: {
  telemetry: TelemetryData;
  latencyMs: number;
}) {
  return (
    <div className="expanded-overlay animate-fade-in">
      <HudPanel title="EXTENDED DIAGNOSTICS" icon={<Cpu className="size-3" />}>
        <div className="diagnostics-grid">
          <div>
            <span>NEURAL LOAD</span>
            <strong>{telemetry.cpuUsagePercent}%</strong>
            <i><b style={{ width: `${telemetry.cpuUsagePercent}%` }} /></i>
          </div>
          <div>
            <span>MEMORY MATRIX</span>
            <strong>{telemetry.memoryUsagePercent}% ({telemetry.freeMemoryGB}GB FREE)</strong>
            <i><b style={{ width: `${telemetry.memoryUsagePercent}%` }} /></i>
          </div>
          <div>
            <span>SECURITY GRID</span>
            <strong>SECURE</strong>
            <i><b style={{ width: `92%` }} /></i>
          </div>
          <div>
            <span>RESPONSE LATENCY</span>
            <strong>{latencyMs}ms</strong>
            <i><b style={{ width: `${Math.min(100, latencyMs * 3)}%` }} /></i>
          </div>
        </div>
      </HudPanel>
    </div>
  );
}

function SettingsView({
  showDebug,
  onToggleDebug,
  onClose,
}: {
  showDebug: boolean;
  onToggleDebug: () => void;
  onClose: () => void;
}) {
  const [options, setOptions] = useState([true, true, false, true]);
  const labels = ["AMBIENT SCANNING", "VOICE FEEDBACK", "PRIORITY ALERTS", "HOLOGRAPHIC TRACKING"];
  return (
    <div className="modal-view animate-scale-in">
      <div className="modal-heading">
        <div><span>CORE CONFIGURATION</span><h2>SETTINGS</h2></div>
        <Button variant="hudGhost" size="icon" onClick={onClose} aria-label="Close settings"><X /></Button>
      </div>
      <div className="settings-list">
        {labels.map((label, i) => (
          <button
            key={label}
            className="setting-row"
            onClick={() => setOptions((current) => current.map((item, index) => (index === i ? !item : item)))}
          >
            <span><Settings2 />{label}</span>
            <i className={options[i] ? "is-on" : ""}><b /></i>
          </button>
        ))}

        <button className="setting-row" onClick={onToggleDebug}>
          <span><TerminalSquare />DEVELOPER DEBUG CONSOLE</span>
          <i className={showDebug ? "is-on" : ""}><b /></i>
        </button>
      </div>
      <p className="modal-note">LOCAL WINDOWS CONTROLLER: PORT 8765 // VERIFIED PIPELINE ACTIVE.</p>
    </div>
  );
}

function AboutView({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-view about-view animate-scale-in">
      <div className="modal-heading">
        <div><span>INTELLIGENCE PROFILE</span><h2>J.A.R.V.I.S.</h2></div>
        <Button variant="hudGhost" size="icon" onClick={onClose} aria-label="Close information"><X /></Button>
      </div>
      <div className="about-mark"><Sparkles /></div>
      <p>JUST A RATHER VERY INTELLIGENT SYSTEM</p>
      <div className="about-copy">
        A real voice-controlled Windows personal assistant interface engineered for situational awareness, live system telemetry, and autonomous local command execution.
      </div>
      <div className="about-tags"><span>MARK VII</span><span>CORE ONLINE</span><span>WINDOWS LOCAL AGENT</span></div>
    </div>
  );
}

const bgParticles = Array.from({ length: 42 }, (_, i) => ({
  left: `${(i * 37 + 13) % 100}%`,
  top: `${(i * 53 + 7) % 100}%`,
  size: 1 + ((i * 7) % 3),
  duration: 9 + ((i * 11) % 14),
  delay: -((i * 17) % 20),
  opacity: 0.25 + ((i * 13) % 40) / 100,
}));

function BgParticles() {
  return (
    <div className="bg-particles" aria-hidden="true">
      {bgParticles.map((p, i) => (
        <span
          key={i}
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            ["--p-opacity" as string]: p.opacity,
          }}
        />
      ))}
    </div>
  );
}

export function JarvisDashboard() {
  const [activeView, setActiveView] = useState<View>("HOME");
  const [showDebug, setShowDebug] = useState(true);
  const [commandInput, setCommandInput] = useState("");
  const [now, setNow] = useState(() => new Date());

  const {
    voiceState,
    executingLabel,
    interimTranscript,
    isConnected,
    latencyMs,
    telemetry,
    activities,
    systemLogs,
    lastCommand,
    lastResponse,
    commandCount,
    pendingConfirmation,
    debugInfo,
    startListening,
    resolveConfirmation,
    sendCommandText,
  } = useJarvisAgent();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const hour = now.getHours();
  const greetingText =
    hour < 12
      ? "GOOD MORNING, SIR."
      : hour < 18
      ? "GOOD AFTERNOON, SIR."
      : "GOOD EVENING, SIR.";

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commandInput.trim()) {
      sendCommandText(commandInput.trim());
      setCommandInput("");
    }
  };

  return (
    <main className="jarvis-shell">
      <div className="bg-glow bg-glow-a" aria-hidden="true" />
      <div className="bg-glow bg-glow-b" aria-hidden="true" />
      <div className="ambient-grid" aria-hidden="true" />
      <BgParticles />
      <div className="bg-sweep" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="hud-frame" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="edge-markers" aria-hidden="true">
        <span>SYS.48</span>
        <span>LATENCY {String(latencyMs).padStart(3, "0")}MS</span>
        <button
          onClick={() => setShowDebug((prev) => !prev)}
          className="hover:text-primary transition-colors cursor-pointer"
        >
          CONSOLE: {showDebug ? "ACTIVE" : "HIDDEN"}
        </button>
      </div>

      <header className="topbar">
        <div className="brand-block">
          <strong>J.A.R.V.I.S.</strong>
          <span>JUST A RATHER VERY INTELLIGENT SYSTEM</span>
        </div>
        <nav aria-label="Primary navigation">
          {navItems.map((item) => (
            <Button
              key={item}
              variant="hudGhost"
              size="sm"
              className={cn("nav-button", activeView === item && "nav-active")}
              onClick={() => setActiveView(item)}
            >
              {item}
            </Button>
          ))}
        </nav>
        <div className="top-status">
          <span>LOCAL AGENT</span>
          <strong style={{ color: isConnected ? "var(--success)" : "var(--danger)" }}>
            <i style={{ background: isConnected ? "var(--success)" : "var(--danger)" }} />{" "}
            {isConnected ? "CONNECTED" : "OFFLINE"}
          </strong>
          <Button variant="hudGhost" size="sm" className="layout-reset" onClick={resetLayout}>
            RESET LAYOUT
          </Button>
        </div>
      </header>

      <div className="hud-layout">
        <aside className="left-rail">
          <LocationPanel />
          <StatusPanel expanded={activeView === "DASHBOARD"} telemetry={telemetry} />
          <ActivityPanel activities={activities} voiceState={voiceState} />
        </aside>

        <section className="central-zone">
          <Movable id="core"><JarvisCore state={voiceState} /></Movable>
          <Movable id="greeting">
            <div className="greeting">
              <span>{greetingText}</span>
              <small>AT YOUR SERVICE, SIR.</small>
              <i>— J.A.R.V.I.S.</i>
            </div>
          </Movable>

          {/* Real Command Input for Direct Testing of Voice & Action Pipeline */}
          <form onSubmit={handleCommandSubmit} className="hud-command-bar">
            <ChevronRight />
            <input
              type="text"
              placeholder='Type a command to test (e.g. "open youtube", "open vs code")...'
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              aria-label="Direct Command Input"
            />
            <Button type="submit" variant="hud" size="sm" className="h-5 px-2 text-[8px]">
              RUN
            </Button>
          </form>

          <VoiceControl
            state={voiceState}
            executingLabel={executingLabel}
            interimTranscript={interimTranscript}
            onActivate={startListening}
          />

          {/* Tactical Confirmation Dialog for Destructive / Power Operations */}
          {pendingConfirmation && (
            <div className="hud-confirm-overlay animate-scale-in">
              <h3>AUTHORIZATION REQUIRED</h3>
              <p>{pendingConfirmation.prompt}</p>
              <div className="hud-confirm-actions">
                <Button variant="hud" size="sm" onClick={() => resolveConfirmation(true)}>
                  CONFIRM
                </Button>
                <Button variant="hudGhost" size="sm" onClick={() => resolveConfirmation(false)}>
                  ABORT
                </Button>
              </div>
            </div>
          )}

          {/* Developer Debug Console */}
          {showDebug && (
            <DeveloperDebugPanel
              debugInfo={debugInfo}
              onClose={() => setShowDebug(false)}
            />
          )}

          {activeView === "DASHBOARD" && (
            <ExpandedDashboard telemetry={telemetry} latencyMs={latencyMs} />
          )}
          {activeView === "SETTINGS" && (
            <SettingsView
              showDebug={showDebug}
              onToggleDebug={() => setShowDebug((prev) => !prev)}
              onClose={() => setActiveView("HOME")}
            />
          )}
          {activeView === "ABOUT" && <AboutView onClose={() => setActiveView("HOME")} />}
        </section>

        <aside className="right-rail">
          <SystemInfo now={now} telemetry={telemetry} commandCount={commandCount} />
          <SystemLog
            lastCommand={lastCommand}
            lastResponse={lastResponse}
            systemLogs={systemLogs}
          />
          <Movable id="security">
            <div className="security-readout">
              <ShieldCheck />
              <span>SECURITY GRID</span>
              <strong>ENFORCED</strong>
            </div>
          </Movable>
        </aside>
      </div>
    </main>
  );
}