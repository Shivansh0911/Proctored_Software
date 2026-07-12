import { QuestionsClient } from "./questions-client";

export default async function QuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuestionsClient examId={id} />;
}
