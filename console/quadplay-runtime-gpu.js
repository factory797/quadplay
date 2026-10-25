/* Copyright 2026 Shmuel Ravensky, 2019-2025 Morgan McGuire. LGPL 3.0 License */
'use strict';

var $Object = Object;
var $console = console;
var $Math = Math;
var $performance = performance;

// Is the GPU loaded as a Worker? Used so that the script could still
// be used as a library in frameworks that do not support Workers.
var $is_web_worker = (self.WorkerGlobalScope && typeof importScripts === 'function');


////////////////////////////////////////////////////////////
//
// Virtual GPU State
//
// These are also declared elsewhere, but when loading as a webworker
// they are needed here so that the GPU runtime can be standalone. The
// 'var' declaration lets them be multiply declared without error.

// Integer dimensions
var $SCREEN_WIDTH, $SCREEN_HEIGHT;

// Writeable framebuffer memory, 16bpp. Uint16Array. Allocated by $gpu_resize_framebuffer()
var $screen;

// 32 bpp output double buffer. Sent back to the main thread.
var $updateImageData32;
var $updateImageData;

// Draw list buffer. Array of command objects.
var $graphicsCommandList;

// Readable texture memory. Array of sprites/fonts
var $spritesheetArray;
var $fontArray;

////////////////////////////////////////////////////////////

if ($is_web_worker) {
    importScripts('quadplay-runtime-common.js', 'quadplay-runtime-gpu-wasm.js');

    // Hold messages until the primitives have loaded
    const pending = [];
    self.onmessage = function (event) { pending.push(event.data); };

    $gpu_load().then(function () {
        self.onmessage = function (event) { $gpu_message(event.data); };
        for (const data of pending) { $gpu_message(data); }
    });
}


function $gpu_message(data) {
    // console.log('Event received:', data.type);

    switch (data.type) {
    case 'set_texture':
        // Fix the extended properties, which are not copied by
        // the built-in JavaScript copying/buffer transfer.
        for (let sheet of data.spritesheetArray) {
            sheet.$uint16DataFlippedX.width = sheet.$uint16Data.width = sheet.size.x;
            sheet.$uint16DataFlippedX.height = sheet.$uint16Data.height = sheet.size.y;
        }
        for (let font of data.fontArray) {
            font.$data.width = font.$size.x;
            font.$data.height = font.$size.y;
        }

        $gpu_set_texture(data.spritesheetArray, data.fontArray);
        break;

    case 'resize_framebuffer':
        $gpu_resize_framebuffer(data.SCREEN_WIDTH, data.SCREEN_HEIGHT);
        break;

    case 'gpu_execute':
        $updateImageData32 = data.updateImageData32;
        $updateImageData = data.updateImageData;
        $gpu_execute(...data.args);
        break;
    } // switch
}


function $square(x) { return x * x; }

/** Used by gpu_execute() */
function $zSort(a, b) { return a.z - b.z; }


// Stores on itself the .prevHash and .prevCommandListLength to identify duplicate frames
function $gpu_execute(commandList, backgroundSpritesheetIndex, backgroundColor16) {
    const startTime = performance.now();
    commandList.sort($zSort);

    // Clear the screen
    if (backgroundSpritesheetIndex !== undefined) {
        // Image background
        $gpu_clear_spritesheet(backgroundSpritesheetIndex);
    } else {
        // Color background (force alpha = 1)
        $gpu_clear(backgroundColor16);
    }

    for (let i = 0; i < commandList.length; ++i) {
        const cmd = commandList[i];
        $executeTable[cmd.opcode](cmd);
    }

    $gpu_expand();

    if ($is_web_worker) {
        // console.log('Transferring updateImageData back to CPU thread');

        // Transfer the underlying ArrayBuffer for the framebuffer to
        // avoid copy and allocation. When $gpu_shared_output is true
        // the main thread reads the frame from wasm memory instead
        // and this buffer only synchronizes the two threads.
        postMessage(
            {type: 'submitFrame', gpuTime: performance.now() - startTime, updateImageData: $updateImageData, updateImageData32: $updateImageData32},
            [$updateImageData32.buffer]);

        // Mark these as null since the ArrayBuffer has been transferred. This will
        // allow us to get an error if something is out of sync and the buffer has
        // not been transferred back before the next renderingpass.
        $updateImageData = null;
        $updateImageData32 = null;
    } else {
        $submitFrame($updateImageData, $updateImageData32);
    }
}


function $executeCIR(cmd) {
    let outline = cmd.outline, color = cmd.color;
    //    let  x = cmd.x - 0.5, y = cmd.y - 0.5, radius = cmd.radius + 0.5;
    let  x = cmd.x, y = cmd.y, radius = cmd.radius;

    const clipX1 = cmd.clipX1, clipY1 = cmd.clipY1,
          clipX2 = cmd.clipX2, clipY2 = cmd.clipY2;

    // The enclosing box, following the draw_corner_rect() logic, will be
    // Lines from $Math.floor(x - radius + 0.5) to $Math.floor(x + radius - 0.5).
    // Because of the rounding rules in $hline, this is equivalent to:
    //
    //   $hline($Math.floor(x - radius + 0.5), y, $Math.floor(x + radius - 0.5), outline, clipX1, clipY1, clipX2, clipY2)
    // or
    //   $hline(x - radius, y, x + radius - 1, outline, clipX1, clipY1, clipX2, clipY2)

    // Snap to the enclosing box
    const oldX = x, oldY = y;
    x = ($Math.round(oldX - radius) + $Math.round(oldX + radius - 1)) * 0.5
    y = ($Math.round(oldY - radius) + $Math.round(oldY + radius - 1)) * 0.5
    radius = $Math.max(($Math.round(oldX + radius - 1) - $Math.round(oldX - radius)) * 0.5,
                       ($Math.round(oldY + radius - 1) - $Math.round(oldY - radius)) * 0.5);

    // Special case small circles
    if (radius < 0.5) {
        // 1x1
        $pset(x, y, (outline & 0xf000) ? outline : color, clipX1, clipY1, clipX2, clipY2);
        return;
    } else if (radius <= 0.75) {
        // 2x2
        const fillColor = (outline & 0xf000) ? outline : color;
        $hline(x - 0.5, y - 0.5, x + 0.5, fillColor, clipX1, clipY1, clipX2, clipY2);
        $hline(x - 0.5, y + 0.5, x + 0.5, fillColor, clipX1, clipY1, clipX2, clipY2);
        return;
    } else if (radius <= 1.25) {
        // 3x3
        if (outline & 0xf000) {
            $pset(x, y - 1, outline, clipX1, clipY1, clipX2, clipY2);
            $pset(x - 1, y, outline, clipX1, clipY1, clipX2, clipY2);
            $pset(x + 1, y, outline, clipX1, clipY1, clipX2, clipY2);
            $pset(x, y + 1, outline, clipX1, clipY1, clipX2, clipY2);
            $pset(x, y, color, clipX1, clipY1, clipX2, clipY2);
        } else {
            $pset(x, y - 1, color, clipX1, clipY1, clipX2, clipY2);
            $hline(x - 1, y, x + 1, color, clipX1, clipY1, clipX2, clipY2);
            $pset(x, y + 1, color, clipX1, clipY1, clipX2, clipY2);
        }
        return;
    } else if (radius <= 1.75) {
        if (outline & 0xf000) {
            //   **
            //  *  *
            //  *  *
            //   **
            $hline(x - 0.5, y - 1.5, x + 0.5, outline, clipX1, clipY1, clipX2, clipY2);
            $pset(x - 1.5, y - 0.5, outline, clipX1, clipY1, clipX2, clipY2);
            $pset(x + 1.5, y - 0.5, outline, clipX1, clipY1, clipX2, clipY2);
            $pset(x - 1.5, y + 0.5, outline, clipX1, clipY1, clipX2, clipY2);
            $pset(x + 1.5, y + 0.5, outline, clipX1, clipY1, clipX2, clipY2);
            $hline(x - 0.5, y - 0.5, x + 0.5, color, clipX1, clipY1, clipX2, clipY2);
            $hline(x - 0.5, y + 0.5, x + 0.5, color, clipX1, clipY1, clipX2, clipY2);
            $hline(x - 0.5, y + 1.5, x + 0.5, outline, clipX1, clipY1, clipX2, clipY2);
        } else {
            $hline(x - 0.5, y - 1.5, x + 0.5, color, clipX1, clipY1, clipX2, clipY2);
            $hline(x - 1.5, y - 0.5, x + 1.5, color, clipX1, clipY1, clipX2, clipY2);
            $hline(x - 1.5, y + 0.5, x + 1.5, color, clipX1, clipY1, clipX2, clipY2);
            $hline(x - 0.5, y + 1.5, x + 0.5, color, clipX1, clipY1, clipX2, clipY2);
        }
        // 4x4
        return;
    } else if (radius <= 2.5) {
        radius -= 0.4;
    } else if (radius <= 3.5) {
        // Increase rounding of 6x6
        radius -= 0.25;
    }

    const j_unclipped_first = $Math.round(y - radius) | 0;
    const j_min = $Math.max(j_unclipped_first, clipY1 | 0) | 0;

    // The small epsilon keeps the y value from slightly overhanging by one pixel
    // due to roundoff when jittering
    const j_unclipped_last = $Math.round(y + radius - 0.00001) | 0;
    const j_max = $Math.min(j_unclipped_last, clipY2 | 0) | 0;

    // Intersect this scanline
    //
    // Line Y = j+0.5 intersects Circle (X - x)² + (Y - y)² = r²
    // Substitute:
    //    (x - X)² = r² - (j + 0.5 - y)²
    //    x = -X ± sqrt(r² - (j + 0.5 - y)²)
    //
    // The -0.49999 keeps the top and bottom row consistent with the
    // rest of the circle
    let next_spread = $Math.sqrt($Math.max(radius * radius - $square(Math.abs(j_min - y) - 0.49999), 0.5));
    let next_lo = $Math.round(x - next_spread) >>> 0;
    let next_hi = $Math.round(x + next_spread) >>> 0;
    let prev_lo = 0, prev_hi = 0;
    for (let j = j_min; j <= j_max; ++j) {
        // Inclusive x bounds
        const spread = next_spread;
        let lo = next_lo;
        let hi = next_hi;

        // We need to look one line ahead to connect the bottom half outlines
        next_spread = $Math.sqrt($Math.max(radius * radius - $square(Math.abs(j - y + 1) - 0.49999), 0.5));
        next_lo = $Math.round(x - next_spread) >>> 0;
        next_hi = $Math.round(x + next_spread) >>> 0;

        // Draw the outline first, moving lo and hi as needed to prevent overdraw
        if ((outline & 0xf000) && (outline !== color)) {
            if (j === j_unclipped_first || j === j_unclipped_last) {
                // Connect the first and last rows completely

                // Top
                $hline(lo, j, hi, outline, clipX1, clipY1, clipX2, clipY2);

                prev_lo = lo; prev_hi = hi;

                // There is no fill in this case because the outline dominates the row
                continue;
            } else if (lo < prev_lo - 1) {
                // On the top half of the circle and need a 2+ pixel horizontal outline.
                // The circle is symmetric, so we only need to check one horizontal side
                // to know that we're in this case.
                $hline(lo, j, prev_lo - 1, outline, clipX1, clipY1, clipX2, clipY2);
                $hline(prev_hi + 1, j, hi, outline, clipX1, clipY1, clipX2, clipY2);
                // Bring in the fill bounds so that they do not overdraw the outline
                // by swapping values.
                {const temp = prev_lo; prev_lo = lo, lo = temp;}
                {const temp = prev_hi; prev_hi = hi, hi = temp;}
            } else if (next_lo > lo + 1) {
                // On the bottom half of the circle and need a 2+ horizontal pixel outline.
                $hline(lo, j, next_lo - 1, outline, clipX1, clipY1, clipX2, clipY2);
                $hline(next_hi + 1, j, hi, outline, clipX1, clipY1, clipX2, clipY2);

                prev_lo = next_lo; prev_hi = next_hi;
                // Bring in the fill bounds so that they do not overdraw the outline
                lo = next_lo; hi = next_hi;
            } else {
                $pset(lo, j, outline, clipX1, clipY1, clipX2, clipY2);
                $pset(hi, j, outline, clipX1, clipY1, clipX2, clipY2);
                prev_lo = lo; prev_hi = hi;
                // Bring in the fill bounds so that they do not overdraw the outline
                ++lo; --hi;
            }
        }

        // Fill
        if (color & 0xf000) {
            $hline(lo, j, hi, color, clipX1, clipY1, clipX2, clipY2);
        }

    }
    return;

    /*
    ///////////////////////////////////////////////////////////////////
    // Old midpoint code. That classic algorithm only works when the bounding
    // box is odd. I.e., it always creates a diameter of 2 * floor(r) + 1,
    // so cannot inscribe bounds exactly for arbitrary circles within rectangles.

    if (color & 0xf000) {
        // offset
        let ox = radius - 1, oy = 0;

        // step
        let dx = 1, dy = 1;
        let err = dx - radius * 2;

        // Midpoint circle algorithm. Iterate over 1/8 of the circle,
        // reflect to all sides
        while (ox >= oy) {
            // Center
            if (ox !== oy) {
                // Bottom
                $hline(x - ox, y + oy, x + ox, color, clipX1, clipY1, clipX2, clipY2);

                // Top
                if (oy > 0) { $hline(x - ox, y - oy, x + ox, color, clipX1, clipY1, clipX2, clipY2); }
            }

            let old = oy;
            // -4 gives better shape for small circles
            if (err <= -4) {
                ++oy;
                err += dy;
                dy += 2;
            }

            // ...intentionally no "else" to allow diagonal changes in both x and y position...

            if (err > -4) {
                // Caps
                $hline(x - old, y + ox, x + old, color, clipX1, clipY1, clipX2, clipY2);
                $hline(x - old, y - ox, x + old, color, clipX1, clipY1, clipX2, clipY2);
                --ox;
                dx += 2;
                err += dx - radius * 2;
            }
        } // while
    } // if color


    if ((outline & 0xf000) && (outline !== color)) {
        // offset
        let ox = radius - 1, oy = 0;

        // step
        let dx = 1, dy = 1;
        let err = dx - radius * 2;

        while (ox >= oy) {
            if (ox !== oy) {
                // Bottom center
                $pset(x - ox, y + oy, outline, clipX1, clipY1, clipX2, clipY2);
                $pset(x + ox, y + oy, outline, clipX1, clipY1, clipX2, clipY2);

                if (oy > 0) {
                    // Top center
                    $pset(x - ox, y - oy, outline, clipX1, clipY1, clipX2, clipY2);
                    $pset(x + ox, y - oy, outline, clipX1, clipY1, clipX2, clipY2);
                }
            }

            // Bottom cap
            $pset(x - oy, y + ox, outline, clipX1, clipY1, clipX2, clipY2);

            // Top cap
            $pset(x - oy, y - ox, outline, clipX1, clipY1, clipX2, clipY2);

            if (oy > 0) {
                // Bottom cap
                $pset(x + oy, y + ox, outline, clipX1, clipY1, clipX2, clipY2);

                // Top cap
                $pset(x + oy, y - ox, outline, clipX1, clipY1, clipX2, clipY2);
            }

            if (err <= -4) {
                ++oy;
                err += dy;
                dy += 2;
            }

            if (err > -4) {
                --ox;
                dx += 2;
                err -= radius * 2 - dx;
            }
        } // while
    } // if outline
    */
}


function $executeREC(cmd) {
    const clipX1 = cmd.clipX1, clipY1 = cmd.clipY1,
          clipX2 = cmd.clipX2, clipY2 = cmd.clipY2;

    const data = cmd.data;

    for (let i = 0; i < data.length; ++i) {
        const rect = data[i];
        const outline = rect.outline, fill = rect.fill;
        let x1 = rect.x1, x2 = rect.x2, y1 = rect.y1, y2 = rect.y2;

        if ((outline !== fill) && (outline > 0xFFF)) {
            $hline(x1, y1, x2, outline, clipX1, clipY1, clipX2, clipY2);
            $hline(x1, y2, x2, outline, clipX1, clipY1, clipX2, clipY2);
            $vline(x1, y1 + 1, y2 - 1, outline, clipX1, clipY1, clipX2, clipY2);
            $vline(x2, y1 + 1, y2 - 1, outline, clipX1, clipY1, clipX2, clipY2);
            x1 += 1; y1 += 1; x2 -= 1; y2 -= 1;
        }

        if (fill & 0xf000) {

            // Snap to integer and set_clip to screen. We don't need to
            // round because we know that the rect is visible.
            x1 = $Math.max((x1 + 0.5) | 0, clipX1);
            x2 = $Math.min((x2 + 0.5) | 0, clipX2);
            y1 = $Math.max((y1 + 0.5) | 0, clipY1);
            y2 = $Math.min((y2 + 0.5) | 0, clipY2);

            // Blend spans
            for (let y = y1; y <= y2; ++y) {
                $hline(x1, y, x2, fill, clipX1, clipY1, clipX2, clipY2);
            }
        }
    }
}


function $executeLIN(cmd) {
    $line(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.color, cmd.clipX1, cmd.clipY1, cmd.clipX2, cmd.clipY2, cmd.open1, cmd.open2);
}


function $executeSPN(cmd) {
    $span(cmd);
}


function $executePIX(cmd) {
    console.assert(! cmd.data_length);
    $pixels(cmd.data);
}


function $executeSPR(metaCmd) {
    // Note that these are always integers, which we consider
    // pixel centers.
    const clipX1 = metaCmd.clipX1, clipY1 = metaCmd.clipY1,
          clipX2 = metaCmd.clipX2, clipY2 = metaCmd.clipY2;

    // For each sprite in the array
    const data = metaCmd.data;
    for (let i = 0; i < data.length; ++i) {
        const cmd = data[i];

        let opacity = cmd.opacity;
        const override_color = cmd.override_color;

        // Compute the net transformation matrix

        // Source bounds, inclusive
        const srcX1 = cmd.cornerX, srcX2 = cmd.cornerX + cmd.sizeX - 1,
              srcY1 = cmd.cornerY, srcY2 = cmd.cornerY + cmd.sizeY - 1;

        // The net forward transformation is: (note that SX, SY = source center, not scale!)
        // c = cos, s = sin, f = scale
        //
        // [srcx]   [1 0 SX][1/fx 0   0][ c -s 0][1 0 -DX][dstx]
        // [srcy] = [0 1 SY][0   1/fy 0][ s  c 0][0 1 -DY][dsty]
        // [ 1  ]   [0 0  1][0    0   1][ 0  0 1][0 0   1][ 1  ]
        //
        // [srcx]   [1 0 SX][c/fx -s/fx 0][1 0 -DX][dstx]
        // [srcy] = [0 1 SY][s/fy  c/fy 0][0 1 -DY][dsty]
        // [ 1  ]   [0 0  1][  0    0   1][0 0   1][ 1  ]
        //
        // A = c/fx, B = -s/fx, C = s/fy, D = c/fy
        //
        // [srcx]   [1 0 SX][A B 0][1 0 -DX][dstx]
        // [srcy] = [0 1 SY][C D 0][0 1 -DY][dsty]
        // [ 1  ]   [0 0  1][0 0 1][0 0   1][ 1  ]
        //
        // [srcx]    [A B (SX - A*DX - B*DY)][dstx]
        // [srcy] =  [C D (SY - C*DX - D*DY)][dsty]
        //                                   [ 1  ]
        //
        // The inverse transformation for computing destination bounds is:
        //
        // [dstx]   [1 0 DX][ c s 0][fx  0 0][1 0 -SX][srcx]
        // [dsty] = [0 1 DY][-s c 0][ 0 fy 0][0 1 -SY][srcy]
        // [ 1  ]   [0 0  1][ 0 0 1][ 0  0 1][0 0   1][ 1  ]
        //
        // E = c*fx, F = -s*fx, G = s*fy, H = c*fy
        //
        // [dstx]   [E F DX][srcx - SX]
        // [dsty] = [G H DY][srcy - SY]
        //                  [   1     ]

        // Source and destination centers
        const DX = cmd.x, DY = cmd.y,
              SX = srcX1 + cmd.sizeX * 0.5, SY = srcY1 + cmd.sizeY * 0.5;

        // Snap nearly 0 or 1 values to perfect to avoid
        // falling into awkward roundoff cases
        const angle = ($Math.abs(cmd.angle) < 1e-8) ? 0 : cmd.angle;
        const cos = $Math.cos(angle), sin = $Math.sin(angle);
        const fx = $Math.abs(cmd.scaleX - 1) < 1e-8 ? 1 : cmd.scaleX,
              fy = $Math.abs(cmd.scaleY - 1) < 1e-8 ? 1 : cmd.scaleY;

        const A = cos/fx, B = -sin/fx, C =  sin/fy, D = cos/fy;
        const E = cos*fx, F =  sin*fx, G = -sin*fy, H = cos*fy;
        const I = DX - SX*E - SY*G, J = DY - SX*F - SY*H;

        ////////////////////////////////////////////////////////////////////////////////
        // Compute the (inclusive) destination bounds by projecting all
        // four corners from texture space to screen space

        let dstX1 = Infinity, dstX2 = -Infinity,
            dstY1 = Infinity, dstY2 = -Infinity;

        for (let i = 0; i <= 1; ++i) {
            for (let j = 0; j <= 1; ++j) {
                // Coordinates of the bounding box extremes
                const srcX = srcX1 + i * cmd.sizeX,
                      srcY = srcY1 + j * cmd.sizeY;

                // Transform from texture space to pixel space
                let tmp = E * (srcX - SX) + G * (srcY - SY) + DX;
                dstX1 = $Math.min(tmp, dstX1); dstX2 = $Math.max(tmp, dstX2);

                tmp     = F * (srcX - SX) + H * (srcY - SY) + DY;
                dstY1 = $Math.min(tmp, dstY1); dstY2 = $Math.max(tmp, dstY2);
            }
        }

        // Round the bounding box using the draw_rect rules for inclusive integer
        // bounds with open top and left edges at pixel center samples.
        dstX1 = $Math.round(dstX1); dstY1 = $Math.round(dstY1);
        dstX2 = $Math.floor(dstX2 - 0.5); dstY2 = $Math.floor(dstY2 - 0.5);

        // Pixel centers are sampled exactly at +0.5. The open near
        // edge and closed far edge above require a texel to own its
        // far boundary along an axis that is not flipped, so the
        // texel index is ceil(s) - 1 there, and to own its near
        // boundary along a flipped axis, where it is floor(s). Both
        // are computed as floor(k * s) * k + o. The simple branch
        // below reads flipped x data, so its x index always takes
        // the ceil rule.
        const kX = (A >= 0) ? -1 : 1, oX = (A >= 0) ? -1 : 0;
        const kY = (D >= 0) ? -1 : 1, oY = (D >= 0) ? -1 : 0;

        // Restrict to the clipping region
        dstX1 = $Math.max(dstX1, clipX1); dstY1 = $Math.max(dstY1, clipY1);
        dstX2 = $Math.min(dstX2, clipX2); dstY2 = $Math.min(dstY2, clipY2);

        // Iterate over *output* pixel centers in this region. Because the
        // transformed texel centers won't usually land exactly on pixel
        // centers, we have to be conservative with the bounds here.
        //
        // Don't snap the bounds to integers...we want to hit points that
        // correspond to texel centers in the case where there is no
        // rotation or scale (we'll end up rounding the actual destination
        // pixels later and stepping in integer increments anyway).

        if (cmd.spritesheetIndex >= $spritesheetArray.length) {
            $console.log('GPU spritesheetIndex out of bounds at:', cmd);
        }
        $console.assert(cmd.spritesheetIndex !== undefined &&
                        cmd.spritesheetIndex >= 0 &&
                        cmd.spritesheetIndex < $spritesheetArray.length,
                        'spritesheetIndex out of bounds:', cmd.spritesheetIndex);
        const srcData = $spritesheetArray[cmd.spritesheetIndex].$uint16Data;
        console.assert(srcData.width !== undefined);

        const srcDataWidth = srcData.width >>> 0;

        if (($Math.abs($Math.abs(A) - 1) < 1e-10) && ($Math.abs(B) < 1e-10) &&
            ($Math.abs(C) < 1e-10) && ($Math.abs($Math.abs(D) - 1) < 1e-10) &&
            (! override_color)) {

            // Simple case; x and y-axis uniform scale, no rotation, and no alpha
            // test. Use a memcpy.  The x and y-axes may be inverted, and there
            // can be xy translation applied. This branch is primarily
            // here to accelerate map rendering.

            const width = (dstX2 - dstX1 + 1) | 0;
            if (width >= 1) {
                const srcY = ($Math.floor(kY * ((dstY1 + 0.5 - DY) * $Math.sign(D) + SY)) * kY + oY) | 0;
                let srcOffset = ((-$Math.floor(-((dstX1 + 0.5 - DX) + SX)) - 1) + srcY * srcDataWidth) | 0;
                const dstOffset = (dstX1 + dstY1 * $SCREEN_WIDTH) | 0;
                const srcStep = (srcDataWidth * $Math.sign(D)) | 0;

                const flipped = A < 0;
                if (flipped) {
                    // Use the flipped version
                    srcOffset = (srcOffset + srcDataWidth - 2 * SX) | 0;
                }

                $sprite_blit(cmd.spritesheetIndex, flipped, srcOffset, srcStep, dstOffset, width, dstY2 - dstY1 + 1, cmd.hasAlpha, opacity);
            } // width >= 1
        } else {
            $sprite_affine(cmd.spritesheetIndex, srcX1, srcY1, srcX2, srcY2, dstX1, dstY1, dstX2, dstY2,
                           A, B, C, D, DX, DY, SX, SY, kX, kY,
                           cmd.hasAlpha, opacity, override_color, cmd.multiply);
        }
    } // for each sprite
}


function $executeTXT(cmd) {
    const height = cmd.height, width = cmd.width, color = cmd.color,
          str = cmd.str
    let   outline = cmd.outline, shadow = cmd.shadow;
    const clipX1 = cmd.clipX1, clipY1 = cmd.clipY1,
          clipX2 = cmd.clipX2, clipY2 = cmd.clipY2;
    const font = $fontArray[cmd.fontIndex];

    let x = cmd.x, y = cmd.y;

    if ((font.spacing.x === 0) && (outline & 0xF000) && (color & 0xF000)) {
        // Script font with outline and color. Draw in two passes so that
        // the connectors are not broken by outlines.

        // Disable color and re-issue the command to draw shadow and outline
        // before drawing the main text.
        cmd.color = 0;
        $executeTXT(cmd);
        cmd.color = color;

        // Pass through, disabling outline and shadow that were
        // already processed.
        outline = shadow = 0;
    }

    for (let c = 0; c < str.length; ++c) {
        // Remap the character to those in the font sheet
        const chr = str[c];
        const bounds = font.$bounds[chr];

        x += bounds.pre;
        if (chr !== ' ') {
            const tileY = $Math.floor(bounds.y1 / font.$charHeight) * font.$charHeight;
            const charWidth  = bounds.x2 - bounds.x1 + 1;
            const charHeight = bounds.y2 - bounds.y1 + 1;

            // Shift the destination down by the offset of this character relative to the tile
            $glyph(cmd.fontIndex, bounds.x1, bounds.y1, charWidth, charHeight, x, y + bounds.y1 - tileY + bounds.yOffset,
                   color, outline, shadow, clipX1, clipY1, clipX2, clipY2);
        } // character in font

        x += (bounds.x2 - bounds.x1 + 1) + $postGlyphSpace(chr + (str[c] || ''), font) - font.$borderSize * 2 + bounds.post;

    } // for each character
}


// Convex polygon rendering
function $executePLY(cmd) {
    const clipX1 = cmd.clipX1, clipY1 = cmd.clipY1,
          clipX2 = cmd.clipX2, clipY2 = cmd.clipY2;
    const points = cmd.points;
    const numPoints = points.length >> 1;
    const color = cmd.color, outline = cmd.outline;

    // Fill
    if (color & 0xf000) {
        const shift = ((outline & 0xf000) && (outline !== color)) ? 0.5 : 0;
        // For each non-horizontal edge, store:
        //
        //    [startX, startY, dx/dy slope, vertical height].
        //
        // These are the values needed for the edge-intersection test.  Add edges so that the
        // start Y coordinate is less than the end one.
        const edgeArray = [];

        // vertical bounds on the triangle
        let y0 = clipY2 + 1, y1 = clipY1 - 1;

        function addEdge(Sx, Sy, Ex, Ey) {
            if (Sy < Ey) {
                // Update bounding box
                if (Sy < y0) { y0 = Sy; }
                if (Ey > y1) { y1 = Ey; }
                edgeArray.push([Sx, Sy, (Ex - Sx) / (Ey - Sy), Ey - Sy]);
            } else if (Sy > Ey) {
                addEdge(Ex, Ey, Sx, Sy);
            }
        }

        // Add all edges
        for (let p = 0; p < points.length - 3; p += 2) {
            addEdge(points[p], points[p + 1], points[p + 2], points[p + 3]);
        }
        {
            // Wraparound to close the polygon
            const p = points.length - 2;
            addEdge(points[p], points[p + 1], points[0], points[1]);
        }

        // Intentionally left as a float to avoid int->float
        // conversion within the inner loop
        y0 = $Math.max(clipY1, $Math.floor(y0));
        y1 = $Math.min(clipY2, $Math.floor(y1));
        for (let y = y0; y <= y1; ++y) {

            // For this scanline, intersect the edge lines of the triangle.
            // As a convex polygon, we can simply intersect ALL edges and then
            // take the min and max intersections.
            let x0 = Infinity, x1 = -Infinity;
            for (let i = edgeArray.length - 1; i >= 0; --i) {
                const edge = edgeArray[i];
                const edgeX = edge[0], edgeY = edge[1], slope = edge[2], edgeHeight = edge[3];

                // Find the intersection
                const dy = y - edgeY;
                if ((dy >= 0) && (dy <= edgeHeight)) {
                    const x = edgeX + dy * slope;
                    x0 = $Math.min(x0, x);
                    x1 = $Math.max(x, x1);
                }
            }

            // If there was a nonzero line length, draw it
            if (x0 + shift <= x1 - shift) {
                $hline(x0 + shift, y, x1 - shift, color, clipX1, clipY1, clipX2, clipY2);
            }
        }
    }

    if ((outline & 0xf000) && (outline !== color)) {
        for (let p = 0; p < points.length - 3; p += 2) {
            $line(points[p], points[p + 1], points[p + 2], points[p + 3], outline, clipX1, clipY1, clipX2, clipY2, false, true);
        }
        {
            // Wraparound to close the polygon
            const p = points.length - 2;
            $line(points[p], points[p + 1], points[0], points[1], outline, clipX1, clipY1, clipX2, clipY2, false, true);
        }
    }
}


var $executeTable = Object.freeze({
    REC : $executeREC,
    CIR : $executeCIR,
    SPR : $executeSPR,
    PIX : $executePIX,
    TXT : $executeTXT,
    LIN : $executeLIN,
    PLY : $executePLY,
    SPN : $executeSPN
});

//
// Command structure for each opcode, as used by $execute* functions:
//
// REC (Rectangle batch):
//   - opcode: 'REC'
//   - clipX1, clipY1, clipX2, clipY2
//   - data: Array of { x1, y1, x2, y2, outline, fill }
//
// CIR (Circle):
//   - opcode: 'CIR'
//   - x, y, radius
//   - color, outline
//   - clipX1, clipY1, clipX2, clipY2
//
// LIN (Line):
//   - opcode: 'LIN'
//   - x1, y1, x2, y2
//   - color
//   - open1, open2
//   - clipX1, clipY1, clipX2, clipY2
//
// SPN (Span of map texels, one run per map cell; see draw_map_span()):
//   - opcode: 'SPN'
//   - data: Uint16Array of runs
//   - data_length: number
//   - dx, dy, x, y
//   - map_x0, map_y0, step_x, step_y: map coordinate of pixel 0 and per-pixel step
//   - sprite_size_x, sprite_size_y
//   - override_mode (0 none, 1 lerp, 2 multiply), override_r, override_g, override_b, override_a
//   - low_res: even pixels repeat the previous drawn pixel
//
// PIX (Pixel batch):
//   - opcode: 'PIX'
//   - data: Array or TypedArray (pairs: [offset, color])
//
// SPR (Sprite batch):
//   - opcode: 'SPR'
//   - clipX1, clipY1, clipX2, clipY2
//   - data: Array of sprite commands, each with:
//       - x, y
//       - cornerX, cornerY, sizeX, sizeY
//       - angle, scaleX, scaleY
//       - spritesheetIndex
//       - opacity, override_color, multiply, hasAlpha
//
// TXT (Text):
//   - opcode: 'TXT'
//   - x, y
//   - width, height
//   - color, outline, shadow
//   - str (string)
//   - fontIndex
//   - clipX1, clipY1, clipX2, clipY2
//
// PLY (Polygon):
//   - opcode: 'PLY'
//   - points: Array of [x0, y0, x1, y1, ...]
//   - color, outline
//   - clipX1, clipY1, clipX2, clipY2
//
// All commands have a 'z' field for sorting, but it is not used in rendering.
//
