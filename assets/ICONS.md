# Windows Icons Setup Guide

## Required Icon Sizes

For Windows 11, you need icons at these sizes (minimum):
- **16x16** - Context menu, title bar, system tray
- **24x24** - Taskbar, search results
- **32x32** - Context menu, title bar
- **48x48** - Start pins
- **256x256** - High DPI displays (ensures Windows never scales up)

## File Structure

Place your icons in the `assets/` directory:

```
assets/
├── icon.ico          # Multi-size ICO file (contains all sizes)
├── icon.png          # 256x256 PNG (fallback)
├── tray-icon.png     # 16x16 or 32x32 PNG (for system tray)
└── icons/            # Individual PNG files (optional, for reference)
    ├── icon-16.png
    ├── icon-24.png
    ├── icon-32.png
    ├── icon-48.png
    └── icon-256.png
```

## Creating the ICO File

### Option 1: Using Online Tools (Easiest)

1. **Create your icon** at 256x256 pixels (PNG format)
2. **Use an online converter**:
   - https://convertio.co/png-ico/
   - https://www.icoconverter.com/
   - https://cloudconvert.com/png-to-ico
3. **Upload your 256x256 PNG**
4. **Select multiple sizes**: 16, 24, 32, 48, 256
5. **Download the .ico file**
6. **Save as** `assets/icon.ico`

### Option 2: Using ImageMagick (Command Line)

If you have ImageMagick installed:

```bash
# Create ICO with all required sizes
magick convert icon-256.png -define icon:auto-resize=256,48,32,24,16 icon.ico
```

### Option 3: Using GIMP (Free)

1. Open GIMP
2. Create a new image at 256x256
3. Design your icon
4. Export as PNG at each size: 16, 24, 32, 48, 256
5. Use GIMP's "Export as ICO" plugin or online converter

### Option 4: Using Photoshop

1. Create 256x256 design
2. File → Export → Export As → ICO
3. Select multiple sizes in export options

## Creating Tray Icon

The system tray icon should be:
- **16x16** or **32x32** pixels
- PNG format
- Simple, recognizable design (works well at small sizes)
- High contrast (visible on light/dark backgrounds)

Save as: `assets/tray-icon.png`

## Icon Design Tips

1. **Keep it simple** - Icons are small, details get lost
2. **High contrast** - Should be visible on any background
3. **Square design** - Windows icons are square
4. **Test at small sizes** - Make sure it's recognizable at 16x16
5. **Use transparency** - PNG supports alpha channel
6. **Consistent style** - Match Windows 11 design language

## Quick Start

1. **Create a 256x256 icon** (PNG)
2. **Convert to ICO** with multiple sizes using online tool
3. **Save as** `assets/icon.ico`
4. **Create 16x16 or 32x32 version** for tray
5. **Save as** `assets/tray-icon.png`
6. **Done!** The app will use these automatically

## Testing

After adding icons:

1. **Build the app**:
   ```bash
   npm run build:electron
   ```

2. **Check the installer** - Should show your icon

3. **Install and verify**:
   - Desktop shortcut has icon
   - Start Menu has icon
   - System tray shows icon
   - Taskbar shows icon

## Troubleshooting

### Icon Not Showing

- Verify `icon.ico` exists in `assets/` directory
- Check file is valid ICO format (not just renamed PNG)
- Rebuild: `npm run build:electron`

### Icon Looks Blurry

- Ensure 256x256 size is included in ICO
- Windows will scale down, never up
- Higher DPI displays need larger source

### Tray Icon Not Visible

- Use 16x16 or 32x32 size
- High contrast colors
- Test on both light and dark taskbars

## Resources

- **Free Icon Design Tools**:
  - Canva (https://www.canva.com/)
  - Figma (https://www.figma.com/)
  - GIMP (https://www.gimp.org/)

- **Icon Converters**:
  - https://convertio.co/png-ico/
  - https://www.icoconverter.com/

- **Windows Icon Guidelines**:
  - https://learn.microsoft.com/en-us/windows/apps/design/style/iconography/app-icon-construction


