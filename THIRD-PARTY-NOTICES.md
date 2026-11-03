# Third-party notices

## FlossCross chart workspace

FlossCross application, stitch photographs, symbols and custom fonts: copyright © 2026 FlossCross.com, https://flosscross.com. Copied at the user's explicit direction on the basis of their reported contractual authorization from the author. These materials are not relicensed under Ricamo's MIT licence. Original source bytes, paths and hashes are retained in `vendor/flosscross/runtime.json.gz`; the local integration and verification scope are described in `docs/FLOSSCROSS-AUDIT.md`. Existing upstream source notices and PDF attribution are preserved.

Its bundled libraries retain their embedded notices: Vue 2.7.16, Vuex 3.6.2, Vue Router 3.0.1 (Evan You and contributors, MIT); vue-i18n 8.22.0 (Kazuya Kawaguchi, MIT); Quasar 1.22.10 (Razvan Stoenescu and contributors, MIT); Cropper.js 1.5.6 (Chen Fengyuan, MIT); jsPDF 3.0.1 and its included modules (notices included in the source); Pixi.js and the official `@pixi/unsafe-eval` CSP adapter 6.5.9 (MIT; adapter licence included in the archive). The image quantization, IndexedDB/XML/polyfill utilities and font assets remain part of the pinned upstream distribution. This is an offline adaptation, not an endorsement or affiliation with FlossCross.

Image-Q: copyright 2015–2018 Igor Bezkrovnyi, MIT; upstream `image-q.js.LICENSE.txt` is included. PT Sans is accompanied by its SIL Open Font License, and Material Icons by its Apache License 2.0, in the bundled font directory. The original copyright notices in all scripts are retained. For the MIT libraries listed above, the permission and disclaimer are:

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

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

## Casa Cenina catalogue cover previews

The offline chart catalogue includes 482 small cover previews attributed to Mirabilia/Nora Corbett and Bella Filipina, obtained from their public Casa Cenina catalogue pages on 2026-11-01. These images remain the property of their respective authors and publishers and are not licensed under this repository’s MIT license. They identify commercial products; no chart grids, instructions or purchased PDFs are included. Source URLs and image SHA-256 values are recorded in `data/pattern-catalogue.json`. See `docs/CHART-CATALOGUE-SOURCES.md`.

## DMC Diamant catalogue photos

The Diamant catalogue includes 14 small, unmodified product-photo previews referenced by the public official DMC product page on 2026-11-01. Images and DMC marks remain the property of their respective owners and are not covered by the repository MIT license. They identify commercial thread products; no embroidery designs or instructions are included. Source URLs, variant IDs and original image SHA-256 values are recorded in `data/dmc-diamant-catalogue.json`. See `docs/DMC-DIAMANT-SOURCES.md`.

## Casa Cenina material product previews

Original public product-preview images are bundled for offline identification of thread, bead, fabric and other material articles. Images and associated marks remain the property of their respective owners and are not covered by this repository's MIT license. The referenced DMC Coloris category and saved public Casa Cenina component pages identify each exact product/image URL. Images are kept unmodified, with source URLs and SHA-256 evidence in `data/casa-product-preview-sources.json`. No shop account, private files, chart instructions or purchase availability data are included. See `docs/PRODUCT-PREVIEW-SOURCES.md`.

## Nunito and Quicksand

Bundled locally as the interface typefaces (unmodified Latin and Latin Extended subsets from the Fontsource 5.3.0 packages); nothing is fetched at runtime. Original license texts follow.

```text
Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito) Nunito-Italic[wght].ttf: Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

```text
Copyright 2019 The Quicksand Project Authors (https://github.com/andrew-paglinawan/QuicksandFamily.git), with Reserved Font Name "Quicksand"

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
