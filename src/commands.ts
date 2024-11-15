import * as vscode from 'vscode';
import { 
    updatePackage, 
    updateAllPackages, 
    updateAndInstallPackage,
    updateAllAndInstallPackages,
    installPackagesWithoutUpdate
} from './packageManager';

export function registerCommands(context: vscode.ExtensionContext) {
    const commands = [
        {
            command: 'python-packages-handler.updatePackageVersion',
            callback: updatePackage
        },
        {
            command: 'python-packages-handler.updateAllPackages',
            callback: updateAllPackages
        },
        {
            command: 'python-packages-handler.updateAndInstallPackage',
            callback: updateAndInstallPackage
        },
        {
            command: 'python-packages-handler.updateAllAndInstallPackages',
            callback: updateAllAndInstallPackages
        },
        {
            command: 'python-packages-handler.installPackagesWithoutUpdate',
            callback: installPackagesWithoutUpdate
        }
    ];

    commands.forEach(({ command, callback }) => {
        let disposable = vscode.commands.registerCommand(command, callback);
        context.subscriptions.push(disposable);
    });
}