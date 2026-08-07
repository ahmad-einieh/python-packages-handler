import * as vscode from 'vscode';
import pLimit from 'p-limit';
import { fetchLatestVersion } from './utils';
import { decorationType, getDecorationOptions } from './decoration';

const concurrencyLimit = 5;
const limit = pLimit(concurrencyLimit);

const HEADER_RE = /^\s*\[([^\]]+)\]\s*(#.*)?$/;
const OPEN_ARRAY_RE = /^[ \t]*([A-Za-z0-9_.-]+)[ \t]*=[ \t]*\[/;
const POETRY_LINE_RE = /^([ \t]*)([A-Za-z0-9][A-Za-z0-9._-]*)[ \t]*=[ \t]*(.+?)\s*(#.*)?$/;

interface QuotedSpan {
    start: number;
    end: number;
    quote: string;
    content: string;
}

interface DepEdit {
    start: number;
    end: number;
    rebuild: (latest: string) => string;
}

interface PyprojectDep {
    line: number;
    name: string;
    edit?: DepEdit;
}

function extractQuotedSpans(text: string): QuotedSpan[] {
    const spans: QuotedSpan[] = [];
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"' || ch === "'") {
            const quote = ch;
            let j = i + 1;
            while (j < text.length && text[j] !== quote) {
                if (text[j] === '\\') {
                    j++;
                }
                j++;
            }
            spans.push({ start: i, end: j + 1, quote, content: text.slice(i + 1, j) });
            i = j + 1;
        } else {
            i++;
        }
    }
    return spans;
}

function unquotedContains(text: string, target: string): boolean {
    let inQuote = '';
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuote) {
            if (c === inQuote) {
                inQuote = '';
            }
        } else if (c === '"' || c === "'") {
            inQuote = c;
        } else if (c === target) {
            return true;
        }
    }
    return false;
}

function splitOperator(specPart: string): { operator: string; version: string } {
    const opMatch = specPart.match(/^[^0-9]+/);
    const operator = opMatch ? opMatch[0] : '';
    return { operator, version: specPart.slice(operator.length) };
}

function isVersionLike(version: string): boolean {
    return /^\d/.test(version.trim());
}

function isRelevantArrayContext(headerPath: string[], key: string): boolean {
    const h = headerPath.join('.');
    if (h === 'project' && key === 'dependencies') {
        return true;
    }
    if (h === 'project.optional-dependencies') {
        return true;
    }
    if (h === 'dependency-groups') {
        return true;
    }
    return false;
}

function isPoetryDepsHeader(headerPath: string[]): boolean {
    const h = headerPath;
    if (h.length === 3 && h[0] === 'tool' && h[1] === 'poetry' &&
        (h[2] === 'dependencies' || h[2] === 'dev-dependencies')) {
        return true;
    }
    if (h.length === 5 && h[0] === 'tool' && h[1] === 'poetry' &&
        h[2] === 'group' && h[4] === 'dependencies') {
        return true;
    }
    return false;
}

function buildArrayDep(line: number, span: QuotedSpan): PyprojectDep | null {
    const m = span.content.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)(\[[^\]]*\])?\s*([^;]*)?(;.*)?$/);
    if (!m) {
        return null;
    }
    const name = m[1];
    const extras = m[2] || '';
    const specPart = (m[3] || '').trim();
    const marker = m[4] || '';

    const dep: PyprojectDep = { line, name };
    if (specPart) {
        const { operator, version } = splitOperator(specPart);
        if (isVersionLike(version)) {
            dep.edit = {
                start: span.start,
                end: span.end,
                rebuild: latest => `${span.quote}${name}${extras}${operator}${latest}${marker}${span.quote}`
            };
        }
    }
    return dep;
}

function buildPoetryStringDep(line: number, name: string, span: QuotedSpan): PyprojectDep | null {
    const { operator, version } = splitOperator(span.content);
    const dep: PyprojectDep = { line, name };
    if (isVersionLike(version)) {
        dep.edit = {
            start: span.start,
            end: span.end,
            rebuild: latest => `${span.quote}${operator}${latest}${span.quote}`
        };
    }
    return dep;
}

function buildPoetryInlineTableDep(line: number, name: string, valuePart: string, lineText: string): PyprojectDep | null {
    const vmatch = valuePart.match(/version\s*=\s*("([^"]*)"|'([^']*)')/);
    if (!vmatch) {
        return null;
    }
    const inner = vmatch[2] !== undefined ? vmatch[2] : vmatch[3];
    const quote = vmatch[2] !== undefined ? '"' : "'";
    const { operator, version } = splitOperator(inner);
    if (!isVersionLike(version)) {
        return { line, name };
    }
    const tokenStart = lineText.indexOf(vmatch[1]);
    const tokenEnd = tokenStart + vmatch[1].length;
    return {
        line,
        name,
        edit: {
            start: tokenStart,
            end: tokenEnd,
            rebuild: latest => `${quote}${operator}${latest}${quote}`
        }
    };
}

export function scanPyprojectDeps(text: string): PyprojectDep[] {
    const lines = text.split('\n');
    const deps: PyprojectDep[] = [];
    let headerPath: string[] = [];
    let inRelevantArray = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const header = line.match(HEADER_RE);
        if (header) {
            headerPath = header[1].split('.').map(s => s.trim());
            inRelevantArray = false;
            continue;
        }

        const openMatch = inRelevantArray ? null : line.match(OPEN_ARRAY_RE);
        let openedNow = false;
        if (openMatch && isRelevantArrayContext(headerPath, openMatch[1])) {
            openedNow = true;
        }

        if (inRelevantArray || openedNow) {
            for (const span of extractQuotedSpans(line)) {
                const dep = buildArrayDep(i, span);
                if (dep) {
                    deps.push(dep);
                }
            }
        }

        if (openedNow) {
            inRelevantArray = true;
        }
        if ((inRelevantArray || openedNow) && unquotedContains(line, ']')) {
            inRelevantArray = false;
        }

        if (!inRelevantArray && !openedNow && isPoetryDepsHeader(headerPath)) {
            const m = line.match(POETRY_LINE_RE);
            if (m) {
                const name = m[2];
                if (name === 'python') {
                    continue;
                }
                const valuePart = m[3];
                let dep: PyprojectDep | null = null;
                if (valuePart.startsWith('{')) {
                    dep = buildPoetryInlineTableDep(i, name, valuePart, line);
                } else {
                    const span = extractQuotedSpans(line).find(s => s.start >= line.indexOf(valuePart));
                    if (span) {
                        dep = buildPoetryStringDep(i, name, span);
                    }
                }
                if (dep) {
                    deps.push(dep);
                }
            }
        }
    }

    return deps;
}

export async function decoratePyproject(document: vscode.TextDocument, editor: vscode.TextEditor) {
    const deps = scanPyprojectDeps(document.getText());

    const decorationPromises = deps.map(dep => limit(async () => {
        const latestVersion = await fetchLatestVersion(dep.name);
        if (latestVersion) {
            const lineLength = document.lineAt(dep.line).text.length;
            const range = new vscode.Range(dep.line, lineLength, dep.line, lineLength);
            return getDecorationOptions(range, latestVersion);
        }
        return null;
    }));

    const decorations = (await Promise.all(decorationPromises)).filter((d): d is vscode.DecorationOptions => d !== null);
    editor.setDecorations(decorationType, decorations);
}

export async function updatePyprojectPackage(editor: vscode.TextEditor): Promise<string | null> {
    const document = editor.document;
    const cursorLine = editor.selection.active.line;
    const deps = scanPyprojectDeps(document.getText());
    const dep = deps.find(d => d.line === cursorLine && d.edit);

    if (!dep || !dep.edit) {
        vscode.window.showErrorMessage('Place the cursor on a dependency with a pinned version.');
        return null;
    }

    try {
        const latestVersion = await fetchLatestVersion(dep.name);
        if (!latestVersion) {
            throw new Error('Failed to fetch latest version');
        }

        const start = new vscode.Position(dep.line, dep.edit.start);
        const end = new vscode.Position(dep.line, dep.edit.end);
        await editor.edit(editBuilder => {
            editBuilder.replace(new vscode.Range(start, end), dep.edit!.rebuild(latestVersion));
        });

        await document.save();
        vscode.window.showInformationMessage(`Updated ${dep.name} to version ${latestVersion}`);
        return dep.name;
    } catch {
        vscode.window.showErrorMessage(`Failed to update ${dep.name}`);
        return null;
    }
}

export async function updateAllPyprojectPackages(editor: vscode.TextEditor) {
    const document = editor.document;
    const deps = scanPyprojectDeps(document.getText()).filter(d => d.edit);

    const updates = await Promise.all(deps.map(dep => limit(async () => {
        try {
            const latestVersion = await fetchLatestVersion(dep.name);
            if (latestVersion) {
                return { dep, latestVersion };
            }
        } catch {
            // Keep original if update fails
        }
        return null;
    })));

    const successful = updates.filter((u): u is { dep: PyprojectDep; latestVersion: string } => u !== null);

    if (successful.length === 0) {
        vscode.window.showWarningMessage('No packages could be updated.');
        return;
    }

    await editor.edit(editBuilder => {
        for (const { dep, latestVersion } of successful) {
            const start = new vscode.Position(dep.line, dep.edit!.start);
            const end = new vscode.Position(dep.line, dep.edit!.end);
            editBuilder.replace(new vscode.Range(start, end), dep.edit!.rebuild(latestVersion));
        }
    });

    await document.save();
    vscode.window.showInformationMessage(`Updated ${successful.length} package(s) to their latest versions`);
}
