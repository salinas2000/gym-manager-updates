// Transcodifica vídeos de ejercicio a MP4 web-optimizado (720p, H.264,
// +faststart) usando el ffmpeg empaquetado (ffmpeg-static). Así los vídeos que
// suba el dueño nacen ligeros y compatibles (Android incluido) en vez de
// entrar como .mov/HEVC de 60 MB.
//
// Es best-effort: si ffmpeg no está disponible o falla, devuelve success:false
// y el llamante sube el original como fallback (mejor un vídeo pesado que nada).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Resuelve la ruta al binario ffmpeg empaquetado. En producción el binario
 * vive dentro de app.asar, que no es ejecutable — electron-builder lo
 * "desempaqueta" a app.asar.unpacked (ver asarUnpack en package.json), así que
 * reescribimos la ruta.
 */
function getFfmpegPath() {
    try {
        let p = require('ffmpeg-static');
        if (!p) return null;
        p = p.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep)
             .replace('app.asar/', 'app.asar.unpacked/');
        return fs.existsSync(p) ? p : null;
    } catch (_) {
        return null;
    }
}

/**
 * Transcodifica inputPath a un MP4 temporal optimizado para web.
 * @returns {Promise<{success:true, outPath:string} | {success:false, error:string}>}
 * Nunca lanza excepción.
 */
function transcodeToMp4(inputPath) {
    return new Promise((resolve) => {
        const ffmpeg = getFfmpegPath();
        if (!ffmpeg) return resolve({ success: false, error: 'ffmpeg_no_disponible' });

        const outPath = path.join(os.tmpdir(), `gmp_video_${Date.now()}.mp4`);
        const args = [
            '-y', '-i', inputPath,
            '-c:v', 'libx264', '-crf', '20', '-preset', 'fast', '-pix_fmt', 'yuv420p',
            // Tope 1280px por el lado mayor → 720p vertical u horizontal (nítido en móvil).
            '-vf', "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
            '-c:a', 'aac', '-b:a', '128k',
            '-movflags', '+faststart',
            outPath,
        ];

        let stderr = '';
        let proc;
        try {
            proc = spawn(ffmpeg, args, { windowsHide: true });
        } catch (e) {
            return resolve({ success: false, error: `spawn_error: ${e.message}` });
        }
        proc.stderr.on('data', (d) => { stderr += d.toString(); if (stderr.length > 4000) stderr = stderr.slice(-4000); });
        proc.on('error', (e) => resolve({ success: false, error: `ffmpeg_error: ${e.message}` }));
        proc.on('close', (code) => {
            try {
                if (code === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
                    resolve({ success: true, outPath });
                } else {
                    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (_) { /* ignore */ }
                    resolve({ success: false, error: `ffmpeg_exit_${code}: ${stderr.slice(-200)}` });
                }
            } catch (e) {
                resolve({ success: false, error: `post_error: ${e.message}` });
            }
        });
    });
}

module.exports = { transcodeToMp4, getFfmpegPath };
