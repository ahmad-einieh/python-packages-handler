import * as vscode from 'vscode';
import fetch from 'node-fetch';

interface PyPIResponse {
    info: {
        version: string;
    };
}

export enum ProjectFileType {
    Requirements = 'requirements',
    Pyproject = 'pyproject',
    Unknown = 'unknown',
}

export function detectFileType(document: vscode.TextDocument): ProjectFileType {
    if (document.languageId === 'pip-requirements') {
        return ProjectFileType.Requirements;
    }

    const filename = document.uri.fsPath.split(/[\\/]/).pop() || '';
    if (filename.toLowerCase() === 'pyproject.toml') {
        return ProjectFileType.Pyproject;
    }

    return ProjectFileType.Unknown;
}

export function isHandledFile(document: vscode.TextDocument): boolean {
    return detectFileType(document) !== ProjectFileType.Unknown;
}

export function getActiveHandledEditor(): vscode.TextEditor | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return undefined;
    }
    return isHandledFile(editor.document) ? editor : undefined;
}

export async function findRequirementsFile(): Promise<string | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'pip-requirements') {
        return undefined;
    }

    return editor.document.uri.fsPath;
}

export async function fetchLatestVersion(packageName: string): Promise<string | null> {
    try {
        const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json() as PyPIResponse;
        return data.info.version;
    } catch (error) {
        console.error(`Failed to fetch the latest version for ${packageName}:`, error);
        return null;
    }
}

export function createTerminal(): vscode.Terminal {
    return vscode.window.createTerminal('Python Package Installer');
}
