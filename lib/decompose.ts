export interface Decomposition {
  subtasks: { title: string; durationDays: number }[];
  dependencies: [number, number][]; // [dependentIdx, prerequisiteIdx]
}

const MAX_SUBTASKS = 8;

// Never trust LLM output: everything is validated before it touches the DB.
export function parseDecomposition(raw: unknown): Decomposition | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.subtasks) || !Array.isArray(obj.dependencies)) return null;
  if (obj.subtasks.length === 0 || obj.subtasks.length > MAX_SUBTASKS) return null;

  const subtasks: Decomposition['subtasks'] = [];
  for (const s of obj.subtasks) {
    if (typeof s !== 'object' || s === null) return null;
    const { title, durationDays } = s as Record<string, unknown>;
    if (typeof title !== 'string' || !title.trim()) return null;
    subtasks.push({
      title: title.trim().slice(0, 200),
      durationDays:
        Number.isInteger(durationDays) && (durationDays as number) >= 1
          ? (durationDays as number)
          : 1,
    });
  }

  const dependencies: [number, number][] = [];
  const seen = new Set<string>();
  for (const pair of obj.dependencies) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const [dep, pre] = pair;
    if (!Number.isInteger(dep) || !Number.isInteger(pre)) return null;
    if (dep === pre) return null;
    if (dep < 0 || dep >= subtasks.length || pre < 0 || pre >= subtasks.length) return null;
    const key = `${dep}->${pre}`;
    if (seen.has(key)) continue; // models occasionally repeat pairs
    seen.add(key);
    dependencies.push([dep, pre]);
  }
  return { subtasks, dependencies };
}

// Models sometimes wrap JSON in a ```json fence or add stray prose despite
// response_format; pull the JSON object out before parsing.
function extractJson(text: string): unknown {
  let t = text.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) t = fenced[1].trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(t.slice(start, end + 1));
    }
    throw new Error('no json');
  }
}

const SYSTEM_PROMPT =
  'You decompose a task into 2-8 concrete subtasks for a project scheduler. ' +
  'Respond with ONLY a JSON object of the exact shape: ' +
  '{"subtasks": [{"title": string, "durationDays": integer>=1}], ' +
  '"dependencies": [[dependentIndex, prerequisiteIndex]]}. ' +
  'Indices are 0-based into the subtasks array. The dependency pairs must form a DAG ' +
  '(no cycles, no self-references). Only add a dependency when one subtask genuinely ' +
  'cannot start before another finishes. Do not include any prose outside the JSON.';

// Routed through OpenRouter (OpenAI-compatible). Defaults to a Claude model so
// the decomposition is still Claude-powered; override with OPENROUTER_MODEL.
export async function decomposeTitle(title: string): Promise<Decomposition> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4.5';

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Things To Do task scheduler',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Decompose this task: ${title}` },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1500,
    }),
  });

  if (!res.ok) {
    throw new Error('No response from model');
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('No response from model');
  }

  let raw: unknown;
  try {
    raw = extractJson(content);
  } catch {
    throw new Error('Model returned an invalid decomposition');
  }
  const parsed = parseDecomposition(raw);
  if (!parsed) {
    throw new Error('Model returned an invalid decomposition');
  }
  return parsed;
}
