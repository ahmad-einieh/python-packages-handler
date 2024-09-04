# Python Packages Handler

Python Packages Handler is a Visual Studio Code extension that helps you manage and update Python package versions in your `requirements.txt` files.

## Features

- Update a single Python package to its latest version
- Update all Python packages in a `requirements.txt` file to their latest versions
- Preserves existing version specifiers (e.g., `~=`, `>=`, `==`, etc.)
- Accessible via right-click context menu in `requirements.txt` files

## Installation

1. Open Visual Studio Code
2. Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X on macOS)
3. Search for "Python Packages Handler"
4. Click Install

Alternatively, you can download the .vsix file from the [releases page](link-to-your-releases-page) and install it manually.

## Usage

### Updating a Single Package

1. Open a `requirements.txt` file in VS Code
2. Right-click on the line containing the package you want to update
3. Select "Update Python Package Version" from the context menu

### Updating All Packages

1. Open a `requirements.txt` file in VS Code
2. Right-click anywhere in the file
3. Select "Update All Python Packages" from the context menu

## Requirements

- Visual Studio Code version 1.60.0 or higher
- Internet connection (to fetch latest package versions from PyPI)

## Extension Settings

This extension doesn't add any VS Code settings.

## Release Notes

### 1.0.0

Initial release of Python Packages Handler

- Feature to update a single package
- Feature to update all packages in a file
- Context menu integration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is licensed under the [MIT License](LICENSE).


## Author

Created and maintained by [Ahmad Einieh](https://github.com/ahmad-einieh)