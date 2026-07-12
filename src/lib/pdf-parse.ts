import "server-only";

export interface ParsedOption {
  key: string;
  text: string;
}

export interface ParsedQuestion {
  type: "mcq" | "numeric" | "subjective";
  text: string;
  options: ParsedOption[];
  correct_answer: string | null;
  marks: number;
  order_index: number;
}

/**
 * Extracts raw text from a PDF buffer, preserving line breaks by watching for
 * vertical position jumps between text items (pdf.js does not report line
 * breaks directly).
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Legacy build runs in Node without a DOM or a real worker.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "";

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    disableFontFace: true,
  }).promise;

  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    let lastY: number | null = null;
    let currentLine = "";

    for (const item of content.items as { str: string; transform: number[] }[]) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(currentLine.trim());
        currentLine = "";
      }
      currentLine += item.str + " ";
      lastY = y;
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
    lines.push(""); // page break
  }

  return lines.join("\n");
}

const QUESTION_START = /^\s*(?:Q\.?\s*)?(\d{1,3})[.)]\s+(.*)$/i;
const OPTION_START = /^\s*[([]?([A-Da-d])[.)\]]\s+(.*)$/;

/** Heuristic split of raw question-paper text into structured draft questions. */
export function parseQuestionsFromText(text: string): ParsedQuestion[] {
  const lines = text.split("\n").map((l) => l.trim());
  const questions: ParsedQuestion[] = [];

  let current: ParsedQuestion | null = null;
  let currentOptionKey: string | null = null;

  const pushCurrent = () => {
    if (current && current.text.trim()) {
      current.type = current.options.length >= 2 ? "mcq" : "subjective";
      questions.push(current);
    }
  };

  for (const line of lines) {
    if (!line) continue;

    const qMatch = line.match(QUESTION_START);
    const oMatch = line.match(OPTION_START);

    if (qMatch) {
      pushCurrent();
      current = {
        type: "subjective",
        text: qMatch[2],
        options: [],
        correct_answer: null,
        marks: 1,
        order_index: questions.length,
      };
      currentOptionKey = null;
      continue;
    }

    if (current && oMatch) {
      current.options.push({ key: oMatch[1].toUpperCase(), text: oMatch[2] });
      currentOptionKey = oMatch[1].toUpperCase();
      continue;
    }

    // Continuation line: append to the last option's text if we're inside
    // one, otherwise to the question stem.
    if (current) {
      if (currentOptionKey) {
        const opt = current.options[current.options.length - 1];
        opt.text += " " + line;
      } else {
        current.text += " " + line;
      }
    }
  }
  pushCurrent();

  // Numeric-type detection: no options, and the stem looks like it wants a
  // number (heuristic keyword match). Admin corrects this in the review step
  // regardless.
  for (const q of questions) {
    if (q.options.length === 0 && /\b(value of|calculate|find the|how many|evaluate)\b/i.test(q.text)) {
      q.type = "numeric";
    }
  }

  return questions;
}

/** Heuristic parse of an answer key: lines like "1. B", "12) 42.5", "Q3 - C". */
export function parseAnswerKeyFromText(text: string): Record<number, string> {
  const answers: Record<number, string> = {};
  const lines = text.split("\n");
  const pattern = /^\s*(?:Q\.?\s*)?(\d{1,3})[.)\-:]?\s+([A-Da-d]|-?\d+(?:\.\d+)?)\s*$/i;

  for (const line of lines) {
    const match = line.trim().match(pattern);
    if (match) {
      answers[Number(match[1])] = match[2].toUpperCase();
    }
  }

  return answers;
}
