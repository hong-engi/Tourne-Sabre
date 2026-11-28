#!/usr/bin/env node
import fs from 'node:fs';

function readStdin() {
  return fs.readFileSync(0, 'utf8');
}

function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/');
}

function respond(obj) {
  process.stdout.write(JSON.stringify(obj));
}

function main() {
  let payload;
  try {
    const raw = readStdin();
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    respond({ decision: 'allow' });
    return;
  }

  const toolCall = payload.toolCall || {};
  const name = toolCall.name || '';
  const args = toolCall.args || {};

  if (name === 'write_file' || name === 'edit_file') {
    const filePath = normalizePath(args.Path || args.path);

    if (filePath.includes('/backend/node_modules/') || filePath.endsWith('/backend/node_modules')) {
      respond({
        decision: 'deny',
        reason: 'Avoid incidental edits to tracked backend/node_modules/ files (per AGENTS.md).'
      });
      return;
    }

    if (filePath.endsWith('/tools/feedback/feedback.json') || filePath === 'tools/feedback/feedback.json') {
      respond({
        decision: 'ask',
        reason: 'AGENTS.md forbids deleting or overwriting tools/feedback/feedback.json without asking the user.'
      });
      return;
    }

    if (
      name === 'write_file' &&
      (filePath.endsWith('/ENEMY_NOTES.json') || filePath === 'ENEMY_NOTES.json') &&
      args.Overwrite === true
    ) {
      respond({
        decision: 'ask',
        reason: 'ENEMY_NOTES.json contains user notes; confirm before overwriting the whole file (use edit_file to update only status to "done").'
      });
      return;
    }
  }

  if (name === 'run_command') {
    const cmd = String(args.CommandLine || args.command || '');
    const touchesProtectedJson = /(?:^|[\s/])(feedback\.json|ENEMY_NOTES\.json)\b/.test(cmd);
    const isDestructive = /\b(rm|unlink|truncate|mv|cp)\b|(?<![<>])>{1,2}\s*[^\s]*?(feedback\.json|ENEMY_NOTES\.json)/.test(cmd);

    if (touchesProtectedJson && isDestructive) {
      respond({
        decision: 'ask',
        reason: 'Command may delete, overwrite, or truncate feedback.json or ENEMY_NOTES.json (protected by AGENTS.md).'
      });
      return;
    }
  }

  respond({ decision: 'allow' });
}

main();
