# Third-party notices

## Stitch Studio engine

Copyright (c) 2026 Rui. MIT licence; see LICENSE. The generation core is reused from the user-supplied Stitch Studio snapshot, independently of its interface. Original engine SHA-256: `7eb63a9d4c5915249b638fa6bd1ee35cff1e6f2e3982d8a6ca60b78279fe6052`. Integration changes are tracked in Git.

## Display colour compilation

Color data: craft-color-codes by [MakeBead](https://makebead.com).

Source: [makebead/craft-color-codes](https://github.com/makebead/craft-color-codes). Data licence: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). The publisher's [data licence](https://github.com/makebead/craft-color-codes/blob/main/LICENSE-DATA.md) was checked on 2026-10-27 and explicitly permits copying, sharing and adaptation with attribution.

The 489-entry RGB snapshot supplied with Stitch Studio is included unchanged at initial integration (SHA-256 `945ea492f930959edac79cf81b7b4363930a7cf9cfa1c43705f328edbc466aed`). It is an independent approximate digital colour compilation, not an official, complete, or manufacturer-certified thread catalogue. DMC names and product references are trademarks of their respective owners. Ricamo is not affiliated with or endorsed by DMC or MakeBead. Display colours are approximate and should be compared with physical materials. This licence does not grant rights in user-imported artwork.

## Application dependencies

Vue and Vite: MIT. Electron: MIT with bundled Chromium/Node third-party notices retained by the packager. jsPDF: MIT. Lucide: ISC. electron-builder: MIT. Playwright: Apache-2.0 (development only). @noble/hashes 2.4.0: MIT. @napi-rs/canvas 1.0.13 and its matching Windows x64 optional binding: declared MIT. Exact dependency versions and integrity hashes are recorded in package-lock.json. The release audit inventories the package metadata and notices actually present in the ASAR, alongside Electron/Chromium notices; it also rejects platform-incompatible native packages. Distribution must retain the notices included with bundled dependencies.

Mozilla PDF.js (`pdfjs-dist` 6.4.299): Apache-2.0, Copyright Mozilla Foundation and contributors. Used locally for document rendering; no hosted viewer or remote document service. Its licence and bundled third-party font/codec notices must remain in the distribution. Upstream: https://github.com/mozilla/pdf.js.


## DejaVu Sans and DejaVu Sans Bold

Bundled locally for Unicode PDF export. Original license text follows.

```text
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: DejaVu fonts
Upstream-Author: Stepan Roh <src@users.sourceforge.net> (original author),
                  see /usr/share/doc/fonts-dejavu-core/AUTHORS for full list
Source: https://dejavu-fonts.github.io/

Files: *
Copyright: Copyright (c) 2003 by Bitstream, Inc. All Rights Reserved.
 Bitstream Vera is a trademark of Bitstream, Inc.
 DejaVu changes are in public domain.
License: bitstream-vera
 Permission is hereby granted, free of charge, to any person obtaining a copy
 of the fonts accompanying this license ("Fonts") and associated
 documentation files (the "Font Software"), to reproduce and distribute the
 Font Software, including without limitation the rights to use, copy, merge,
 publish, distribute, and/or sell copies of the Font Software, and to permit
 persons to whom the Font Software is furnished to do so, subject to the
 following conditions:
 .
 The above copyright and trademark notices and this permission notice shall
 be included in all copies of one or more of the Font Software typefaces.
 .
 The Font Software may be modified, altered, or added to, and in particular
 the designs of glyphs or characters in the Fonts may be modified and
 additional glyphs or characters may be added to the Fonts, only if the fonts
 are renamed to names not containing either the words "Bitstream" or the word
 "Vera".
 .
 This License becomes null and void to the extent applicable to Fonts or Font
 Software that has been modified and is distributed under the "Bitstream
 Vera" names.
 .
 The Font Software may be sold as part of a larger software package but no
 copy of one or more of the Font Software typefaces may be sold by itself.
 .
 THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT,
 TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL BITSTREAM OR THE GNOME
 FOUNDATION BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING
 ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF
 THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE
 FONT SOFTWARE.
 .
 Except as contained in this notice, the names of Gnome, the Gnome
 Foundation, and Bitstream Inc., shall not be used in advertising or
 otherwise to promote the sale, use or other dealings in this Font Software
 without prior written authorization from the Gnome Foundation or Bitstream
 Inc., respectively. For further information, contact: fonts at gnome dot
 org.

Files: debian/*
Copyright: (C) 2005-2006 Peter Cernak <pce@users.sourceforge.net>
           (C) 2006-2011 Davide Viti <zinosat@tiscali.it>
           (C) 2011-2013 Christian Perrier <bubulle@debian.org>
           (C) 2013 Fabian Greffrath <fabian+debian@greffrath.com>
License: GPL-2+
 This program is free software; you can redistribute it
 and/or modify it under the terms of the GNU General Public
 License as published by the Free Software Foundation; either
 version 2 of the License, or (at your option) any later
 version.
 .
 This program is distributed in the hope that it will be
 useful, but WITHOUT ANY WARRANTY; without even the implied
 warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 PURPOSE.  See the GNU General Public License for more
 details.
 .
 You should have received a copy of the GNU General Public
 License along with this package; if not, write to the Free
 Software Foundation, Inc., 51 Franklin St, Fifth Floor,
 Boston, MA  02110-1301 USA
 .
 On Debian systems, the full text of the GNU General Public
 License version 2 can be found in the file
 /usr/share/common-licenses/GPL-2'.
```
