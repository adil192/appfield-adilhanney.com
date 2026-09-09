# App Field

View all your apps at a glance in the app grid.<br/>
An extension for GNOME.

![](https://raw.githubusercontent.com/adil192/appfield-adilhanney.com/refs/heads/main/doc/screenshot.png)

## Features

- No pages or scrolling: see all your apps at once.
- Automatically resizes the grid to fit all your apps.
- Apps are sorted alphabetically from left to right.
- Hover over an app's icon to see its name.
- Drag an icon into a workspace preview to open in that workspace, just like vanilla GNOME.
- Written in Typescript for type safety and reliability.

## Limitations

The following features are not planned for this extension:
- Rearranging apps in the grid.
- Folders.
- Hiding apps: use [Main Menu](https://flathub.org/en/apps/page.codeberg.libre_menu_editor.LibreMenuEditor) for that.

## Install

The extension currently needs to be built from source.

Install `npm` (Node.js) then run these commands in a terminal:

```bash
# Download the source code
git clone https://github.com/adil192/appfield-adilhanney.com
cd appfield-adilhanney.com

# Build and install
make && make install
```

After logging out and back in,
enable the extension in [Extension Manager](https://flathub.org/en/apps/com.mattjakeman.ExtensionManager). Alternatively, run `gnome-extensions enable appfield@adilhanney.com` in a terminal.

Feel free to delete the source code after installation.

## Credits

This was heavily inspired by Lukas Bleisteiner's
[Vertical App Grid](https://github.com/lublst/gnome-vertical-app-grid) extension.

Lots of code in this project is shared/modified from
[GNOME Shell](https://gitlab.gnome.org/GNOME/gnome-shell/) (GPL-2.0-or-later) and
[Vertical App Grid](https://github.com/lublst/gnome-vertical-app-grid) (GPL-3.0).

## License

This project is licensed under the GPL-3.0 License:
see the [LICENSE](https://github.com/adil192/appfield-adilhanney.com/blob/main/LICENSE) file for details.

View the full source code on [GitHub](https://github.com/adil192/appfield-adilhanney.com).
