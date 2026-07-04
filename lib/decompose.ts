import Anthropic from '@anthropic-ai/sdk';

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
  for (const pair of obj.dependencies) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const [dep, pre] = pair;
    if (!Number.isInteger(dep) || !Number.isInteger(pre)) return null;
    if (dep === pre) return null;
    if (dep < 0 || dep >= subtasks.length || pre < 0 || pre >= subtasks.length) return null;
    dependencies.push([dep, pre]);
  }
  return { subtasks, dependencies };
}

const SCHEMA = {
  type: 'object',
  properties: {
    subtasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          durationDays: { type: 'integer' },
        },
        required: ['title', 'durationDays'],
        additionalProperties: false,
      },
    },
    dependencies: {
      type: 'array',
      items: {
        type: 'array',
        items: { type: 'integer' },
      },
    },
  },
  required: ['subtasks', 'dependencies'],
  additionalProperties: false,
} as const;

export async function decomposeTitle(title: string): Promise<Decomposition> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    system:
      'You decompose a task into 2-8 concrete subtasks for a project scheduler. ' +
      'Each subtask has a title and an estimated durationDays (integer >= 1). ' +
      'dependencies is a list of [dependentIndex, prerequisiteIndex] pairs between subtasks ' +
      '(0-based indices into subtasks). The pairs must form a DAG — no cycles, no ' +
      'self-references. Only add a dependency when one subtask genuinely cannot start ' +
      'before another finishes.',
    messages: [{ role: 'user', content: `Decompose this task: ${title}` }],
  });
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No response from model');
  const parsed = parseDecomposition(JSON.parse(text.text));
  if (!parsed) throw new Error('Model returned an invalid decomposition');
  return parsed;
}
