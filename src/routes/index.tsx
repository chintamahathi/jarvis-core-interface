import { createFileRoute } from "@tanstack/react-router";
import { JarvisDashboard } from "@/components/JarvisDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "J.A.R.V.I.S. — Personal AI Interface" },
      { name: "description", content: "A cinematic personal AI system interface with live simulated telemetry and voice states." },
      { property: "og:title", content: "J.A.R.V.I.S. — Personal AI Interface" },
      { property: "og:description", content: "A cinematic personal AI system interface with live simulated telemetry and voice states." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <JarvisDashboard />;
}
