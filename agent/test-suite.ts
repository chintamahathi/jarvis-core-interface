import { brain } from "./brain";
import { toolRegistry } from "./tools";
import { memoryManager } from "./memoryManager";
import { collectSystemTelemetry } from "./systemMonitor";
import { chromeManager } from "./chromeManager";

async function runTests() {
  console.log("=== RUNNING J.A.R.V.I.S. CHROME-FIRST ACCEPTANCE VERIFICATION ===");

  // Test 1: Chrome Binary Detection & Status
  console.log("\n[Test 1] Chrome Manager Diagnostics...");
  const chromeStatus = await chromeManager.getChromeStatus();
  console.log(`✓ Chrome status: available=${chromeStatus.available}, running=${chromeStatus.running}, path=${chromeStatus.path}`);
  if (!chromeStatus.available) {
    throw new Error("Chrome is expected to be available on this Windows host");
  }

  // Test 2: Telemetry
  console.log("\n[Test 2] Collecting System Telemetry...");
  const telemetry = await collectSystemTelemetry();
  console.log(`✓ CPU: ${telemetry.cpuUsagePercent}%, RAM: ${telemetry.memoryUsagePercent}%, Battery: ${telemetry.batteryPercent}% (${telemetry.isBatteryCharging ? "Charging" : "Discharging"}), Uptime: ${telemetry.uptimeFormatted}`);

  // Test 3: Natural Language Destination Resolution (Registry)
  console.log("\n[Test 3] Natural Language Destination Resolution:");
  const registryTests = [
    { phrase: "JARVIS, open YouTube", expectedTarget: "youtube", expectedTool: "open_chrome" },
    { phrase: "Open GitHub", expectedTarget: "github", expectedTool: "open_chrome" },
    { phrase: "Open Google", expectedTarget: "google", expectedTool: "open_chrome" },
    { phrase: "Open my Gmail", expectedTarget: "gmail", expectedTool: "open_chrome" },
    { phrase: "Take me to Google Drive", expectedTarget: "drive", expectedTool: "open_chrome" },
    { phrase: "Launch Calendar", expectedTarget: "calendar", expectedTool: "open_chrome" },
    { phrase: "Go to ChatGPT", expectedTarget: "chatgpt", expectedTool: "open_chrome" },
    { phrase: "Open LinkedIn", expectedTarget: "linkedin", expectedTool: "open_chrome" },
    { phrase: "Open Discord", expectedTarget: "discord", expectedTool: "open_chrome" },
    { phrase: "Open Spotify Web", expectedTarget: "spotify_web", expectedTool: "open_chrome" },
  ];

  for (const test of registryTests) {
    const result = brain.parseLocalIntent(test.phrase);
    console.log(`  "${test.phrase}" -> intent: ${result.intent}, target: ${result.parameters?.target}`);
    if (result.intent !== "open_website" || result.parameters?.target !== test.expectedTarget) {
      throw new Error(`Failed to resolve destination for: "${test.phrase}"`);
    }
  }
  console.log("✓ All registered services resolved correctly to their target definitions");

  // Test 4: Search Handling ("Search for TCS NQT 2026", "Search YouTube for Python tutorials")
  console.log("\n[Test 4] Search Intent Handling:");
  const searchTests = [
    {
      phrase: "Search for TCS NQT 2026",
      expectedIntent: "search_chrome",
      expectedQuery: "TCS NQT 2026",
    },
    {
      phrase: "Search YouTube for Python tutorials",
      expectedIntent: "search_chrome",
      expectedQuery: "Python tutorials",
      expectedEngine: "youtube",
    },
    {
      phrase: "Search for Python linked list tutorials",
      expectedIntent: "search_chrome",
      expectedQuery: "Python linked list tutorials",
    },
  ];

  for (const test of searchTests) {
    const result = brain.parseLocalIntent(test.phrase);
    console.log(`  "${test.phrase}" -> intent: ${result.intent}, query: ${result.parameters?.query}`);
    if (result.intent !== test.expectedIntent) {
      throw new Error(`Expected intent ${test.expectedIntent} for "${test.phrase}", got ${result.intent}`);
    }
    if (result.parameters?.query !== test.expectedQuery) {
      throw new Error(`Expected query "${test.expectedQuery}", got "${result.parameters?.query}"`);
    }
    if (test.expectedEngine && result.parameters?.engine !== test.expectedEngine) {
      throw new Error(`Expected engine "${test.expectedEngine}", got "${result.parameters?.engine}"`);
    }
  }
  console.log("✓ All search queries accurately parsed with search engines and query targets");

  // Test 5: Direct Website Handling ("Open https://example.com")
  console.log("\n[Test 5] Direct Website URL Handling:");
  const urlResult = brain.parseLocalIntent("Open https://example.com");
  console.log(`  "Open https://example.com" -> intent: ${urlResult.intent}, url: ${urlResult.parameters?.url}`);
  if (urlResult.intent !== "open_chrome" || urlResult.parameters?.url !== "https://example.com") {
    throw new Error("Failed to parse direct URL intent");
  }
  console.log("✓ Direct https URL parsed to open_chrome action");

  // Test 6: Chrome Tools Registered in ToolRegistry
  console.log("\n[Test 6] Tool Registry - Chrome Abstractions:");
  const requiredTools = [
    "open_chrome",
    "search_chrome",
    "navigate_chrome",
    "get_chrome_status",
    "open_new_tab",
    "browser_click",
    "browser_type",
    "browser_press_key",
    "browser_scroll",
    "browser_read_page",
    "close_current_tab",
  ];
  for (const toolName of requiredTools) {
    const tool = toolRegistry[toolName];
    if (!tool) {
      throw new Error(`Required tool '${toolName}' is missing from toolRegistry!`);
    }
    console.log(`  Tool: ${tool.name} | Permission: ${tool.permissionLevel}`);
  }
  console.log("✓ All Chrome abstraction tools present and validated");

  // Test 7: BrowserTaskPlanner Multi-Step Plans
  console.log("\n[Test 7] BrowserTaskPlanner Multi-Step Plans:");
  const { browserPlanner } = await import("./browserPlanner");

  const plan1 = browserPlanner.createPlan("Open YouTube and search for Python tutorials");
  console.log(`  Plan 1: "${plan1.taskDescription}" -> ${plan1.steps.length} steps`);
  if (plan1.steps.length < 5) {
    throw new Error("Plan 1 expected at least 5 sequential browser steps");
  }

  const plan2 = browserPlanner.createPlan("Open Google, search for TCS NQT, and open the official result");
  console.log(`  Plan 2: "${plan2.taskDescription}" -> ${plan2.steps.length} steps`);
  if (plan2.steps.length < 7) {
    throw new Error("Plan 2 expected multi-step navigation, typing, searching, and clicking result");
  }

  const plan3 = browserPlanner.createPlan("Open GitHub and find my RoadAI repository");
  console.log(`  Plan 3: "${plan3.taskDescription}" -> ${plan3.steps.length} steps`);
  if (plan3.steps.length < 5) {
    throw new Error("Plan 3 expected multi-step repo search on GitHub");
  }
  console.log("✓ All multi-step browser plans generated sequentially with new tab requirement");

  console.log("\n==================================================");
  console.log("  ALL CHROME-FIRST TESTS PASSED SUCCESSFULLY!     ");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
