import os from "node:os";
import fs from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface SystemTelemetry {
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  totalMemoryGB: string;
  freeMemoryGB: string;
  usedMemoryGB: string;
  batteryPercent: number;
  isBatteryCharging: boolean;
  uptimeFormatted: string;
  uptimeSeconds: number;
  diskFreeGB?: string;
  diskTotalGB?: string;
  diskUsagePercent?: number;
  networkStatus: "ONLINE" | "OFFLINE";
  networkType: string;
  timestamp: string;
}

let lastCpuInfo: { idle: number; total: number } | null = null;
let cachedBatteryPercent = 100;
let cachedBatteryCharging = false;
let lastBatteryFetchTime = 0;

function getCpuTimes() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type as keyof typeof cpu.times];
    }
    idle += cpu.times.idle;
  }
  return { idle, total };
}

export function getCpuUsagePercent(): number {
  const current = getCpuTimes();
  if (!lastCpuInfo) {
    lastCpuInfo = current;
    return 15; // default initial baseline
  }
  const idleDelta = current.idle - lastCpuInfo.idle;
  const totalDelta = current.total - lastCpuInfo.total;
  lastCpuInfo = current;

  if (totalDelta <= 0) return 0;
  const usage = 100 - Math.round((idleDelta / totalDelta) * 100);
  return Math.max(0, Math.min(100, usage));
}

export function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export async function getBatteryTelemetry(): Promise<{ percent: number; isCharging: boolean }> {
  const now = Date.now();
  // Cache battery reading for 10 seconds to keep CPU overhead minimal
  if (now - lastBatteryFetchTime < 10000 && lastBatteryFetchTime > 0) {
    return { percent: cachedBatteryPercent, isCharging: cachedBatteryCharging };
  }

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "$b = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue; if ($b) { Write-Output ($b.EstimatedChargeRemaining.ToString() + ',' + $b.BatteryStatus.ToString()) } else { Write-Output '100,2' }"`,
      { timeout: 3000 }
    );
    const parts = stdout.trim().split(",");
    if (parts.length >= 1 && parts[0]) {
      const charge = parseInt(parts[0], 10);
      if (!isNaN(charge)) {
        cachedBatteryPercent = Math.max(0, Math.min(100, charge));
      }
      if (parts.length >= 2) {
        const status = parseInt(parts[1], 10);
        // Status 2 = Normal/Discharging, 6 = Charging, 7 = Charging and High, etc.
        cachedBatteryCharging = status === 6 || status === 7 || status === 8 || status === 9;
      }
    }
  } catch {
    // If desktop with no battery or query fails, default to 100%
    cachedBatteryPercent = 100;
    cachedBatteryCharging = false;
  }

  lastBatteryFetchTime = now;
  return { percent: cachedBatteryPercent, isCharging: cachedBatteryCharging };
}

export function getDiskTelemetry(): { freeGB: string; totalGB: string; usagePercent: number } {
  try {
    const stats = fs.statfsSync("C:\\");
    const totalBytes = stats.bsize * stats.blocks;
    const freeBytes = stats.bsize * stats.bavail;
    const usedBytes = totalBytes - freeBytes;
    const usagePercent = Math.round((usedBytes / totalBytes) * 100);
    return {
      freeGB: (freeBytes / (1024 ** 3)).toFixed(1),
      totalGB: (totalBytes / (1024 ** 3)).toFixed(1),
      usagePercent,
    };
  } catch {
    return { freeGB: "50.0", totalGB: "512.0", usagePercent: 50 };
  }
}

export async function collectSystemTelemetry(): Promise<SystemTelemetry> {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryUsagePercent = Math.round((usedMem / totalMem) * 100);

  const cpuUsagePercent = getCpuUsagePercent();
  const uptimeSeconds = Math.round(os.uptime());
  const uptimeFormatted = formatUptime(uptimeSeconds);

  const battery = await getBatteryTelemetry();
  const disk = getDiskTelemetry();

  // Network
  const netInterfaces = os.networkInterfaces();
  const hasActiveInterface = Object.values(netInterfaces).some((list) =>
    list?.some((iface) => !iface.internal && iface.address)
  );

  return {
    cpuUsagePercent,
    memoryUsagePercent,
    totalMemoryGB: (totalMem / (1024 ** 3)).toFixed(1),
    freeMemoryGB: (freeMem / (1024 ** 3)).toFixed(1),
    usedMemoryGB: (usedMem / (1024 ** 3)).toFixed(1),
    batteryPercent: battery.percent,
    isBatteryCharging: battery.isCharging,
    uptimeFormatted,
    uptimeSeconds,
    diskFreeGB: disk.freeGB,
    diskTotalGB: disk.totalGB,
    diskUsagePercent: disk.usagePercent,
    networkStatus: hasActiveInterface ? "ONLINE" : "OFFLINE",
    networkType: "WIFI / LAN",
    timestamp: new Date().toISOString(),
  };
}
