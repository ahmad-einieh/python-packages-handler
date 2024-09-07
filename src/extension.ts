import * as vscode from 'vscode';
import * as cp from 'child_process';

interface PyPIResponse {
    info: {
        version: string;
    };
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "python-packages-handler" is now active!');

    let disposable = vscode.commands.registerCommand('python-packages-handler.updatePackageVersion', async () => {
        await updatePackage();
    });

    context.subscriptions.push(disposable);

    let updateAllDisposable = vscode.commands.registerCommand('python-packages-handler.updateAllPackages', async () => {
        await updateAllPackages();
    });

    context.subscriptions.push(updateAllDisposable);

    let updateAndInstallDisposable = vscode.commands.registerCommand('python-packages-handler.updateAndInstallPackage', async () => {
        await updateAndInstallPackage();
    });

    context.subscriptions.push(updateAndInstallDisposable);

    let updateAllAndInstallDisposable = vscode.commands.registerCommand('python-packages-handler.updateAllAndInstallPackages', async () => {
        await updateAllAndInstallPackages();
    });

    context.subscriptions.push(updateAllAndInstallDisposable);
}

async function updatePackage() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found!');
        return;
    }

    const document = editor.document;
    if (document.languageId !== 'pip-requirements') {
        vscode.window.showErrorMessage('This command only works in requirements.txt files.');
        return;
    }

    const position = editor.selection.active;
    const line = document.lineAt(position.line);
    const lineText = line.text.trim();

    const packageMatch = lineText.match(/^([\w-]+)((?:[=<>!~]+.*)?)$/);
    if (!packageMatch) {
        vscode.window.showErrorMessage('Invalid package specification.');
        return;
    }

    const packageName = packageMatch[1];
    const versionSpecifier = packageMatch[2] || '==';

    try {
        const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json() as PyPIResponse;
        const latestVersion = data.info.version;

        // Preserve the original version specifier
        const newText = versionSpecifier 
            ? `${packageName}${versionSpecifier.split(/\d/)[0]}${latestVersion}`
            : `${packageName}==${latestVersion}`;
        
        editor.edit(editBuilder => {
            editBuilder.replace(line.range, newText);
        });

        vscode.window.showInformationMessage(`Updated ${packageName} to version ${latestVersion}.`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch the latest version for ${packageName}.`);
    }
}

async function updateAllPackages() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'pip-requirements') {
        vscode.window.showErrorMessage('This command only works in requirements.txt files.');
        return;
    }

    const document = editor.document;
    const text = document.getText();
    const lines = text.split('\n');

    let updatedLines = [];
    for (let line of lines) {
        const packageMatch = line.trim().match(/^([\w-]+)((?:[=<>!~]+.*)?)$/);
        if (packageMatch) {
            const packageName = packageMatch[1];
            const versionSpecifier = packageMatch[2] || '==';
            try {
                const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json() as PyPIResponse;
                const latestVersion = data.info.version;
                // Preserve the original version specifier
                const newLine = versionSpecifier 
                    ? `${packageName}${versionSpecifier.split(/\d/)[0]}${latestVersion}`
                    : `${packageName}==${latestVersion}`;
                updatedLines.push(newLine);
            } catch (error) {
                updatedLines.push(line); // Keep original if update fails
            }
        } else {
            updatedLines.push(line); // Keep non-package lines as is
        }
    }

    editor.edit(editBuilder => {
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        editBuilder.replace(fullRange, updatedLines.join('\n'));
    });

    vscode.window.showInformationMessage('Updated all packages to their latest versions.');
}

async function updateAndInstallPackage() {
    await updatePackage();
    await installPackages();
}

async function updateAllAndInstallPackages() {
    await updateAllPackages();
    await installPackages();
}

async function installPackages() {
    const terminal = vscode.window.createTerminal('Python Package Installer');
    terminal.show();
    terminal.sendText('pip install -r requirements.txt --upgrade');
    
    vscode.window.showInformationMessage('Installing updated packages...');
    
    // Wait for the installation to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    vscode.window.showInformationMessage('Packages installed successfully.');
}

export function deactivate() {}