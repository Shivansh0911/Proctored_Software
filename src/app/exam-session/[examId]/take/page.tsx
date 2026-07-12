import { TakeExamClient } from "./take-client";

export default async function TakeExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  return <TakeExamClient examId={examId} />;
}
