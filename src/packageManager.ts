import * as vscode from 'vscode';
import pLimit from 'p-limit';
import { fetchLatestVersion, findRequirementsFile, createTerminal } from './utils';
import { decorationType, getDecorationOptions } from './decoration';

const concurrencyLimit = 5;
const limit = pLimit(concurrencyLimit);

export async function addLatestVersionDecorationsParallel(document: vscode.TextDocument) {
    const editor = vscode.window.visibleTextEditors.find(editor => editor.document === document);
    if (!editor) {
        return;
    }

    const text = document.getText();
    const lines = text.split('\n');

    const decorationPromises = lines.map((line, i) => limit(async () => {
        const packageMatch = line.trim().match(/^([\w-]+)((?:[=<>!~]+.*)?)$/);
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

    const decorations = (await Promise.all(decorationPromises)).filter(d => d !== null);
    editor.setDecorations(decorationType, decorations);
}


export async function updatePackage() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'pip-requirements') {
        vscode.window.showErrorMessage('This command only works in requirements.txt files.');
        return;
    }

    const position = editor.selection.active;
    const line = editor.document.lineAt(position.line);
    const lineText = line.text.trim();

    const packageMatch = lineText.match(/^([\w-]+)((?:[=<>!~]+.*)?)$/);
    if (!packageMatch) {
        vscode.window.showErrorMessage('Invalid package specification.');
        return;
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
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to update ${packageName}`);
        return null;
    }
}


export async function updateAllPackages() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'pip-requirements') {
        vscode.window.showErrorMessage('This command only works in requirements.txt files.');
        return;
    }

    const document = editor.document;
    const text = document.getText();
    const lines = text.split('\n');

    const updatedLinesPromises = lines.map(line => limit(async () => {
        const packageMatch = line.trim().match(/^([\w-]+)((?:[=<>!~]+.*)?)$/);
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
            } catch (error) {
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


export async function installPackages(specificPackage?: string) {
    const requirementsPath = await findRequirementsFile();
    if (!requirementsPath) {
        vscode.window.showErrorMessage('Could not find requirements.txt file');
        return;
    }

    const terminal = createTerminal();
    terminal.show();

    if (specificPackage) {
        terminal.sendText(`pip install --upgrade ${specificPackage}`);
        vscode.window.showInformationMessage(`Installing ${specificPackage}...`);
    } else {
        terminal.sendText(`pip install -r "${requirementsPath}" --upgrade`);
        vscode.window.showInformationMessage('Installing packages...');
    }
}


export async function updateAndInstallPackage() {
    const packageName = await updatePackage();
    if (packageName) {
        await installPackages(packageName);
    }
}

export async function updateAllAndInstallPackages() {
    await updateAllPackages();
    await installPackages();
}

export async function installPackagesWithoutUpdate() {
    const requirementsPath = await findRequirementsFile();
    if (!requirementsPath) {
        vscode.window.showErrorMessage('Could not find requirements.txt file');
        return;
    }

    const terminal = createTerminal();
    terminal.show();
    terminal.sendText(`pip install -r "${requirementsPath}"`);
    vscode.window.showInformationMessage('Installing packages...');
}
