import * as vscode from 'vscode';

export let decorationType: vscode.TextEditorDecorationType;

export function initializeDecoration() {
    decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 1em',
            color: '#888888',
            fontStyle: 'italic'
        }
    });
}

export function getDecorationOptions(range: vscode.Range, latestVersion: string): vscode.DecorationOptions {
    return {
        range,
        renderOptions: {
            after: {
                contentText: `=> ${latestVersion}`,
            }
        }
    };
}