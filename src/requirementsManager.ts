import * as vscode from 'vscode';
import pLimit from 'p-limit';
import { fetchLatestVersion } from './utils';
import { decorationType, getDecorationOptions } from './decoration';

const concurrencyLimit = 5;
const limit = pLimit(concurrencyLimit);

const REQUIREMENTS_LINE = /^([\w-]+)((?:[=<>!~]+.*)?)$/;

export async function decorateRequirements(document: vscode.TextDocument, editor: vscode.TextEditor) {
    const text = document.getText();
    const lines = text.split('\n');

    const decorationPromises = lines.map((line, i) => limit(async () => {
        const packageMatch = line.trim().match(REQUIREMENTS_LINE);
        if (packageMatch) {
            const packageName = packageMatch[1];
            const latestVersion = await fetchLatestVersion(packageName);
            if (latestVersion) {
                const range = new vscode.Range(i, line.length, i, line.length);
                return getDecorationOptions(range, latestVersion);
            }
        }
        return null;
    }));

    const decorations = (await Promise.all(decorationPromises)).filter((d): d is vscode.DecorationOptions => d !== null);
    editor.setDecorations(decorationType, decorations);
}

export async function updateRequirementsPackage(editor: vscode.TextEditor): Promise<string | null> {
    const position = editor.selection.active;
    const line = editor.document.lineAt(position.line);
    const lineText = line.text.trim();

    const packageMatch = lineText.match(REQUIREMENTS_LINE);
    if (!packageMatch) {
        vscode.window.showErrorMessage('Invalid package specification.');
        return null;
    }

    const packageName = packageMatch[1];
    const versionSpecifier = packageMatch[2] || '==';

    try {
        const latestVersion = await fetchLatestVersion(packageName);
        if (!latestVersion) {
            throw new Error('Failed to fetch latest version');
        }

        const newText = versionSpecifier
            ? `${packageName}${versionSpecifier.split(/\d/)[0]}${latestVersion}`
            : `${packageName}==${latestVersion}`;

        await editor.edit(editBuilder => {
            editBuilder.replace(line.range, newText);
        });

        await editor.document.save();
        vscode.window.showInformationMessage(`Updated ${packageName} to version ${latestVersion}`);

        return packageName;
    } catch {
        vscode.window.showErrorMessage(`Failed to update ${packageName}`);
        return null;
    }
}

export async function updateAllRequirementsPackages(editor: vscode.TextEditor) {
    const document = editor.document;
    const text = document.getText();
    const lines = text.split('\n');

    const updatedLinesPromises = lines.map(line => limit(async () => {
        const packageMatch = line.trim().match(REQUIREMENTS_LINE);
        if (packageMatch) {
            const packageName = packageMatch[1];
            const versionSpecifier = packageMatch[2] || '==';
            try {
                const latestVersion = await fetchLatestVersion(packageName);
                if (latestVersion) {
                    return versionSpecifier
                        ? `${packageName}${versionSpecifier.split(/\d/)[0]}${latestVersion}`
                        : `${packageName}==${latestVersion}`;
                }
            } catch {
                // Keep original if update fails
            }
        }
        return line;
    }));

    const updatedLines = await Promise.all(updatedLinesPromises);

    await editor.edit(editBuilder => {
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        editBuilder.replace(fullRange, updatedLines.join('\n'));
    });

    await document.save();
    vscode.window.showInformationMessage('Updated all packages to their latest versions');
}
