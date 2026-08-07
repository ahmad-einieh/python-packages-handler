import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { decorationType, initializeDecoration } from './decoration';
import { addLatestVersionDecorationsParallel } from './packageManager';
import { isHandledFile } from './utils';

export function activate(context: vscode.ExtensionContext) {
    console.log('Python Packages Handler is now active!');

    initializeDecoration();
    registerCommands(context);

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (isHandledFile(document)) {
                await addLatestVersionDecorationsParallel(document);
            }
        }),
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            if (isHandledFile(event.document)) {
                await addLatestVersionDecorationsParallel(event.document);
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor && isHandledFile(editor.document)) {
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
