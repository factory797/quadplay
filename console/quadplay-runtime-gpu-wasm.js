/* Copyright 2026 Shmuel Ravensky, 2019-2025 Morgan McGuire. LGPL 3.0 License */
'use strict';

// WebAssembly implementation of the virtual GPU rasterization
// primitives from quadplay-runtime-gpu.c. The framebuffer,
// textures, and per-command scratch live in wasm memory. This file
// owns that layout and rebuilds it from scratch on every resize or
// texture change, which is rare and avoids fragmentation.

// When the worker is cross-origin isolated the memory is shared and
// the main thread copies the output directly from it, so there is no
// per-frame transfer. Only a worker benefits: on the main thread the
// output must be copied into the ImageData anyway.
var $gpu_shared_output = false;

var $gpu_wasm;
var $gpu_memory;

// Offsets into $gpu_memory
var $gpu_framebuffer_offset = 0;
var $gpu_output_offset = 0, $gpu_output_bytes = 0;
var $gpu_scratch_offset = 0, $gpu_scratch_bytes = 0;

// Bound to wasm exports by $gpu_load()
var $gpu_clear, $gpu_clear_spritesheet, $pset, $hline, $vline, $line, $sprite_blit, $sprite_affine, $glyph;

// Memory is created here instead of exported by the module so that
// the shared flag can be chosen at run time. 256 pages = 16 MB
// initial, 4096 pages = 256 MB maximum, matching --max-memory in
// _dev/makeGPU.
function $gpu_load() {
    $gpu_shared_output = $is_web_worker && self.crossOriginIsolated;
    $gpu_memory = new WebAssembly.Memory({initial: 256, maximum: 4096, shared: $gpu_shared_output});
    const url = 'quadplay-runtime-gpu' + ($gpu_shared_output ? '-shared' : '') + '.wasm?refresh=' + new Date().getTime();

    return fetch(url).then(function (response) {
        return response.arrayBuffer();
    }).then(function (bytes) {
        return WebAssembly.instantiate(bytes, {env: {memory: $gpu_memory}});
    }).then(function (result) {
        $gpu_wasm = result.instance.exports;
        $gpu_clear             = $gpu_wasm.clear;
        $gpu_clear_spritesheet = $gpu_wasm.clear_spritesheet;
        $pset                  = $gpu_wasm.pset;
        $hline                 = $gpu_wasm.hline;
        $vline                 = $gpu_wasm.vline;
        $line                  = $gpu_wasm.line;
        $sprite_blit           = $gpu_wasm.sprite_blit;
        $sprite_affine         = $gpu_wasm.sprite_affine;
        $glyph                 = $gpu_wasm.glyph;
    });
}


function $gpu_alloc(bytes) {
    const offset = $gpu_wasm.gpu_alloc(bytes);
    if (offset === 0) {
        throw new Error('Virtual GPU memory exhausted allocating ' + bytes + ' bytes');
    }
    return offset;
}


// Growing unshared memory replaces $gpu_memory.buffer, so views are
// taken after all allocation
function $gpu_upload(typedArray) {
    const offset = $gpu_alloc(typedArray.byteLength);
    new Uint8Array($gpu_memory.buffer, offset, typedArray.byteLength).set(new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength));
    return offset;
}


function $gpu_views() {
    $screen = new Uint16Array($gpu_memory.buffer, $gpu_framebuffer_offset, $SCREEN_WIDTH * $SCREEN_HEIGHT);
}


function $gpu_layout() {
    const wasm = $gpu_wasm;
    wasm.gpu_reset();

    const w = $SCREEN_WIDTH, h = $SCREEN_HEIGHT;
    $gpu_framebuffer_offset = $gpu_alloc(w * h * 2);
    $gpu_output_bytes = w * h * 4;
    $gpu_output_offset = $gpu_alloc($gpu_output_bytes);
    wasm.gpu_set_framebuffer($gpu_framebuffer_offset, w, h);
    wasm.gpu_set_output($gpu_output_offset);

    // Textures are not yet loaded during the first resize
    if ($spritesheetArray) {
        for (let i = 0; i < $spritesheetArray.length; ++i) {
            const sheet = $spritesheetArray[i];
            const offset = $gpu_upload(sheet.$uint16Data);
            const flippedOffset = $gpu_upload(sheet.$uint16DataFlippedX);
            wasm.gpu_set_spritesheet(i, offset, flippedOffset, sheet.$uint16Data.width, sheet.$uint16Data.height);
        }
        for (let i = 0; i < $fontArray.length; ++i) {
            const font = $fontArray[i];
            wasm.gpu_set_font(i, $gpu_upload(font.$data.data), font.$data.width);
        }
    }

    $gpu_scratch_bytes = 0;
    $gpu_scratch(65536);

    if ($gpu_shared_output) {
        postMessage({type: 'output', memory: $gpu_memory, offset: $gpu_output_offset, bytes: $gpu_output_bytes});
    }
}


// Returns the scratch offset, growing scratch to at least bytes
function $gpu_scratch(bytes) {
    if (bytes > $gpu_scratch_bytes) {
        $gpu_scratch_bytes = (bytes + 65535) & ~65535;
        $gpu_scratch_offset = $gpu_alloc($gpu_scratch_bytes);
        $gpu_wasm.gpu_set_scratch($gpu_scratch_offset);
        $gpu_views();
    }
    return $gpu_scratch_offset;
}


function $gpu_set_texture(spritesheetArray, fontArray) {
    $spritesheetArray   = spritesheetArray;
    $fontArray          = fontArray;
    $gpu_layout();
}


function $gpu_resize_framebuffer(w, h) {
    $SCREEN_WIDTH = w;
    $SCREEN_HEIGHT = h;
    $gpu_layout();
}


function $pixels(data) {
    const offset = $gpu_scratch(data.length * 4);
    new Uint32Array($gpu_memory.buffer, offset, data.length).set(data);
    $gpu_wasm.pixels(data.length);
}


function $span(cmd) {
    const N = cmd.data_length;
    const offset = $gpu_scratch(N * 2);
    new Uint16Array($gpu_memory.buffer, offset, N).set(cmd.data.subarray(0, N));
    $gpu_wasm.span(N, cmd.x, cmd.y, cmd.map_x0, cmd.map_y0, cmd.step_x, cmd.step_y,
                   cmd.sprite_size_x, cmd.sprite_size_y, cmd.low_res,
                   cmd.override_mode, cmd.override_r, cmd.override_g, cmd.override_b, cmd.override_a);
}


function $gpu_expand() {
    $gpu_wasm.expand();
    if (! $gpu_shared_output) {
        $updateImageData32.set(new Uint32Array($gpu_memory.buffer, $gpu_output_offset, $gpu_output_bytes >> 2));
    }
}
