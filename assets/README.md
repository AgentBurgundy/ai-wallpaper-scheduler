# Assets Directory

This directory contains application assets like icons and images.

## Required Files

### `icon.ico`
- **Format**: Windows ICO file with multiple sizes
- **Required sizes**: 16x16, 24x24, 32x32, 48x48, 256x256 pixels
- **Usage**: Application icon, installer icon, shortcuts
- **How to create**: See [ICONS.md](./ICONS.md)

### `tray-icon.png`
- **Format**: PNG with transparency
- **Size**: 16x16 or 32x32 pixels
- **Usage**: System tray icon
- **Design**: Simple, high contrast, recognizable at small size

### `icon.png` (Optional)
- **Format**: PNG
- **Size**: 256x256 pixels
- **Usage**: Fallback/development icon

## Quick Setup

1. **Create your icon design** at 256x256 pixels
2. **Convert to ICO** with multiple sizes (see ICONS.md)
3. **Save as** `icon.ico` in this directory
4. **Create tray icon** at 16x16 or 32x32
5. **Save as** `tray-icon.png` in this directory

## File Structure

```
assets/
├── icon.ico          ← Main application icon (REQUIRED)
├── tray-icon.png     ← System tray icon (REQUIRED)
├── icon.png          ← Fallback icon (optional)
├── ICONS.md          ← Detailed icon creation guide
└── README.md         ← This file
```

## Notes

- Icons are referenced in `electron-builder.yml`
- Tray icon is loaded in `src/electron/main.ts`
- All icons should be optimized for file size
- Use transparency (alpha channel) for PNG files


