import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { decorationType, initializeDecoration } from './decoration';
import { addLatestVersionDecorationsParallel } from './packageManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('Python Packages Handler is now active!');

    initializeDecoration();
    registerCommands(context);

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (document.languageId === 'pip-requirements') {
                await addLatestVersionDecorationsParallel(document);
            }
        }),
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            if (event.document.languageId === 'pip-requirements') {
                await addLatestVersionDecorationsParallel(event.document);
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor && editor.document.languageId === 'pip-requirements') {
                await addLatestVersionDecorationsParallel(editor.document);
            }
        })
    );
}

export function deactivate() {
    if (decorationType) {
        decorationType.dispose();
    }
}