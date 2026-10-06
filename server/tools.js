// MCP tool catalogue + minimal argument validation for the SJN Word relay.
// `TOOL_LIST` is what tools/list returns. `validateArgs` returns either
// {args} (a cleaned object forwarded to the app) or {error} (shown to Claude
// as an isError tool result, not a protocol error).
import { OPS_REFERENCE } from './ops-reference.js';

export const MAX_OPS = 400;

export const TOOL_LIST = [
  {
    name: 'word_get_document',
    description:
      "Read the document currently open in the user's SJN Word app. Returns the title, page setup, the user's current selection/cursor, and the whole document as numbered blocks like `[3] p center: text` (inline <b><i><u><s><a> markup shown). ALWAYS call this before word_edit; block numbers refer to the latest listing.",
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['all', 'selection'], description: 'all (default) or only the selected blocks' },
        max_chars: { type: 'integer', description: 'optional cap on listing size' },
      },
    },
  },
  {
    name: 'word_edit',
    description:
      "Edit the open document by applying operations in one undoable step (the user can press Undo). Block numbers (i, after) come from the most recent listing (word_get_document or the previous word_edit result). Blocks changed by the user in the meantime are skipped. Returns a summary and the fresh listing.\n\n" +
      OPS_REFERENCE,
    inputSchema: {
      type: 'object',
      properties: {
        say: { type: 'string', description: 'optional short note shown to the user in the app' },
        ops: { type: 'array', items: { type: 'object' }, description: `operations, max ${MAX_OPS}` },
      },
      required: ['ops'],
    },
  },
  {
    name: 'word_list_documents',
    description: "List the documents saved in the user's SJN Word library (id, title, last edited).",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'word_open_document',
    description: 'Open a saved document by id so it becomes the current document.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'word_new_document',
    description: 'Create a new blank document and open it.',
    inputSchema: { type: 'object', properties: { title: { type: 'string' } } },
  },
];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// MCP tool name -> command name sent to the app (the name without "word_").
export const appToolName = (name) => name.replace(/^word_/, '');
export const isKnownTool = (name) => TOOL_LIST.some((t) => t.name === name);

const validators = {
  word_get_document(a) {
    const out = {};
    if (a.scope !== undefined) {
      if (a.scope !== 'all' && a.scope !== 'selection') return { error: '"scope" must be "all" or "selection".' };
      out.scope = a.scope;
    }
    if (a.max_chars !== undefined) {
      if (!Number.isInteger(a.max_chars) || a.max_chars < 1) return { error: '"max_chars" must be a positive integer.' };
      out.max_chars = a.max_chars;
    }
    return { args: out };
  },
  word_edit(a) {
    if (!Array.isArray(a.ops)) return { error: '"ops" is required and must be an array of operation objects.' };
    if (a.ops.length === 0) return { error: '"ops" must contain at least one operation.' };
    if (a.ops.length > MAX_OPS) return { error: `Too many operations (${a.ops.length}); the maximum is ${MAX_OPS}. Split them over several word_edit calls.` };
    for (let n = 0; n < a.ops.length; n++) {
      const op = a.ops[n];
      if (!isObj(op) || typeof op.op !== 'string' || !op.op) return { error: `ops[${n}] must be an object with a string "op" field.` };
    }
    const out = { ops: a.ops };
    if (a.say !== undefined) {
      if (typeof a.say !== 'string') return { error: '"say" must be a string.' };
      out.say = a.say.slice(0, 500);
    }
    return { args: out };
  },
  word_list_documents() {
    return { args: {} };
  },
  word_open_document(a) {
    if (typeof a.id !== 'string' || !a.id.trim()) return { error: '"id" is required and must be a non-empty string (see word_list_documents).' };
    return { args: { id: a.id } };
  },
  word_new_document(a) {
    if (a.title !== undefined && typeof a.title !== 'string') return { error: '"title" must be a string.' };
    return { args: a.title === undefined ? {} : { title: a.title } };
  },
};

export function validateArgs(name, raw) {
  if (raw === undefined || raw === null) raw = {};
  if (!isObj(raw)) return { error: 'Tool arguments must be a JSON object.' };
  return validators[name](raw);
}
