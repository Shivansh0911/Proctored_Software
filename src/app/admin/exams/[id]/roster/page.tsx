import { RosterClient } from "./roster-client";

export default async function RosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RosterClient examId={id} />;
}
