# Jump to Recent

A Visual Studio Code extension to manage your recent files - quickly go to or search recently opened files.

Optimize your file browsing with quick access to recently opened files in Visual Studio Code. Similar to InteliJ, PhpStorm, or WebStorm's "browse recent files" feature, this extension sorts your files by most recently opened, making it easier to switch between recent files. 

## Features

- Allows you to quickly switch between recently opened files.
- Sorts files by most recently opened.
- Provides quick pick navigation and file deletion options.

## Installation

1. Open Visual Studio Code.
2. Click on the Extensions button on the left side of the window.
3. Search for `Jump To Recent`.
4. Click the Install button.

## Keybindings
The following keybindings can be used in Visual Studio Code:

```
{
	"key": "cmd+e",
	"command": "jumpToRecent.open"
},
{
	"key": "cmd+shift+e",
	"command": "jumpToRecent.back"
}
{
	"key": "cmd+backspace",
	"command": "jumpToRecent.forget"
}
```

To use these keybindings in Visual Studio Code, copy the code block above and paste it into your keybindings.json file.

Note that the keybindings will differ depending on whether you are using a Windows or Mac.

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the [MIT License](LICENSE).
