import { ExamDetailsClient } from "./details-client";

export default async function ExamDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExamDetailsClient examId={id} />;
}
