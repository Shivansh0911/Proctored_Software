import { MonitorClient } from "./monitor-client";

export default async function MonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MonitorClient examId={id} />;
}
