import * as vscode from 'vscode';
import fetch from 'node-fetch';

interface PyPIResponse {
    info: {
        version: string;
    };
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