/**
 * Guardia de empaquetado: ningun secreto de PUBLICACION puede viajar dentro
 * del instalador.
 *
 * El porque: `.env.local` se copia al instalador como extraResources (la app
 * lo lee en cada gimnasio para sus credenciales de Supabase). Todo lo que
 * escribas en ese fichero acaba en el PC de cada cliente, en texto plano,
 * dentro de `resources\.env.local`. Ahi solo deben estar las credenciales que
 * la APP necesita para funcionar.
 *
 * El token de GitHub no es una de ellas: solo sirve para SUBIR la release
 * desde este equipo. Va en la terminal, en el momento de publicar, y nunca en
 * un fichero. En PowerShell:
 *
 *   $env:GH_TOKEN = "ghp_..."      # solo en esta ventana
 *   npm run ship                   # sube versión, construye y publica
 *
 * Si la versión ya está subida y solo falta publicar, sin volver a subirla:
 *
 *   $env:GH_TOKEN = "ghp_..."
 *   npx dotenv -e .env.local -- electron-builder --publish always
 *
 * Este script corre en `beforePack`, antes de que se copie nada, y aborta el
 * empaquetado si detecta un token. Nunca imprime el valor encontrado.
 *
 * Si algun dia hace falta saltarselo a conciencia:
 *   ALLOW_SECRETS_IN_BUNDLE=1 npm run build
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');

// Claves que son SOLO de build/publicacion. Si aparecen con valor en un
// fichero que se empaqueta, se aborta.
const CLAVES_PROHIBIDAS = ['GH_TOKEN', 'GITHUB_TOKEN'];

// Formatos de token de GitHub, por si el secreto entra con otro nombre o
// escondido en un comentario.
const FORMATOS_TOKEN = [
    /\bghp_[A-Za-z0-9]{20,}/,          // personal access token (classic)
    /\bgithub_pat_[A-Za-z0-9_]{20,}/,  // fine-grained
    /\bgh[osur]_[A-Za-z0-9]{20,}/,     // oauth / server / user / refresh
];

/** Ficheros sueltos que el instalador copia tal cual (extraResources). */
function ficherosEmpaquetados() {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    const extra = (pkg.build && pkg.build.extraResources) || [];
    return extra
        .map(e => (typeof e === 'string' ? e : e.from))
        .filter(Boolean)
        .map(rel => path.resolve(REPO, rel))
        .filter(p => fs.existsSync(p) && fs.statSync(p).isFile());
}

/** Motivos por los que este fichero no puede empaquetarse. Sin valores. */
function motivos(fichero) {
    const contenido = fs.readFileSync(fichero, 'utf8');
    const encontrados = [];

    for (const clave of CLAVES_PROHIBIDAS) {
        // Con valor no vacio. `GH_TOKEN=` a secas es inofensivo.
        const asignada = new RegExp(`^\\s*(?:export\\s+)?${clave}\\s*=\\s*\\S`, 'm');
        if (asignada.test(contenido)) encontrados.push(`${clave} tiene valor`);
    }
    for (const formato of FORMATOS_TOKEN) {
        if (formato.test(contenido)) {
            encontrados.push('hay algo con forma de token de GitHub (incluidos los comentarios)');
            break;
        }
    }
    return encontrados;
}

module.exports = async function checkNoSecrets() {
    if (process.env.ALLOW_SECRETS_IN_BUNDLE === '1') {
        console.warn('[build] ⚠️  Guardia de secretos DESACTIVADA (ALLOW_SECRETS_IN_BUNDLE=1).');
        return;
    }

    const problemas = [];
    for (const fichero of ficherosEmpaquetados()) {
        const encontrados = motivos(fichero);
        if (encontrados.length > 0) {
            problemas.push(`  • ${path.relative(REPO, fichero)}: ${encontrados.join('; ')}`);
        }
    }

    if (problemas.length > 0) {
        throw new Error(
            '\n\n❌ EMPAQUETADO ABORTADO — hay un secreto de publicación en un fichero que se copia al instalador.\n\n' +
            problemas.join('\n') +
            '\n\nEse fichero acaba en el PC de cada gimnasio, en texto plano, dentro de resources\\.\n' +
            'El token de GitHub solo sirve para subir la release desde este equipo: bórralo del\n' +
            'fichero y pásalo por la terminal en el momento de publicar.\n\n' +
            '  $env:GH_TOKEN = "ghp_..."     (PowerShell, solo en esa ventana)\n' +
            '  npm run ship\n\n' +
            'Si el token ya salió en un instalador anterior, revócalo en GitHub y crea otro.\n'
        );
    }

    console.log('[build] ✅ Sin secretos de publicación en los ficheros empaquetados.');
};
