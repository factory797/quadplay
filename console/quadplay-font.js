/* Copyright 2026 Shmuel Ravensky, 2019-2025 Morgan McGuire. LGPL 3.0 License */
"use strict";
/**
 \file quadplay-font.js

 Font utility routines for both runtime and tools.

  - packFont

*/

/********************************************************************************************/

// This code block uses specific unicode characters in the strings.
// They cannot be replaced with other, similar-looking unicode
// characters; that is the whole point of the alias map at the
// bottom. So, beware that there are potentially differences that you
// cannot see in the source between similar-looking strings!
//
// The final row is short because it contains the four-wide characters
//
// Map character to canonical character.
const fontMap = {};
const fontSubscriptChars = '₀₁₂₃₄₅₆₇₈₉₊₋₍₎ₐᵦₑₕᵢⱼₖₘₙₒᵣₛₜᵤₓ';
const fontChars =
`ABCDEFGHIJKLMNOPQRSTUVWXYZ↑↓;:,.
abcdefghijklmnopqrstuvwxyz←→<>\`'
0123456789+-()~!@#$%^&*_=?¼½¾⅓⅔⅕
⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁽⁾ᵃᵝᵈᵉʰⁱʲᵏᵐⁿᵒʳˢᵗᵘˣʸᶻ
αβγδεζηθικλμνξ§πρστυϕχψωςΓΔΘΛΞΠİ
‘ÀàÈèÒòÌìÙùŁłŚŠŞśšşØẞБДҐΣΦΨΩ{}[]
´ÁáÉéÓóÍíÚúĆćŽžŹźŻżøßбдґ©\\/|⌈⌉⌊⌋
ˆÂâÊêÔôÎîÛûÑñЖЗИЙЛПЦЧШЩЄЭЮЯЪЫЬÆŒ
̈ÄäËëÖöÏïÜüŃńжзийлпцчшщєэюяъыьæœ
˚ÅåŘřĎďÝýŮůŇň±⊗↖↗♡○●◻◼△▲▼◀▶вн♢мт
˜ÃãĘęÕõЎўÇç¥€∫❖↙↘…‖♠♥♣♦✜★∞∅«»°∩∪
ˇĄąĚěŤťĞğČč£✓г≟≠≤≥≈"¿¡¬⊢∙×∈♆ℵı¸☆
■ⓆⓏⓌⒶⓈⒹⒾⒿⓀⓁ⍐⍇⍗⍈ⓛⓡ①②③④⑤⑥⑦⑧⑨⓪⊖⊕⓵⒜Ⓡ
◉ⓐⓑⓒⓓⓔ⓷ⓕⓖⓗⓜⓝⓟⓠⓤⓥⓧⓨⓩ⦸⬙⬗⬖⬘Ⓞ⍍▣⧉☰⒧⒭ 
␣Ɛ⏎ҕﯼડƠ⇥
⬁⬀⌥     `;

// ⒜ = circled à
// ⓷ = circled è
// ⓤ = circled ù
// ⓵ = circled !
// ◉ = default button prompt
// ■ = default arrow prompt
// ‘ = ◌̀. The grave ` is already used for single-quote
//     so we swap their meanings in the font table

// Word forms of last two rows: SPC ENT RET SEL STR SHR OPT TAB / LSH RSH
// This is used by fontgen.
const fontSpecials = {
    '␣':'SPACE',
    'Ɛ':'ENTER',
    '⏎':'RETURN',
    'ҕ':'SELECT',
    'ﯼ':'START',
    'ડ':'SHARE',
    'Ơ':'OPTION',
    '⇥':'TAB',

    '⬁':'L.SHIFT',
    '⬀':'R.SHIFT',
    '⌥':'ALT'};

const FONT_COLS = 32;
// Accounts for the 4x characters on the last two rows, and the missing last newline
const FONT_ROWS = Math.floor((fontChars.length + 1) / (FONT_COLS + 1)) + 2;

// For visualization purposes, all characters that
// can be generated are flagged here.
const fontCharCanBeGenerated = {};

{
    // Build the font map. 
    for (let i = 0, x = 0, y = 0; i < fontChars.length; ++i, ++x) {
        const c = fontChars[i];
        if (c === '\n') { // newline resets
            x = -1; ++y;
        } else if (c !== ' ') { // skip spaces
            console.assert(fontMap[c] === undefined);
            fontMap[c] = c;
        }
    }
    
    for (let i = 0; i < fontSubscriptChars.length; ++i) {
        fontMap[fontSubscriptChars[i]] = fontSubscriptChars[i];
    }

    // Add aliased characters. The first character in each string
    // appears in chars above.  The others are ones that should map to
    // it. To disambiguate characters when debugging, use
    // `'◼'.charCodeAt(0).toString(16)`
    
    const aliases = ['aа',
                     'AΑА',
                     'BΒВ',
                     'ÇҪ',
                     'çҫ',
                     'cс',
                     'EΕЕ',
                     'eе',
                     'HНΗ',
                     'IΙІ',
                     'iі',
                     'jј',
                     'JЈ',
                     'KΚК',
                     'MМΜ',
                     'NΝ',
                     'OОΟ',
                     'oοо',
                     'PРΡ',
                     'pр',
                     'sѕ',
                     'SЅ',
                     'TТΤ',
                     'xх',
                     'XΧХ',
                     'YΥ',
                     'yу',
                     'ZΖ',
                     'ΦФ',
                     'ϕф',
                     "'’",
                     'ΓГ',
                     'κк',
                     '∙•',
                     '◻▢□',
                     '◼◼',
                     '-─—━⎯',
                     '△▵',
                     '▲▴',
                     '▼▾',
                     '♥❤🖤💙💚💛💜💖',
                     '♦◆◇',
                     '…⋯',
                     '▶▷⊳ᐅ▹▻',
                     '◀◁⊲ᐊ◃◅⨞',
                     '‖∥𝄁║Ⅱǁ',
                     '⍐⍓⬆️',
                     '⍇⬅️',
                     '⍗⍌⬇️',
                     '⍈➡️'];
    
    for (let i = 0; i < aliases.length; ++i) {
        const a = aliases[i];
        console.assert(fontMap[a[0]] !== undefined, a[0]); // All targets in map
        for (let j = 1; j < a.length; ++j) {
            console.assert(j !== a[0]); // No duplicates!
            fontMap[a[j]] = a[0];
        }
    }

    Object.freeze(fontMap);
}


function isDigit(c) {
    c = c.charCodeAt(0);
    return (c >= 48) && (c <= 57);
}


/** Index is autodetected if not specified */
function computeFontSingleCharacterBounds(srcMask, char_size, bounds, c, index) {
    if (index === undefined) {
        index = fontChars.indexOf(c);
    }
    
    const firstWideGlyph = (FONT_ROWS - 2) * (FONT_COLS + 1);

    const charScale = (index < firstWideGlyph) ? 1 : 4;

    const charX = (index < firstWideGlyph) ?
          (index % (FONT_COLS + 1)) :
          ((index - firstWideGlyph) % (FONT_COLS / 4 + 1));

    const charY = (index < firstWideGlyph) ?
          Math.floor(index / (FONT_COLS + 1)) :
          (Math.floor((index - firstWideGlyph) / (FONT_COLS / 4 + 1)) + (FONT_ROWS - 2));

    // Find tightest non-black bounds on each character
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (let y = charY * char_size.y; y < (charY + 1) * char_size.y; ++y) {
        for (let x = charX * char_size.x * charScale; x < (charX + 1) * char_size.x * charScale; ++x) {
            if (array2DGet(srcMask, x, y)) {
                x1 = Math.min(x, x1); y1 = Math.min(y, y1);
                x2 = Math.max(x, x2); y2 = Math.max(y, y2);
            }
        } // for x
    } // for y
    
    let empty = false;
    if (y1 === Infinity) {
        // The entire box was empty. Put both bounds in
        // the center of the box.
        y1 = y2 = ((charY + 0.5) * char_size.y) | 0;
        x1 = x2 = ((charX + 0.5) * char_size.y) | 0;
        empty = true;
    }
    
    const b = {
        x1:x1, y1:y1, x2:x2, y2:y2,
        empty:empty,
        
        // Used to visualize generated characters
        // in art tools
        generated:(bounds[c] && bounds[c].generated),
        
        // Used to simplify generation logic later
        srcX: charX * char_size.x, srcY:charY * char_size.y,
        srcWidth: char_size.x, srcHeight: char_size.y
    };

    bounds[c] = b;

    return b;
}


/** Helper for packFont. Returns [tightY1, tightY2, _charWidth] */
function computeAllFontCharacterBounds(srcMask, char_size, bounds) {
    // Tightest vertical bounding box across all characters
    let tightY1 = Infinity, tightY2 = -Infinity;
    
    // Tightest width across all characters
    let _charWidth = 0;

    for (let charY = 0; charY < FONT_ROWS; ++charY) {
        const charScale = (charY < FONT_ROWS - 2) ? 1 : 4;
        for (let charX = 0; charX < FONT_COLS / charScale; ++charX) {
            const yTile = char_size.y * charY;
            
            // fontChars is actually an extra character wide because
            // it has newlines in it
            const index =
                  charX + Math.min(charY, FONT_ROWS - 2) * (FONT_COLS + 1) +
                  Math.max(charY - (FONT_ROWS - 2), 0) * (FONT_COLS / 4 + 1);
            const c = fontChars[index];
            
            if (c !== ' ') {
                const b = computeFontSingleCharacterBounds(srcMask, char_size, bounds, c, index);
                tightY1 = Math.min(tightY1, b.y1 - yTile);
                tightY2 = Math.max(tightY2, b.y2 - yTile);     
                _charWidth = Math.max(_charWidth, Math.ceil((b.x2 - b.x1 + 1) / charScale));
            } // if not space
        }
    }
    
    // Compute tight bounds on letters so that we can repack.
    return [tightY1, tightY2, _charWidth];
}


/** Called by packFont to generate the accent for dst if needed.
    If shiftY is true, move the source letter up before adding
    the accent (used for Ў)
 */
function packFontGenerateAccent(dst, srcLetter, srcAccent, srcMask, bounds, shiftLetterY) {
    packFontCombine(dst, srcLetter, srcAccent, srcMask, bounds, shiftLetterY ? 'bottom' : '', 'top');
}

function packFontGenerateFraction(dst, srcNumerator, srcDenominator, srcMask, bounds) {
    if (packFontCombine(dst, '/', srcNumerator, srcMask, bounds, '', '', 'left')) {
        packFontCombine(dst, dst, srcDenominator, srcMask, bounds, '', 'bottom', 'right');
    }
}

function packFontGenerateTail(dst, A, srcMask, bounds, xAlignTail) {
    packFontCombine(dst, A, '¸', srcMask, bounds, '', 'bottom', xAlignTail);
}

function packFontSuperimpose(dst, A, B, srcMask, bounds) {
    packFontCombine(dst, A, B, srcMask, bounds, '', '');
}

function packFontGenerateTick(dst, A, srcMask, bounds, yAlign = 'top') {
    packFontCombine(dst, A, "'", srcMask, bounds, '', yAlign, 'right');
}


/** Copies one letter, with an optional x or y flip. Used at font load
    time by packFont when generating missing letters at runtime. 
    
    If flipped vertically, the flipping centers to preserve the
    character bounds, unless doing so would go outside of the tile
    bounds.
*/
function packFontCopy(dst, srcA, srcMask, bounds, xSign = 1, ySign = 1) {
    console.assert(Math.abs(ySign) == 1);
    console.assert(Math.abs(xSign) == 1);
    let dstBounds = bounds[dst];
    const srcABounds = bounds[srcA];

    // Used for visualizations
    fontCharCanBeGenerated[dst] = true;
    
    // Nothing to do if the source does not exist or the destination
    // already exists
    if (! dstBounds.empty || srcABounds.empty) { return false; }
    
    // Copy the base letter
    if (xSign === 1 && ySign === 1) {
        array2DSetRect(srcMask, dstBounds.srcX, dstBounds.srcY, srcMask, srcABounds.srcX, srcABounds.srcY, srcABounds.srcWidth, srcABounds.srcHeight);
    } else {
        // Flips

        const distanceFromTop = srcABounds.y1 - srcABounds.srcY;
        const distanceFromBottom = srcABounds.srcY + srcABounds.srcHeight - 1 - srcABounds.y2;
        const dstShiftY = (ySign < 0) ?
              (srcABounds.srcHeight - 1 + distanceFromTop - distanceFromBottom) :
              0;
        for (let y = 0; y < srcABounds.srcHeight; ++y) {
            const srcY = srcABounds.srcY + y, dstY = dstBounds.srcY + y * ySign + dstShiftY;
            for (let x = 0; x < srcABounds.srcWidth; ++x) {
                const srcX = srcABounds.srcX + x, dstX = dstBounds.srcX + x * xSign + ((xSign < 0) ? (srcABounds.srcWidth - 1) : 0);
                const s = array2DGet(srcMask, srcX, srcY);
                array2DSet(srcMask, dstX, dstY, s);
            } // x
        } // y
    }

    // Flag as generated
    dstBounds.generated = true;
    dstBounds.empty = false;

    dstBounds = computeFontSingleCharacterBounds(srcMask, {x:dstBounds.srcWidth, y:dstBounds.srcHeight}, bounds, dst);
    return true;
}


function packFontErode(dst, src, srcMask, bounds) {
    let dstBounds = bounds[dst];
    const srcBounds = bounds[src];

    // Used for visualizations
    fontCharCanBeGenerated[dst] = true;
    
    // Nothing to do if the source does not exist or the destination
    // already exists
    if (! dstBounds.empty || srcBounds.empty) { return false; }
    
    const distanceFromTop = srcBounds.y1 - srcBounds.srcY;
    const distanceFromBottom = srcBounds.srcY + srcBounds.srcHeight - 1 - srcBounds.y2;

    for (let y = 0; y < srcBounds.srcHeight; ++y) {
        const srcY = srcBounds.srcY + y, dstY = dstBounds.srcY + y;
        for (let x = 0; x < srcBounds.srcWidth; ++x) {
            const srcX = srcBounds.srcX + x, dstX = dstBounds.srcX + x;

            // Copy each pixel unless all of its 4-ring neighbors are
            // in bounds and all white.
            if (x === 0 || y === 0 || x === srcBounds.srcWidth - 1 || y === srcBounds.srcHeight - 1 ||
                ! array2DGet(srcMask, srcX - 1, srcY) ||
                ! array2DGet(srcMask, srcX + 1, srcY) ||
                ! array2DGet(srcMask, srcX, srcY - 1) ||
                ! array2DGet(srcMask, srcX, srcY + 1)) {
                const s = array2DGet(srcMask, srcX, srcY);
                array2DSet(srcMask, dstX, dstY, s);
            }
        } // x
    } // y

    // Flag as generated
    dstBounds.generated = true;
    dstBounds.empty = false;

    dstBounds = computeFontSingleCharacterBounds(srcMask, {x:dstBounds.srcWidth, y:dstBounds.srcHeight}, bounds, dst);
    return true;
}


/** Helper for the other packFontGenerate methods. srcB may be the
    empty string. srcA may be dst

    Returns true if anything was generated, false if the character
    already existed
 */
function packFontCombine(dst, srcA, srcB, srcMask, bounds, yAlignA, yAlignB, xAlignB, operation = bitOr) {
    // Used for visualizations
    fontCharCanBeGenerated[dst] = true;

    let dstBounds = bounds[dst];
    const srcABounds = bounds[srcA];

    // Nothing to do if the source does not exist or the destination
    // already exists. In the case where the destination is the same
    // as srcA allow execution--this is only used internally for
    // compositing
    if ((! dstBounds.empty && dst !== srcA) || srcABounds.empty) { return false; }

    // Perform the remapping. We use ` to make the calling code more
    // self documenting
    if (srcB === '`') { srcB = '‘'; }

    const srcBBounds = (srcB !== '') ? bounds[srcB] : undefined;

    // Copy the base letter
    if (dst !== srcA) {
        if (yAlignA === 'bottom') {
            const baseline = bounds['E'].y1 - bounds['E'].srcY;
            const yOffsetA = srcABounds.y1 - srcABounds.srcY - baseline;
            array2DSetRect(srcMask,
                           dstBounds.srcX,
                           dstBounds.srcY + yOffsetA,
                           srcMask,
                           srcABounds.srcX,
                           srcABounds.y1,
                           srcABounds.srcWidth,
                           srcABounds.y2 - srcABounds.y1 + 1);
        } else {
            array2DSetRect(srcMask, dstBounds.srcX, dstBounds.srcY, srcMask, srcABounds.srcX, srcABounds.srcY, srcABounds.srcWidth, srcABounds.srcHeight);
        }
        
        // We *could* update the bounds mathematically, but it is easier
        // to just rescan
        dstBounds = computeFontSingleCharacterBounds(srcMask, {x:dstBounds.srcWidth, y:dstBounds.srcHeight}, bounds, dst);
        if (srcA == dst) {
            srcABounds = dstBounds;
        }
    }
    
    // Combine the detail
    if (srcBBounds) {
        // Center the accent
        let xOffsetB = 0;

        if (xAlignB === 'left') {
            xOffsetB = (srcABounds.x1 - srcABounds.srcX) - (srcBBounds.x1 - srcBBounds.srcX) 
        } else if (xAlignB === 'right') {
            // Align the right edges of A and B
            xOffsetB =
                (srcBBounds.srcX + srcBBounds.srcWidth - srcBBounds.x2 - 1) -
                (srcABounds.srcX + srcABounds.srcWidth - srcABounds.x2 - 1);
        } else if (xAlignB === 'after-jam' || xAlignB === 'after') {
            // Overlap the left edge of B with the right edge of A by 1 pixel
            xOffsetB =
                (srcABounds.srcX + srcABounds.srcWidth - srcABounds.x2) -
                (srcBBounds.x1 - srcBBounds.srcX);
            if (xAlignB === 'after') {
                xOffsetB -= 1;
            }
        } else { // Center
            xOffsetB = Math.floor(
                ((srcBBounds.srcWidth - 1) / 2 -
                 ((srcBBounds.x2 + srcBBounds.x1) / 2 - srcBBounds.srcX)) -
                    
                ((srcABounds.srcWidth - 1) / 2 -
                 ((srcABounds.x2 + srcABounds.x1) / 2 - srcABounds.srcX)));
        }
        // Do not offset out of the character box
        xOffsetB = Math.max(xOffsetB, srcBBounds.srcX - srcBBounds.x1);
        xOffsetB = Math.min(xOffsetB, srcBBounds.srcX + srcBBounds.srcWidth - 1- srcBBounds.x2);
    
        let yOffsetB = 0;

        const topA    = srcABounds.y1 - srcABounds.srcY;
        const bottomA = srcABounds.y2 - srcABounds.srcY;
        const topB    = srcBBounds.y1 - srcBBounds.srcY;
        const bottomB = srcBBounds.y2 - srcBBounds.srcY;
        
        if (yAlignB === 'top' || yAlignB === 'top-jam') {
            yOffsetB = topA - bottomB - (yAlignB === 'top-jam' ? 0 : 2);
        } else if (yAlignB === 'bottom') {
            yOffsetB = (srcABounds.y2 - srcABounds.srcY) - (srcBBounds.y2 - srcBBounds.srcY) + 2;
        } else if (yAlignB === 'center') {
            yOffsetB = Math.floor(((bottomA + bottomB) - (topA + topB)) / 2 +
                                  topB - topA);
        }
        
        // Do not offset out of the character box
        yOffsetB = Math.min(
            Math.max(-topB, yOffsetB),
            srcBBounds.srcHeight - (srcBBounds.y2 - srcBBounds.y1 + 1));

        // Because we're using OR, it is ok to copy excess black space
        array2DSetRect(srcMask, dstBounds.srcX + xOffsetB, dstBounds.srcY + yOffsetB, srcMask, srcBBounds.srcX, srcBBounds.srcY, srcBBounds.srcWidth, srcBBounds.srcHeight, operation);
        
        // We *could* update the bounds mathematically, but it is easier
        // to just rescan
        dstBounds = computeFontSingleCharacterBounds(srcMask, {x:dstBounds.srcWidth, y:dstBounds.srcHeight}, bounds, dst);
    }

    // Flag as generated
    dstBounds.generated = true;
    dstBounds.empty = false;

    return true;
}

/** 
    Given an object, parameters, an xy() spacing, and a [binary as 0
    and 255 values] Uint8Array srcMask augmented with width and height
    fields, packs the font characters tightly inside the object and
    creates fields including $data and $bounds.

    Used by loadFont() in quadplay-load.js and by fontpack.html.
*/
function packFont(font, borderSize, shadowSize, baseline, char_size, spacing, srcMask, generateMissingCharacters = true, char_min_width = 0) {
    font.spacing = spacing;
    font.$borderSize = borderSize;
    font.$shadowSize = shadowSize;

    // Maps characters to tight bounding boxes in the
    // srcMask. Elements that are .empty have no pixels within
    // them. Elements that are .generated had no pixels in the
    // original font sheet but were synthesized during load.
    let bounds = {};

    let [tightY1, tightY2, _charWidth] = computeAllFontCharacterBounds(srcMask, char_size, bounds);

    if (generateMissingCharacters) {
        // Do not generate accents if the font is small
        // because it might no accent is probably better.
        if (tightY2 - tightY1 + 1 >= 8) {
            packFontCopy('‘', "`", srcMask, bounds);
            packFontCopy('ˆ', '^', srcMask, bounds);
            packFontCopy('˚', '°', srcMask, bounds);
            packFontCopy('˜', '~', srcMask, bounds);
            packFontCopy('ˇ', 'ˆ', srcMask, bounds, 1, -1);
            packFontCombine('̈', '.', '.', srcMask, bounds, '', '', 'after');
        }

        packFontCombine(';', ',', '.', srcMask, bounds, '', 'top', 'right');
        packFontGenerateAccent(':', '.', '.', srcMask, bounds);
        
        // Degree from exponent zero
        packFontCopy('°', 'ᵒ', srcMask, bounds);
        packFontCopy('■', '◼', srcMask, bounds);
        packFontCopy('◉', '●', srcMask, bounds);
        
        packFontCopy('И', 'N', srcMask, bounds, -1);
        packFontCopy('Я', 'R', srcMask, bounds, -1);
        packFontCopy('Є', 'Э', srcMask, bounds, -1);
        packFontCopy('є', 'э', srcMask, bounds, -1);
        
        packFontCopy('↗', '↖', srcMask, bounds, -1);
        packFontCopy('↙', '↖', srcMask, bounds, 1, -1);
        packFontCopy('↘', '↙', srcMask, bounds, -1);
        packFontCopy('▶', '◀', srcMask, bounds, -1);
        packFontCopy('→', '←', srcMask, bounds, -1);
        packFontCopy('´', '‘', srcMask, bounds, -1);
        packFontCopy('>', '<', srcMask, bounds, -1);
        packFontCopy(')', '(', srcMask, bounds, -1);
        packFontCopy('}', '{', srcMask, bounds, -1);
        packFontCopy('⁾', '⁽', srcMask, bounds, -1);
        packFontCopy('/', '\\', srcMask, bounds, -1);
        packFontCopy('⌉', '⌈', srcMask, bounds, -1);
        packFontCopy('⌊', '⌈', srcMask, bounds, 1, -1);
        packFontCopy('⌋', '⌊', srcMask, bounds, -1);
        packFontSuperimpose('[', '⌊', '⌈', srcMask, bounds);
        packFontCopy(']', '[', srcMask, bounds, -1);
        packFontCopy('¿', '?', srcMask, bounds, -1, -1);
        packFontCopy('¡', '!', srcMask, bounds, 1, -1);
        packFontCopy('↓', '↑', srcMask, bounds, 1, -1);
        packFontCopy('▼', '▲', srcMask, bounds, 1, -1);
        packFontCopy('∪', '∩', srcMask, bounds, 1, -1);
        // Prefer flipping the union symbol, but if neither is present
        // then flip the letter U
        packFontCopy('∩', 'U', srcMask, bounds, 1, -1);
        packFontCopy('∪', '∩', srcMask, bounds, 1, -1);
        
        packFontGenerateFraction('¼', '¹', '⁴', srcMask, bounds);
        packFontGenerateFraction('½', '¹', '²', srcMask, bounds);
        packFontGenerateFraction('¾', '⁴', '³', srcMask, bounds);
        packFontGenerateFraction('⅓', '¹', '³', srcMask, bounds);
        packFontGenerateFraction('⅔', '²', '³', srcMask, bounds);
        packFontGenerateFraction('⅕', '¹', '⁵', srcMask, bounds);

        packFontGenerateAccent('İ', 'I', '.', srcMask, bounds);

        packFontGenerateAccent('À', 'A', '`', srcMask, bounds);
        packFontGenerateAccent('à', 'a', '`', srcMask, bounds);
        packFontGenerateAccent('È', 'E', '`', srcMask, bounds);
        packFontGenerateAccent('è', 'e', '`', srcMask, bounds);
        packFontGenerateAccent('Ò', 'O', '`', srcMask, bounds);
        packFontGenerateAccent('ò', 'o', '`', srcMask, bounds);
        packFontGenerateAccent('Ì', 'I', '`', srcMask, bounds);
        packFontGenerateAccent('ì', 'ı', '`', srcMask, bounds);
        packFontGenerateAccent('Ù', 'U', '`', srcMask, bounds);
        packFontGenerateAccent('ù', 'u', '`', srcMask, bounds);
        packFontGenerateAccent('Ù', 'U', '`', srcMask, bounds);
        packFontGenerateAccent('Ś', 'S', '´', srcMask, bounds);
        packFontGenerateAccent('ś', 'S', '´', srcMask, bounds);
        packFontGenerateAccent('Š', 'S', 'ˇ', srcMask, bounds);
        packFontGenerateAccent('š', 's', 'ˇ', srcMask, bounds);
        packFontGenerateTail('Ş', 'S', srcMask, bounds);
        packFontGenerateTail('ş', 's', srcMask, bounds);
        packFontSuperimpose('Ł', 'L', '/', srcMask, bounds);
        packFontSuperimpose('ł', 'l', '/', srcMask, bounds);
        packFontSuperimpose('Ø', 'O', '/', srcMask, bounds);    
        packFontGenerateTick('Ґ', 'Γ', srcMask, bounds, 'top-jam');
        packFontGenerateTick('ґ', 'г', srcMask, bounds, 'top-jam');
        packFontSuperimpose('$', 'S', '|', srcMask, bounds);
        packFontGenerateFraction('%', 'ᵒ', 'ᵒ', srcMask, bounds);

        packFontGenerateAccent('Á', 'A', '´', srcMask, bounds);
        packFontGenerateAccent('á', 'a', '´', srcMask, bounds);
        packFontGenerateAccent('É', 'E', '´', srcMask, bounds);
        packFontGenerateAccent('é', 'e', '´', srcMask, bounds);
        packFontGenerateAccent('Ó', 'O', '´', srcMask, bounds);
        packFontGenerateAccent('ó', 'o', '´', srcMask, bounds);
        packFontGenerateAccent('Í', 'I', '´', srcMask, bounds);
        packFontGenerateAccent('í', 'ı', '´', srcMask, bounds);
        packFontGenerateAccent('Ú', 'U', '´', srcMask, bounds);
        packFontGenerateAccent('ú', 'u', '´', srcMask, bounds);
        packFontGenerateAccent('Ć', 'C', '´', srcMask, bounds);
        packFontGenerateAccent('ć', 'c', '´', srcMask, bounds);
        packFontGenerateAccent('Ž', 'Z', 'ˇ', srcMask, bounds);
        packFontGenerateAccent('ž', 'z', 'ˇ', srcMask, bounds);
        packFontGenerateAccent('Ź', 'Z', '´', srcMask, bounds);
        packFontGenerateAccent('ź', 'z', '´', srcMask, bounds);
        packFontGenerateAccent('Ż', 'Z', '.', srcMask, bounds);
        packFontGenerateAccent('ż', 'z', '.', srcMask, bounds);
        packFontSuperimpose('ø', 'o', '/', srcMask, bounds);
        
        packFontGenerateAccent('Â', 'A', 'ˆ', srcMask, bounds);
        packFontGenerateAccent('â', 'a', 'ˆ', srcMask, bounds);
        packFontGenerateAccent('Ê', 'E', 'ˆ', srcMask, bounds);
        packFontGenerateAccent('ê', 'e', 'ˆ', srcMask, bounds);
        packFontGenerateAccent('Ô', 'O', 'ˆ', srcMask, bounds);
        packFontGenerateAccent('ô', 'o', 'ˆ', srcMask, bounds);
        packFontGenerateAccent('Î', 'I', 'ˆ', srcMask, bounds);
        packFontGenerateAccent('î', 'ı', 'ˆ', srcMask, bounds);
        packFontGenerateAccent('Û', 'U', 'ˆ', srcMask, bounds);
        packFontGenerateAccent('û', 'u', 'ˆ', srcMask, bounds);
        packFontGenerateAccent('Ñ', 'N', '˜', srcMask, bounds);
        packFontGenerateAccent('ñ', 'n', '˜', srcMask, bounds);
        packFontGenerateAccent('Й', 'И', 'ˇ', srcMask, bounds);
        packFontSuperimpose('Ж', 'X', '|', srcMask, bounds);
        packFontCopy('З', '3', srcMask, bounds);
        packFontCopy('П', 'Π', srcMask, bounds);
        packFontCombine('Æ', 'A', 'E', srcMask, bounds, '', '', 'after-jam');
        packFontCombine('Œ', 'O', 'E', srcMask, bounds, '', '', 'after-jam');

        packFontGenerateAccent('Ä', 'A', '̈', srcMask, bounds);
        packFontGenerateAccent('ä', 'a', '̈', srcMask, bounds);
        packFontGenerateAccent('Ë', 'E', '̈', srcMask, bounds);
        packFontGenerateAccent('ë', 'e', '̈', srcMask, bounds);
        packFontGenerateAccent('Ö', 'O', '̈', srcMask, bounds);
        packFontGenerateAccent('ö', 'o', '̈', srcMask, bounds);
        packFontGenerateAccent('Ï', 'I', '̈', srcMask, bounds);
        packFontGenerateAccent('ï', 'ı', '̈', srcMask, bounds);
        packFontGenerateAccent('Ü', 'U', '̈', srcMask, bounds);
        packFontGenerateAccent('ü', 'u', '̈', srcMask, bounds);
        packFontGenerateAccent('Ń', 'N', '´', srcMask, bounds);
        packFontGenerateAccent('ń', 'n', '´', srcMask, bounds);    
        packFontGenerateAccent('й', 'и', 'ˇ', srcMask, bounds);
        packFontCombine('æ', 'a', 'e', srcMask, bounds, '', '', 'after-jam');
        packFontCombine('œ', 'o', 'e', srcMask, bounds, '', '', 'after-jam');

        packFontGenerateAccent('Å', 'A', '˚', srcMask, bounds);
        packFontGenerateAccent('å', 'a', '˚', srcMask, bounds);
        packFontGenerateAccent('Ř', 'R', 'ˇ', srcMask, bounds);
        packFontGenerateAccent('ř', 'r', 'ˇ', srcMask, bounds);
        packFontGenerateAccent('Ď', 'D', 'ˇ', srcMask, bounds);
        packFontGenerateTick('ď', 'd', srcMask, bounds);
        packFontGenerateAccent('Ý', 'Y', '´', srcMask, bounds);
        packFontGenerateAccent('ý', 'y', '´', srcMask, bounds);
        packFontGenerateAccent('Ů', 'U', '˚', srcMask, bounds);
        packFontGenerateAccent('ů', 'u', '˚', srcMask, bounds);
        packFontGenerateAccent('Ň', 'N', 'ˇ', srcMask, bounds);
        packFontGenerateAccent('ň', 'n', 'ˇ', srcMask, bounds);
        packFontErode('♡', '♥', srcMask, bounds); 
        packFontErode('○', '●', srcMask, bounds); 
        packFontErode('◻', '◼', srcMask, bounds); 
        packFontErode('△', '▲', srcMask, bounds); 
        packFontErode('♢', '♦', srcMask, bounds);
        packFontSuperimpose('⊗', '×', '○', srcMask, bounds);
        packFontSuperimpose('±', '+', '_', srcMask, bounds);
        
        packFontGenerateAccent('Ã', 'A', '˜', srcMask, bounds);
        packFontGenerateAccent('ã', 'a', '˜', srcMask, bounds);
        packFontGenerateTail('Ę', 'E', srcMask, bounds);
        packFontGenerateTail('ę', 'e', srcMask, bounds);
        packFontGenerateAccent('Õ', 'O', '˜', srcMask, bounds);
        packFontGenerateAccent('õ', 'o', '˜', srcMask, bounds);
        packFontGenerateAccent('Ў', 'y', 'ˇ', srcMask, bounds, true);
        packFontGenerateAccent('ў', 'y', 'ˇ', srcMask, bounds);
        packFontGenerateTail('Ç', 'C', srcMask, bounds);
        packFontGenerateTail('ç', 'c', srcMask, bounds);
        packFontSuperimpose('∅', '○', '/', srcMask, bounds);
        packFontSuperimpose('≠', '=', '/', srcMask, bounds);
        packFontSuperimpose('≤', '<', '_', srcMask, bounds);
        packFontCopy('≥', '≤', srcMask, bounds, -1);
        packFontSuperimpose('¥', 'Y', '=', srcMask, bounds);
        packFontSuperimpose('€', 'C', '=', srcMask, bounds);
        packFontCombine('‖', '|', '|', srcMask, bounds, '', '', 'after');
        // Three period combine
        if (packFontCombine('…', '.', '.', srcMask, bounds, '', '', 'after')) {
            packFontCombine('…', '…', '.', srcMask, bounds, '', '', 'after');
        }
        packFontCombine('«', '<', '<', srcMask, bounds, '', '', 'after');
        packFontCopy('»', '«', srcMask, bounds, -1);

        packFontGenerateTail('Ą', 'A', srcMask, bounds, 'right');
        packFontGenerateTail('ą', 'a', srcMask, bounds);
        packFontGenerateAccent('Ě', 'E', 'ˇ', srcMask, bounds);
        packFontGenerateAccent('ě', 'e', 'ˇ', srcMask, bounds);
        packFontGenerateAccent('Ť', 'T', 'ˇ', srcMask, bounds);
        packFontGenerateTick('ť', 't', srcMask, bounds);
        packFontGenerateAccent('Ğ', 'G', 'ˇ', srcMask, bounds);
        packFontGenerateAccent('ğ', 'g', 'ˇ', srcMask, bounds);
        packFontGenerateAccent('Č', 'C', 'ˇ', srcMask, bounds);
        packFontGenerateAccent('č', 'c', 'ˇ', srcMask, bounds);
        packFontCombine('"', '\'', '\'', srcMask, bounds, '', '', 'after');
        packFontCopy('∈', 'Є', srcMask, bounds);
        packFontErode('☆', '★', srcMask, bounds);
        
        packFontCopy('⍈', '⍇', srcMask, bounds, -1);
        packFontCopy('⍗', '⍐', srcMask, bounds, +1, -1);
        packFontCopy('⬙', '⦸', srcMask, bounds, -1);
        packFontCombine('①', '◉', '¹', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('②', '◉', '²', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('③', '◉', '³', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('④', '◉', '⁴', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('⑤', '◉', '⁵', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('⑥', '◉', '⁶', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('⑦', '◉', '⁷', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('⑧', '◉', '⁸', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('⑨', '◉', '⁹', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('⓪', '◉', '⁰', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('⊖', '◉', '⁻', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('⊕', '◉', '⁺', srcMask, bounds, '', 'center', 'center', bitXor);

        if (packFontCombine('Ⓡ', '■', '⒭', srcMask, bounds, '', '', '', bitXor)) {
            packFontCombine('Ⓡ', 'Ⓡ', '◉', srcMask, bounds, '', '', '', bitXor)
        }

        packFontCombine('ⓐ', '◉', 'ᵃ', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('ⓓ', '◉', 'ᵈ', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('ⓔ', '◉', 'ᵉ', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('ⓜ', '◉', 'ᵐ', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('ⓝ', '◉', 'ⁿ', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('Ⓞ', '◉', 'ᵒ', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('ⓧ', '◉', 'ˣ', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('ⓨ', '◉', 'ʸ', srcMask, bounds, '', 'center', 'center', bitXor);
        packFontCombine('ⓩ', '◉', 'ᶻ', srcMask, bounds, '', 'center', 'center', bitXor);
        
        // See if the bounds must be recomputed
        for (let c in bounds) {
            if (bounds[c].generated) {
                [tightY1, tightY2, _charWidth] = computeAllFontCharacterBounds(srcMask, char_size, bounds);
                break;
            }
        }
    }
    

    // Compute fixed-width number spacing
    let digitWidth = 0;
    for (let i = 0; i <= 9; ++i) {
        digitWidth = Math.max(digitWidth, bounds['' + i].x2 - bounds['' + i].x1 + 1);
    }
    
    // Compute line spacing
    {
        // Use ascenders and descenders from these letters
        const measureLetters = 'gjypqQ7zAIPlt';
        let yMin = Infinity, yMax = -Infinity;
        for (let i = 0; i < measureLetters.length; ++i) {
            const b = bounds[measureLetters[i]];
            const baseY = Math.floor(b.y1 / char_size.y) * char_size.y;
            yMin = Math.min(yMin, b.y1 - baseY);
            yMax = Math.max(yMax, b.y2 - baseY);
        }
        font.line_height = yMax - yMin + 1 + spacing.y;
    }

    // Char width/height is the extent of each character's box in the
    // packed, padded image.  Allocate the final bitmap, including
    // padding for individual fonts.
    _charWidth += 2 * borderSize;
    font.$charWidth = _charWidth;
    font.$charHeight = (tightY2 - tightY1 + 1) + 2 * borderSize + shadowSize;
    font.glyph_size = Object.freeze({
        x: font.$charWidth  - 2 * borderSize,
        y: font.$charHeight - 2 * borderSize - shadowSize});
    
    // Baseline is the distance from the top of each box to the text
    // baseline.  Adjust the baseline for the new tight packing and
    // the border padding.
    font.$baseline = baseline - tightY1 + borderSize;

    // Extract each character. Masks are 4x wider than character width to
    // handle the wide chars as well. These all store 0 or 255 values. They
    // are combined into a single bitmask at the end.
    const colorMask        = array2DUint8(_charWidth * 4, font.$charHeight);
    const borderMask       = array2DUint8(_charWidth * 4, font.$charHeight);
    const shadowMask       = array2DUint8(_charWidth * 4, font.$charHeight);
    const shadowBorderMask = array2DUint8(_charWidth * 4, font.$charHeight);
    // Have to save the font size for postMessage, which cannot preserve
    // extended properties on typed arrays.
    font.$size = {x: _charWidth * FONT_COLS, y: font.$charHeight * FONT_ROWS};
    font.$data = array2DUint8(_charWidth * FONT_COLS, font.$charHeight * FONT_ROWS);
    font.$bounds = {};

    for (let charY = 0; charY < FONT_ROWS; ++charY) {
        const charScale = (charY < FONT_ROWS - 2) ? 1 : 4;
        for (let charX = 0; charX < FONT_COLS / charScale; ++charX) {
            // Reset
            array2DClear(colorMask, 0);
            array2DClear(borderMask, 0);
            array2DClear(shadowMask, 0);
            array2DClear(shadowBorderMask, 0);
            
            // +1 for the newline on each row.
            // Als take into account that the last two rows are short.
            const index = charX +
                  Math.min(charY, FONT_ROWS - 2) * (FONT_COLS + 1) +
                  Math.max(charY - (FONT_ROWS - 2), 0) * (FONT_COLS / 4 + 1);
            const chr = fontChars[index];
            console.assert(chr !== undefined, 'Undefined character at (' + charX + ', ' + charY + ')');
            
            if (chr !== ' ') {
                const srcBounds = bounds[chr];
                ////////////////////////////////////////////////////////////////
                // Extract the colorMask bits, offsetting appropriately
                console.assert(srcBounds.y2 - srcBounds.y1 + 1 <= colorMask.height);
                console.assert(srcBounds.x2 - srcBounds.x1 + 1 <= colorMask.width);
                console.assert(char_size.y * charY === Math.floor(srcBounds.y1 / char_size.y) * char_size.y);

                if (! srcBounds.empty) {
                    array2DSetRect(colorMask,
                                   srcBounds.x1 - srcBounds.x1 + borderSize,
                                   srcBounds.y1 - char_size.y * charY - tightY1 + borderSize,
                                   srcMask,
                                   srcBounds.x1, srcBounds.y1,
                                   srcBounds.x2 - srcBounds.x1 + 1,
                                   srcBounds.y2 - srcBounds.y1 + 1);
                }
                /*
                // For testing
                if (chr === '%') {
                    console.log(srcBounds);
                    console.log(colorMask);
                    array2DPrint(colorMask);
                }*/
                
                if (borderSize > 0) {
                    // Compute the borderMask from the colorMask 8-ring
                    makeBorderMask(colorMask, borderMask);
                }

                if (shadowSize > 0) {
                    // Compute the shadowMask from the colorMask
                    array2DMapSet(shadowMask, function(x, y) {
                        if (array2DGet(colorMask, x, y)) { return 0; }
                        for (let s = 1; s <= shadowSize; ++s) if (array2DGet(colorMask, x, y - s)) return 255;
                        return 0;
                    });

                    // Compute the shadowBorderMask from the colorMask
                    array2DMapSet(shadowBorderMask, function(x, y) {
                        if (array2DGet(borderMask, x, y)) { return 0; }
                        for (let s = 1; s <= shadowSize; ++s) if (array2DGet(borderMask, x, y - s)) return 255;
                        return 0;
                    });
                }
                
                ////////////////////////////////////////////////////////////////
                // Write to the packed bitmap
                console.assert(font.$charHeight === colorMask.height);

                // For testing
                //if (chr === 'ⓥ') { console.log(font, _charWidth); array2DPrint(colorMask); }
                
                for (let srcY = 0; srcY < font.$charHeight; ++srcY) {
                    //let tst = ''; // For testing
                    const dstY = font.$charHeight * charY + srcY;

                    for (let srcX = 0; srcX < _charWidth * charScale; ++srcX) {
                        const dstX = _charWidth * charScale * charX + srcX;
                        
                        const m  = array2DGet(colorMask, srcX, srcY);
                        const b  = array2DGet(borderMask, srcX, srcY);
                        const s  = array2DGet(shadowMask, srcX, srcY);
                        const sb = array2DGet(shadowBorderMask, srcX, srcY);
                            
                        // bits are: s+b | s | b | m
                        let mask = 0x0;
                        if (m) {
                            mask = 0x1;
                        } else {
                            if (b) { mask |= 0x2; }
                            if (s) { mask |= 0x4; }
                            if (sb) { mask |= 0x8; }
                        }
                        
                        //if (chr === '∫') { tst += (mask < 10 ? '0' : '') + mask + ' '; } // For testing
                        array2DSet(font.$data, dstX, dstY, mask);
                    } // srcX

                    //if (chr === '∫') { console.log(tst); }  // For testing
                } // srcY
                //if (chr === '%') { console.log(font); array2DPrint(font.$data, _charWidth * charScale * charX, font.$charHeight * charY, _charWidth * charScale, font.$charHeight); }
                
                // Compute the bounds of this character as an absolute position on the final image
                const tileX = _charWidth * charX * charScale, tileY = font.$charHeight * charY, srcTileY = char_size.y * charY;

                // Enforce padding for fixed width characters
                const min_width = Math.max(char_min_width, isDigit(chr) ? digitWidth : 0);
                
                let pre = 0, post = 0;
                if (min_width > 0) {
                    // If this is a digit, shift the pixels and x
                    // bounds based on the mandatory fixed digit width
                    // so that it is centered
                    const w = srcBounds.x2 - srcBounds.x1 + 1;
                    post = Math.max(Math.ceil((min_width - w) / 2) | 0, 0) | 0;
                    pre = Math.max(min_width - w - post, 0) | 0;

                    if ((chr === '1') && (post === pre + 1)) {
                        // For the digit 1, if we have to round do so
                        // to put the padding on the left. This makes
                        // a leading digit of 1 print more nicely.
                        --post; ++pre;
                    }
                }

                font.$bounds[chr] = {
                    x1: tileX,
                    x2: tileX + srcBounds.x2 - srcBounds.x1 + 2 * borderSize,
                    y1: tileY + (srcBounds.y1 - srcTileY - tightY1),
                    y2: tileY + (srcBounds.y2 - srcTileY - tightY1) + borderSize * 2 + shadowSize,
                    pre: pre,
                    post: post,
                    yOffset: 0
                };


                /* debugging
                if (chr === 'ⓥ') {
                    const b = font.$bounds[chr];
                    console.log(font, b);
                    array2DPrint(font.$data, b.x1, b.y1, b.x2 - b.x1 + 1, b.y2 - b.y1 + 1, false, 1);
                }
                */

            } // char !== ' '
            
        } // charX
    } // charY
    
    // Make bounds for the space and tab characters based on whichever
    // is larger of several thin characters.
    {
        const candidates = 'il¹;[|';
        let thickestBounds = null, thickestWidth = 0;
        for (let i = 0; i < candidates.length; ++i) {
            const c = candidates[i];
            const bounds = font.$bounds[c];
            const width = bounds.x2 - bounds.x1 + 1;
            if (width > thickestWidth) {
                thickestWidth = width;
                thickestBounds = bounds;
            }
        }
        font.$bounds[' '] = font.$bounds['\t'] = thickestBounds;
    }
        
    // Compute subscript bounds
    {
        const b = bounds['⁰'];
        const tileY = Math.floor(b.y1 / char_size.y) * char_size.y;
        const subscriptOffset = Math.floor(baseline + (b.y1 - b.y2) / 2);

        // Map a subscript to the corresponding superscript. Note that there
        // are OTHER superscripts that have no corresponding subscript.
        const subscript   = fontSubscriptChars;
        const superscript = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁽⁾ᵃᵝᵉʰⁱʲᵏᵐⁿᵒʳˢᵗᵘˣ';
        for (let i = 0; i < subscript.length; ++i) {
            const sub = subscript[i];
            const sup = superscript[i];
            const b = Object.assign({}, font.$bounds[sup]);
            b.yOffset = subscriptOffset;
            font.$bounds[sub] = Object.freeze(b);
        }
    }
}


/** Returns 1-bit image data expressed as a Uint8 array of 0x00 and 0xff values */
function getBinaryImageData(image) {
    const imageData = getImageData(image);

    // Extract and copy
    const N = (imageData.data.length / 4) | 0;
    const pixelData = array2DUint8(image.width, image.height);
    for (let i = 0; i < N; ++i) {
        pixelData.data[i] = (imageData.data[i * 4] >= 128) ? 255 : 0;
    }
    
    return pixelData;
}


function array2DUint8(w, h) {
    console.assert(w > 0 && h > 0);
    return Object.seal({width:w, height:h, data:new Uint8Array(w * h)});
}

/** x, y, w, h are optional 
    
    showValue: boolean. Show the actual value
    mask: bitand with the value read before testing
*/
function array2DPrint(a, x, y, w, h, showValue, mask = 0xff) {
    function twoCharHex(v) {
        return (v < 16 ? '0' : '') + v.toString(16);
    }
    
    if (x !== undefined) {
        const tmp = array2DUint8(w, h);
        array2DSetRect(tmp, 0, 0, a, x, y, w, h);
        a = tmp;
    }
    
    const bar = new Array(a.width + 1).join('━━');
    let s = '  ┏' + bar + '┓\n';
    for (let y = 0; y < a.height; ++y) {
        if (y < 10) { s += ' ' + y; } else { s += y; }
        s += '┃';
        for (let x = 0; x < a.width; ++x) {
            const m = a.data[x + y * a.width];
            s += (m & mask) && (showValue ? twoCharHex(m) : '█▋') || '· ';
        }
        s += '┃\n';
    }
    s += '  ┗' + bar + '┛';
    console.log(s);
}


function array2DGet(a, x, y) {
    if ((x >= 0) && (x < a.width) && (y >= 0) && (y < a.height)) {
        return a.data[x + y * a.width];
    } else {
        return undefined;
    }
}


function array2DClear(a, value) {
    a.data.fill(value);
}

function bitOr(A, B) { return A | B; }
function bitXor(A, B) { return A ^ B; }

function array2DSet(a, x, y, v) {
    if ((x >= 0) && (x < a.width) && (y >= 0) && (y < a.height)) { a.data[x + y * a.width] = v; }
}

/** Blit, optionally performing operation */
function array2DSetRect(dst,
                        dstX1,
                        dstY1,
                        src,
                        srcX1,
                        srcY1,
                        width,
                        height,
                        operation) {

    for (let y = 0; y < height; ++y) {
        const srcY = srcY1 + y, dstY = dstY1 + y;
        for (let x = 0; x < width; ++x) {
            const srcX = srcX1 + x, dstX = dstX1 + x;
            const s = array2DGet(src, srcX, srcY);
            let d;
            if (operation) {
                d = operation(array2DGet(dst, dstX, dstY), s);
            } else {
                d = s;
            }
            array2DSet(dst, dstX, dstY, d);
        } // x
    } // y
}


/** Set every value to a[x, y] = fcn(x, y) */
function array2DMapSet(a, fcn) {
    for (let y = 0; y < a.height; ++y) {
        for (let x = 0; x < a.width; ++x) {
            a.data[x + y * a.width] = fcn(x, y);
        }
    }
}


// Set the dstMask from the srcMask 8-ring
function makeBorderMask(srcMask, dstMask) {
    array2DMapSet(dstMask, function(x, y) {
        return (! array2DGet(srcMask, x, y) &&
                (array2DGet(srcMask, x - 1, y - 1) || array2DGet(srcMask, x, y - 1) || array2DGet(srcMask, x + 1, y - 1) ||
                 array2DGet(srcMask, x - 1, y) || array2DGet(srcMask, x + 1, y) ||
                 array2DGet(srcMask, x - 1, y + 1) || array2DGet(srcMask, x, y + 1) || array2DGet(srcMask, x + 1, y + 1))); });
}
