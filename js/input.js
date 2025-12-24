document.addEventListener('DOMContentLoaded', () => {
    const processBtn = document.getElementById('process-btn');
    const textArea = document.getElementById('clinical-text');

    if (!processBtn || !textArea) {
        console.error('Required elements not found');
        return;
    }

    processBtn.addEventListener('click', () => {
        const text = textArea.value;

        if (!text.trim()) {
            alert('Por favor, introduzca un texto clínico para procesar.');
            return;
        }

        console.log('Saving text to localStorage:', text.substring(0, 50) + '...');

        // Guardar en localStorage para GitHub Pages
        localStorage.setItem('clinicalText', text);

        // Navegar a la página de revisión
        console.log('Navigating to review.html');
        window.location.href = 'review.html';
    });
});
