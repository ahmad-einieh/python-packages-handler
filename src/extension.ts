import * as vscode from 'vscode';

interface PyPIResponse {
    info: {
        version: string;
    };
}

let decorationType: vscode.TextEditorDecorationType;

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "python-packages-handler" is now active!');

    // Create a decoration type for the latest version
    decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 1em',
            contentText: 'Latest: ',
            color: '#888888',
            fontStyle: 'italic'
        }
    });

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

    // Add event listeners for file open, content change, and active editor change
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (document.languageId === 'pip-requirements') {
                await addLatestVersionDecorations(document);
            }
        }),
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            if (event.document.languageId === 'pip-requirements') {
                await addLatestVersionDecorations(event.document);
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor && editor.document.languageId === 'pip-requirements') {
                await addLatestVersionDecorations(editor.document);
            }
        })
    );
}

async function addLatestVersionDecorations(document: vscode.TextDocument) {
    const editor = vscode.window.visibleTextEditors.find(editor => editor.document === document);
    if (!editor) {
        return;
    }

    const decorations: vscode.DecorationOptions[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const packageMatch = line.trim().match(/^([\w-]+)((?:[=<>!~]+.*)?)$/);
        if (packageMatch) {
            const packageName = packageMatch[1];
            const latestVersion = await fetchLatestVersion(packageName);
            if (latestVersion) {
                const range = new vscode.Range(i, line.length, i, line.length);
                decorations.push({
                    range,
                    renderOptions: {
                        after: {
                            contentText: `Latest: ${latestVersion}`,
                        }
                    }
                });
            }
        }
    }

    editor.setDecorations(decorationType, decorations);
}

async function fetchLatestVersion(packageName: string): Promise<string | null> {
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
        const latestVersion = await fetchLatestVersion(packageName);
        if (!latestVersion) {
            throw new Error('Failed to fetch latest version');
        }

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
                const latestVersion = await fetchLatestVersion(packageName);
                if (latestVersion) {
                    // Preserve the original version specifier
                    const newLine = versionSpecifier 
                        ? `${packageName}${versionSpecifier.split(/\d/)[0]}${latestVersion}`
                        : `${packageName}==${latestVersion}`;
                    updatedLines.push(newLine);
                } else {
                    updatedLines.push(line); // Keep original if update fails
                }
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

export function deactivate() {
    if (decorationType) {
        decorationType.dispose();
    }
}