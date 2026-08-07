import * as vscode from 'vscode';
import { detectFileType, ProjectFileType, createTerminal } from './utils';
import { decorateRequirements, updateRequirementsPackage, updateAllRequirementsPackages } from './requirementsManager';
import { decoratePyproject, updatePyprojectPackage, updateAllPyprojectPackages } from './pyprojectManager';

export async function addLatestVersionDecorationsParallel(document: vscode.TextDocument) {
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (!editor) {
        return;
    }

    switch (detectFileType(document)) {
        case ProjectFileType.Requirements:
            await decorateRequirements(document, editor);
            break;
        case ProjectFileType.Pyproject:
            await decoratePyproject(document, editor);
            break;
        default:
            break;
    }
}

function getEditorForCommand(): vscode.TextEditor | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor || detectFileType(editor.document) === ProjectFileType.Unknown) {
        vscode.window.showErrorMessage('Open a requirements.txt or pyproject.toml file first.');
        return undefined;
    }
    return editor;
}

export async function updatePackage(): Promise<string | null> {
    const editor = getEditorForCommand();
    if (!editor) {
        return null;
    }

    if (detectFileType(editor.document) === ProjectFileType.Pyproject) {
        return updatePyprojectPackage(editor);
    }
    return updateRequirementsPackage(editor);
}

export async function updateAllPackages() {
    const editor = getEditorForCommand();
    if (!editor) {
        return;
    }

    if (detectFileType(editor.document) === ProjectFileType.Pyproject) {
        await updateAllPyprojectPackages(editor);
    } else {
        await updateAllRequirementsPackages(editor);
    }
}

export async function installPackages(specificPackage?: string) {
    const editor = vscode.window.activeTextEditor;
    const fileType = editor ? detectFileType(editor.document) : ProjectFileType.Unknown;
    if (fileType === ProjectFileType.Unknown) {
        vscode.window.showErrorMessage('Open a requirements.txt or pyproject.toml file first.');
        return;
    }

    const terminal = createTerminal();
    terminal.show();

    if (fileType === ProjectFileType.Pyproject) {
        const folder = vscode.workspace.getWorkspaceFolder(editor!.document.uri);
        const cwd = folder ? folder.uri.fsPath : vscode.workspace.rootPath;
        const target = cwd ? `"${cwd}"` : '.';
        terminal.sendText(`pip install ${target} --upgrade`);
        vscode.window.showInformationMessage('Installing project dependencies...');
        return;
    }

    const requirementsPath = editor!.document.uri.fsPath;
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
    const editor = vscode.window.activeTextEditor;
    const fileType = editor ? detectFileType(editor.document) : ProjectFileType.Unknown;
    if (fileType === ProjectFileType.Unknown) {
        vscode.window.showErrorMessage('Open a requirements.txt or pyproject.toml file first.');
        return;
    }

    const terminal = createTerminal();
    terminal.show();

    if (fileType === ProjectFileType.Pyproject) {
        const folder = vscode.workspace.getWorkspaceFolder(editor!.document.uri);
        const cwd = folder ? folder.uri.fsPath : vscode.workspace.rootPath;
        const target = cwd ? `"${cwd}"` : '.';
        terminal.sendText(`pip install ${target}`);
        vscode.window.showInformationMessage('Installing project dependencies...');
        return;
    }

    const requirementsPath = editor!.document.uri.fsPath;
    terminal.sendText(`pip install -r "${requirementsPath}"`);
    vscode.window.showInformationMessage('Installing packages...');
}
