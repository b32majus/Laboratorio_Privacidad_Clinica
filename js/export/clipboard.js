/**
 * Copia el texto procesado al portapapeles
 * @param {string} text - Texto a copiar
 * @returns {Promise<boolean>} - true si tuvo éxito
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Error al copiar al portapapeles:', err);
        // Fallback para navegadores antiguos
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        } catch (fallbackErr) {
            console.error('Fallback también falló:', fallbackErr);
            return false;
        }
    }
}

/**
 * Muestra feedback visual al usuario
 * @param {HTMLElement} button - Botón que activó la acción
 * @param {boolean} success - Si la operación fue exitosa
 */
export function showCopyFeedback(button, success) {
    const originalText = button.innerHTML;

    if (success) {
        button.innerHTML = '<span class="material-symbols-outlined">check</span> Copiado';
        button.classList.add('bg-emerald-600');
        button.classList.remove('bg-primary');
    } else {
        button.innerHTML = '<span class="material-symbols-outlined">error</span> Error';
        button.classList.add('bg-red-600');
        button.classList.remove('bg-primary');
    }

    setTimeout(() => {
        button.innerHTML = originalText;
        button.classList.remove('bg-emerald-600', 'bg-red-600');
        button.classList.add('bg-primary');
    }, 2000);
}
