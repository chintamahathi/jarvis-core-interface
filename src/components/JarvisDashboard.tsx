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

type View = "HOME" | "DASHBOARD" | "SETTINGS" | "ABOUT";
type VoiceState = "IDLE" | "LISTENING" | "PROCESSING" | "RESPONDING";

const activityRows = [
  ["16:14:52", "RESPONDING", "warning"],
  ["16:14:31", "LISTENING", "active"],
  ["16:14:21", "COMMAND RECEIVED", "active"],
  ["16:14:05", "PROCESSING", "active"],
  ["16:13:49", "LISTENING", "active"],
  ["16:13:34", "STANDBY", "muted"],
  ["16:13:20", "DISCONNECTED", "danger"],
] as const;

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
          <p className="location-city"><span>🇮🇳</span> Bengaluru</p>
          <p>Karnataka, India</p>
          <div className="coordinate-row">
            <span>LAT 12.9716° N</span>
            <span>LON 77.5946° E</span>
          </div>
        </div>
      </div>
    </HudPanel>
  );
}

const telemetry = [
  { label: "BATTERY", value: "61%", icon: BatteryCharging, tone: "warning" },
  { label: "NETWORK", value: "ONLINE", icon: Wifi, tone: "active" },
  { label: "CONNECTION", value: "4G", icon: Network, tone: "active" },
  { label: "BLUETOOTH", value: "READY", icon: Bluetooth, tone: "active" },
] as const;

function StatusPanel({ expanded = false }: { expanded?: boolean }) {
  return (
    <HudPanel title="SYSTEM STATUS" icon={<Gauge className="size-3" />}>
      <div className={cn("telemetry-grid", expanded && "telemetry-grid-expanded")}>
        {telemetry.map(({ label, value, icon: Icon, tone }) => (
          <div className="telemetry-cell" key={label}>
            <Icon className="telemetry-icon" />
            <div className="min-w-0">
              <span>{label}</span>
              <strong className={`tone-${tone}`}>{value}</strong>
              {label === "BATTERY" && <i className="battery-meter"><b /></i>}
            </div>
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

function ActivityPanel() {
  return (
    <HudPanel title="ACTIVITY MONITOR" icon={<Activity className="size-3" />}>
      <div className="response-state"><Volume2 /> <span>RESPONDING</span></div>
      <div className="activity-stream">
        {activityRows.map(([time, state, tone]) => (
          <div className="activity-row" key={time}>
            <time>{time}</time><i /><span className={`tone-${tone}`}>{state}</span>
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

function JarvisCore({ state }: { state: VoiceState }) {
  const points = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: 16 + ((i * 37) % 70),
    y: 12 + ((i * 53) % 76),
    delay: (i % 7) * 0.42,
  })), []);

  return (
    <div className={cn("core-stage", `core-${state.toLowerCase()}`)}>
      <div className="core-kicker"><Cpu /> J.A.R.V.I.S. CORE <span>ONLINE</span></div>
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
      {Array.from({ length: 17 }, (_, index) => <i key={index} style={{ animationDelay: `${index * -0.08}s` }} />)}
    </div>
  );
}

function VoiceControl({ state, onActivate }: { state: VoiceState; onActivate: () => void }) {
  return (
    <div className="voice-control">
      <Waveform active={state !== "IDLE"} />
      <Button
        variant="hud"
        size="icon"
        className={cn("mic-button", state !== "IDLE" && "mic-button-active")}
        onClick={onActivate}
        disabled={state !== "IDLE"}
        aria-label={state === "IDLE" ? "Start simulated voice interaction" : state}
      >
        <Mic />
        <span className="mic-ring" />
      </Button>
      <p>{state === "IDLE" ? "TAP TO SPEAK" : state}</p>
      <span className="voice-sequence">VOICE CHANNEL // 01</span>
    </div>
  );
}

function SystemInfo({ now }: { now: Date }) {
  const clock = now.toLocaleTimeString("en-GB", { hour12: false });
  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  return (
    <HudPanel title="SYSTEM-INFO" icon={<Radio className="size-3" />} className="system-info">
      <div className="clock">{clock}</div>
      <div className="date-line">{date}</div>
      <div className="weather-row">
        <CloudSun />
        <div><strong>30°C</strong><span>CLEAR</span></div>
      </div>
      <div className="system-location"><MapPin /> Bengaluru</div>
      <div className="info-divider"><i /></div>
      <div className="stat-pair">
        <div><span>UPTIME</span><strong>10h</strong></div>
        <div><span>COMMANDS</span><strong>3</strong></div>
      </div>
    </HudPanel>
  );
}

function SystemLog() {
  return (
    <HudPanel title="SYSTEM_LOG // J.A.R.V.I.S." icon={<TerminalSquare className="size-3" />} className="system-log">
      <div className="command-line"><ChevronRight /><span>USER&gt;</span> initialize lab security systems<i /></div>
    </HudPanel>
  );
}

function ExpandedDashboard() {
  return (
    <div className="expanded-overlay animate-fade-in">
      <HudPanel title="EXTENDED DIAGNOSTICS" icon={<Cpu className="size-3" />}>
        <div className="diagnostics-grid">
          {["NEURAL LOAD", "MEMORY MATRIX", "SECURITY GRID", "RESPONSE LATENCY"].map((label, i) => (
            <div key={label}><span>{label}</span><strong>{["23%", "48%", "SECURE", "12ms"][i]}</strong><i><b style={{ width: `${[23, 48, 92, 38][i]}%` }} /></i></div>
          ))}
        </div>
      </HudPanel>
    </div>
  );
}

function SettingsView({ onClose }: { onClose: () => void }) {
  const [options, setOptions] = useState([true, true, false, true]);
  const labels = ["AMBIENT SCANNING", "VOICE FEEDBACK", "PRIORITY ALERTS", "HOLOGRAPHIC TRACKING"];
  return (
    <div className="modal-view animate-scale-in">
      <div className="modal-heading"><div><span>CORE CONFIGURATION</span><h2>SETTINGS</h2></div><Button variant="hudGhost" size="icon" onClick={onClose} aria-label="Close settings"><X /></Button></div>
      <div className="settings-list">
        {labels.map((label, i) => (
          <button key={label} className="setting-row" onClick={() => setOptions((current) => current.map((item, index) => index === i ? !item : item))}>
            <span><Settings2 />{label}</span><i className={options[i] ? "is-on" : ""}><b /></i>
          </button>
        ))}
      </div>
      <p className="modal-note">CONFIGURATION CHANGES ARE LOCAL TO THIS SESSION.</p>
    </div>
  );
}

function AboutView({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-view about-view animate-scale-in">
      <div className="modal-heading"><div><span>INTELLIGENCE PROFILE</span><h2>J.A.R.V.I.S.</h2></div><Button variant="hudGhost" size="icon" onClick={onClose} aria-label="Close information"><X /></Button></div>
      <div className="about-mark"><Sparkles /></div>
      <p>JUST A RATHER VERY INTELLIGENT SYSTEM</p>
      <div className="about-copy">A private adaptive intelligence interface engineered for situational awareness, precision assistance, and calm command execution.</div>
      <div className="about-tags"><span>MARK VII</span><span>CORE ONLINE</span><span>LOCAL SIMULATION</span></div>
    </div>
  );
}

export function JarvisDashboard() {
  const [activeView, setActiveView] = useState<View>("HOME");
  const [voiceState, setVoiceState] = useState<VoiceState>("IDLE");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activateVoice = () => {
    if (voiceState !== "IDLE") return;
    setVoiceState("LISTENING");
    window.setTimeout(() => setVoiceState("PROCESSING"), 1800);
    window.setTimeout(() => setVoiceState("RESPONDING"), 3600);
    window.setTimeout(() => setVoiceState("IDLE"), 5600);
  };

  return (
    <main className="jarvis-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="hud-frame" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="edge-markers" aria-hidden="true"><span>SYS.48</span><span>LATENCY 012MS</span><span>SECURE CHANNEL</span></div>

      <header className="topbar">
        <div className="brand-block">
          <strong>J.A.R.V.I.S.</strong>
          <span>JUST A RATHER VERY INTELLIGENT SYSTEM</span>
        </div>
        <nav aria-label="Primary navigation">
          {navItems.map((item) => (
            <Button key={item} variant="hudGhost" size="sm" className={cn("nav-button", activeView === item && "nav-active")} onClick={() => setActiveView(item)}>{item}</Button>
          ))}
        </nav>
        <div className="top-status"><span>SYSTEM STATUS</span><strong><i /> SYSTEM ONLINE</strong></div>
      </header>

      <div className="hud-layout">
        <aside className="left-rail">
          <LocationPanel />
          <StatusPanel expanded={activeView === "DASHBOARD"} />
          <ActivityPanel />
        </aside>

        <section className="central-zone">
          <JarvisCore state={voiceState} />
          <div className="greeting">
            <span>GOOD AFTERNOON, SIR.</span>
            <small>AT YOUR SERVICE, SIR.</small>
            <i>— J.A.R.V.I.S.</i>
          </div>
          <VoiceControl state={voiceState} onActivate={activateVoice} />
          {activeView === "DASHBOARD" && <ExpandedDashboard />}
          {activeView === "SETTINGS" && <SettingsView onClose={() => setActiveView("HOME")} />}
          {activeView === "ABOUT" && <AboutView onClose={() => setActiveView("HOME")} />}
        </section>

        <aside className="right-rail">
          <SystemInfo now={now} />
          <SystemLog />
          <div className="security-readout"><ShieldCheck /><span>LAB SECURITY</span><strong>ARMED</strong></div>
        </aside>
      </div>
    </main>
  );
}