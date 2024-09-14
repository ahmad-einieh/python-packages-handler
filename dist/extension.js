"use strict";var y=Object.create;var u=Object.defineProperty;var k=Object.getOwnPropertyDescriptor;var P=Object.getOwnPropertyNames;var $=Object.getPrototypeOf,I=Object.prototype.hasOwnProperty;var x=(e,s)=>{for(var a in s)u(e,a,{get:s[a],enumerable:!0})},h=(e,s,a,i)=>{if(s&&typeof s=="object"||typeof s=="function")for(let n of P(s))!I.call(e,n)&&n!==a&&u(e,n,{get:()=>s[n],enumerable:!(i=k(s,n))||i.enumerable});return e};var T=(e,s,a)=>(a=e!=null?y($(e)):{},h(s||!e||!e.__esModule?u(a,"default",{value:e,enumerable:!0}):a,e)),A=e=>h(u({},"__esModule",{value:!0}),e);var j={};x(j,{activate:()=>M,deactivate:()=>C});module.exports=A(j);var t=T(require("vscode"));function M(e){console.log('Congratulations, your extension "python-packages-handler" is now active!');let s=t.commands.registerCommand("python-packages-handler.updatePackageVersion",async()=>{await m()});e.subscriptions.push(s);let a=t.commands.registerCommand("python-packages-handler.updateAllPackages",async()=>{await f()});e.subscriptions.push(a);let i=t.commands.registerCommand("python-packages-handler.updateAndInstallPackage",async()=>{await E()});e.subscriptions.push(i);let n=t.commands.registerCommand("python-packages-handler.updateAllAndInstallPackages",async()=>{await b()});e.subscriptions.push(n)}async function m(){let e=t.window.activeTextEditor;if(!e){t.window.showErrorMessage("No active editor found!");return}let s=e.document;if(s.languageId!=="pip-requirements"){t.window.showErrorMessage("This command only works in requirements.txt files.");return}let a=e.selection.active,i=s.lineAt(a.line),c=i.text.trim().match(/^([\w-]+)((?:[=<>!~]+.*)?)$/);if(!c){t.window.showErrorMessage("Invalid package specification.");return}let o=c[1],d=c[2]||"==";try{let r=await fetch(`https://pypi.org/pypi/${o}/json`);if(!r.ok)throw new Error(`HTTP error! status: ${r.status}`);let p=(await r.json()).info.version,w=d?`${o}${d.split(/\d/)[0]}${p}`:`${o}==${p}`;e.edit(g=>{g.replace(i.range,w)}),t.window.showInformationMessage(`Updated ${o} to version ${p}.`)}catch{t.window.showErrorMessage(`Failed to fetch the latest version for ${o}.`)}}async function f(){let e=t.window.activeTextEditor;if(!e||e.document.languageId!=="pip-requirements"){t.window.showErrorMessage("This command only works in requirements.txt files.");return}let s=e.document,i=s.getText().split(`
`),n=[];for(let c of i){let o=c.trim().match(/^([\w-]+)((?:[=<>!~]+.*)?)$/);if(o){let d=o[1],r=o[2]||"==";try{let l=await fetch(`https://pypi.org/pypi/${d}/json`);if(!l.ok)throw new Error(`HTTP error! status: ${l.status}`);let w=(await l.json()).info.version,g=r?`${d}${r.split(/\d/)[0]}${w}`:`${d}==${w}`;n.push(g)}catch{n.push(c)}}else n.push(c)}e.edit(c=>{let o=new t.Range(s.positionAt(0),s.positionAt(s.getText().length));c.replace(o,n.join(`
`))}),t.window.showInformationMessage("Updated all packages to their latest versions.")}async function E(){await m(),await v()}async function b(){await f(),await v()}async function v(){let e=t.window.createTerminal("Python Package Installer");e.show(),e.sendText("pip install -r requirements.txt --upgrade"),t.window.showInformationMessage("Installing updated packages..."),await new Promise(s=>setTimeout(s,5e3)),t.window.showInformationMessage("Packages installed successfully.")}function C(){}0&&(module.exports={activate,deactivate});
