"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var decorationType;
function activate(context) {
  console.log('Congratulations, your extension "python-packages-handler" is now active!');
  decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: "0 0 0 1em",
      contentText: "=> ",
      color: "#888888",
      fontStyle: "italic"
    }
  });
  let disposable = vscode.commands.registerCommand("python-packages-handler.updatePackageVersion", async () => {
    await updatePackage();
  });
  context.subscriptions.push(disposable);
  let updateAllDisposable = vscode.commands.registerCommand("python-packages-handler.updateAllPackages", async () => {
    await updateAllPackages();
  });
  context.subscriptions.push(updateAllDisposable);
  let updateAndInstallDisposable = vscode.commands.registerCommand("python-packages-handler.updateAndInstallPackage", async () => {
    await updateAndInstallPackage();
  });
  context.subscriptions.push(updateAndInstallDisposable);
  let updateAllAndInstallDisposable = vscode.commands.registerCommand("python-packages-handler.updateAllAndInstallPackages", async () => {
    await updateAllAndInstallPackages();
  });
  context.subscriptions.push(updateAllAndInstallDisposable);
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async (document) => {
      if (document.languageId === "pip-requirements") {
        await addLatestVersionDecorations(document);
      }
    }),
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (event.document.languageId === "pip-requirements") {
        await addLatestVersionDecorations(event.document);
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor && editor.document.languageId === "pip-requirements") {
        await addLatestVersionDecorations(editor.document);
      }
    })
  );
}
async function addLatestVersionDecorations(document) {
  const editor = vscode.window.visibleTextEditors.find((editor2) => editor2.document === document);
  if (!editor) {
    return;
  }
  const decorations = [];
  const text = document.getText();
  const lines = text.split("\n");
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
              contentText: `=> ${latestVersion}`
            }
          }
        });
      }
    }
  }
  editor.setDecorations(decorationType, decorations);
}
async function fetchLatestVersion(packageName) {
  try {
    const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.info.version;
  } catch (error) {
    console.error(`Failed to fetch the latest version for ${packageName}:`, error);
    return null;
  }
}
async function updatePackage() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor found!");
    return;
  }
  const document = editor.document;
  if (document.languageId !== "pip-requirements") {
    vscode.window.showErrorMessage("This command only works in requirements.txt files.");
    return;
  }
  const position = editor.selection.active;
  const line = document.lineAt(position.line);
  const lineText = line.text.trim();
  const packageMatch = lineText.match(/^([\w-]+)((?:[=<>!~]+.*)?)$/);
  if (!packageMatch) {
    vscode.window.showErrorMessage("Invalid package specification.");
    return;
  }
  const packageName = packageMatch[1];
  const versionSpecifier = packageMatch[2] || "==";
  try {
    const latestVersion = await fetchLatestVersion(packageName);
    if (!latestVersion) {
      throw new Error("Failed to fetch latest version");
    }
    const newText = versionSpecifier ? `${packageName}${versionSpecifier.split(/\d/)[0]}${latestVersion}` : `${packageName}==${latestVersion}`;
    await editor.edit((editBuilder) => {
      editBuilder.replace(line.range, newText);
    });
    await document.save();
    vscode.window.showInformationMessage(`Updated ${packageName} to version ${latestVersion} and saved the file.`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to fetch the latest version for ${packageName}.`);
  }
}
async function updateAllPackages() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "pip-requirements") {
    vscode.window.showErrorMessage("This command only works in requirements.txt files.");
    return;
  }
  const document = editor.document;
  const text = document.getText();
  const lines = text.split("\n");
  let updatedLines = [];
  for (let line of lines) {
    const packageMatch = line.trim().match(/^([\w-]+)((?:[=<>!~]+.*)?)$/);
    if (packageMatch) {
      const packageName = packageMatch[1];
      const versionSpecifier = packageMatch[2] || "==";
      try {
        const latestVersion = await fetchLatestVersion(packageName);
        if (latestVersion) {
          const newLine = versionSpecifier ? `${packageName}${versionSpecifier.split(/\d/)[0]}${latestVersion}` : `${packageName}==${latestVersion}`;
          updatedLines.push(newLine);
        } else {
          updatedLines.push(line);
        }
      } catch (error) {
        updatedLines.push(line);
      }
    } else {
      updatedLines.push(line);
    }
  }
  await editor.edit((editBuilder) => {
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    editBuilder.replace(fullRange, updatedLines.join("\n"));
  });
  await document.save();
  vscode.window.showInformationMessage("Updated all packages to their latest versions and saved the file.");
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
  const terminal = vscode.window.createTerminal("Python Package Installer");
  terminal.show();
  terminal.sendText("pip install -r requirements.txt --upgrade");
  vscode.window.showInformationMessage("Installing updated packages...");
  await new Promise((resolve) => setTimeout(resolve, 5e3));
  vscode.window.showInformationMessage("Packages installed successfully.");
}
function deactivate() {
  if (decorationType) {
    decorationType.dispose();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
