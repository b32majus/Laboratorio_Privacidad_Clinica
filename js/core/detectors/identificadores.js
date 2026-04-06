// Detector de Identificadores - DNI, NIE, NUSS, teléfonos, emails, direcciones

/**
 * Detecta todos los identificadores en un texto
 * @param {string} text - Texto a analizar
 * @returns {Array} - Array de entidades detectadas
 */
export function detectIdentificadores(text) {
    const entities = [];
    let match;
    const seen = new Set();

    const addEntity = (entity) => {
        if (!entity || !entity.position) return;
        const key = `${entity.type}:${entity.subtype}:${entity.position.start}:${entity.position.end}`;
        if (seen.has(key)) return;
        seen.add(key);
        entities.push(entity);
    };

    // DNI: 8 dígitos + letra
    const dniRegex = /\b\d{8}[A-Za-z]\b/g;
    while ((match = dniRegex.exec(text)) !== null) {
        addEntity({
            type: 'IDENTIFICADOR',
            subtype: 'dni',
            text: match[0],
            original: match[0],
            position: { start: match.index, end: match.index + match[0].length },
            confidence: 0.99
        });
    }

    // NIE: X/Y/Z + 7 dígitos + letra
    const nieRegex = /\b[XYZxyz]\d{7}[A-Za-z]\b/g;
    while ((match = nieRegex.exec(text)) !== null) {
        addEntity({
            type: 'IDENTIFICADOR',
            subtype: 'nie',
            text: match[0],
            original: match[0],
            position: { start: match.index, end: match.index + match[0].length },
            confidence: 0.99
        });
    }

    // NUSS: 12 dígitos
    const nussRegex = /\b\d{12}\b/g;
    while ((match = nussRegex.exec(text)) !== null) {
        addEntity({
            type: 'IDENTIFICADOR',
            subtype: 'nuss',
            text: match[0],
            original: match[0],
            position: { start: match.index, end: match.index + match[0].length },
            confidence: 0.85
        });
    }

    // NUSS con formato: XX/XXXXXXXX/XX
    const nussFormatRegex = /\b\d{2}\/\d{8}\/\d{2}\b/g;
    while ((match = nussFormatRegex.exec(text)) !== null) {
        addEntity({
            type: 'IDENTIFICADOR',
            subtype: 'nuss',
            text: match[0],
            original: match[0],
            position: { start: match.index, end: match.index + match[0].length },
            confidence: 0.95
        });
    }

    // NUSS con espacios: "12 12345678 90"
    const nussSpacedRegex = /\b\d{2}\s+\d{8}\s+\d{2}\b/g;
    while ((match = nussSpacedRegex.exec(text)) !== null) {
        addEntity({
            type: 'IDENTIFICADOR',
            subtype: 'nuss',
            text: match[0],
            original: match[0],
            position: { start: match.index, end: match.index + match[0].length },
            confidence: 0.90
        });
    }

    // DNI después de etiqueta
    const docLabelRegex = /(?:Documento|DNI|NIF)\s*:\s*([^\n\r]+?)(?=\s*$|\s*\n|\r)/gmi;
    while ((match = docLabelRegex.exec(text)) !== null) {
        const doc = match[1].trim();
        if (doc.length > 0) {
            const startPos = match.index + match[0].indexOf(doc);
            addEntity({
                type: 'IDENTIFICADOR',
                subtype: 'dni',
                text: doc,
                original: doc,
                position: { start: startPos, end: startPos + doc.length },
                confidence: 0.95
            });
        }
    }

    // NHC (Historia Clínica)
    const nhcRegex = /\b(?:NHC|Historia|H\.?C\.?)\s*:?\s*(\d+)/gi;
    while ((match = nhcRegex.exec(text)) !== null) {
        addEntity({
            type: 'IDENTIFICADOR',
            subtype: 'nhc',
            text: match[0],
            original: match[0],
            position: { start: match.index, end: match.index + match[0].length },
            confidence: 0.95
        });
    }

    // NHC con separadores: "2024/089756", "2023-456789", etc.
    const nhcFormatRegex = /\b(?:NHC|N[º°]?\s*Historia|H\.?C\.?)\s*:?\s*([A-Z0-9]{2,}[\/\-][A-Z0-9]{3,}|\d{4}[\/\-]\d{5,8})\b/gi;
    while ((match = nhcFormatRegex.exec(text)) !== null) {
        const code = match[1];
        const startPos = match.index + match[0].lastIndexOf(code);
        addEntity({
            type: 'IDENTIFICADOR',
            subtype: 'nhc',
            text: code,
            original: code,
            position: { start: startPos, end: startPos + code.length },
            confidence: 0.96
        });
    }

    // Códigos NHC sin etiqueta explícita
    const nhcLooseRegex = /\b\d{4}[\/\-]\d{5,8}\b/g;
    while ((match = nhcLooseRegex.exec(text)) !== null) {
        addEntity({
            type: 'IDENTIFICADOR',
            subtype: 'nhc',
            text: match[0],
            original: match[0],
            position: { start: match.index, end: match.index + match[0].length },
            confidence: 0.90
        });
    }

    // Tarjeta sanitaria: CIP/SIP/TIS/TSI con etiqueta
    const tarjetaSanitariaRegex = /\b(?:CIP|SIP|TIS|TSI|Tarjeta\s+Sanitaria|N[úu]mero\s+de\s+Tarjeta\s+Sanitaria)\s*:?\s*([A-Z]{0,4}\d{6,16}[A-Z0-9]{0,4})\b/gi;
    while ((match = tarjetaSanitariaRegex.exec(text)) !== null) {
        const codigo = match[1].trim();
        const startPos = match.index + match[0].lastIndexOf(codigo);
        addEntity({
            type: 'IDENTIFICADOR',
            subtype: 'tarjeta_sanitaria',
            text: codigo,
            original: codigo,
            position: { start: startPos, end: startPos + codigo.length },
            confidence: 0.93
        });
    }

    // Teléfonos españoles
    const telefonoRegex = /\b(?:\+34\s?)?[679]\d{2}[\s\.\-]?\d{3}[\s\.\-]?\d{3}\b/g;
    while ((match = telefonoRegex.exec(text)) !== null) {
        addEntity({
            type: 'IDENTIFICADOR',
            subtype: 'telefono',
            text: match[0],
            original: match[0],
            position: { start: match.index, end: match.index + match[0].length },
            confidence: 0.95
        });
    }

    // Teléfonos con etiqueta
    const telLabelRegex = /(?:Tel[eé]fono|Tfno|M[oó]vil|Tel)\s*:?\s*([\d\s\.\-\+]+)/gi;
    while ((match = telLabelRegex.exec(text)) !== null) {
        const tel = match[1].trim();
        if (tel.length >= 9) {
            const startPos = match.index + match[0].indexOf(tel);
            addEntity({
                type: 'IDENTIFICADOR',
                subtype: 'telefono',
                text: tel,
                original: tel,
                position: { start: startPos, end: startPos + tel.length },
                confidence: 0.90
            });
        }
    }

    // Emails
    const emailRegex = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
    while ((match = emailRegex.exec(text)) !== null) {
        addEntity({
            type: 'IDENTIFICADOR',
            subtype: 'email',
            text: match[0],
            original: match[0],
            position: { start: match.index, end: match.index + match[0].length },
            confidence: 0.99
        });
    }

    // Emails con etiqueta
    const emailLabelRegex = /(?:Email|Correo|E-mail)\s*:?\s*([^\s,\n\r]+@[^\s,\n\r]+)/gi;
    while ((match = emailLabelRegex.exec(text)) !== null) {
        const email = match[1].trim();
        const startPos = match.index + match[0].indexOf(email);
        addEntity({
            type: 'IDENTIFICADOR',
            subtype: 'email',
            text: email,
            original: email,
            position: { start: startPos, end: startPos + email.length },
            confidence: 0.95
        });
    }

    // Direcciones
    const direccionRegex = /\b(?:Calle|C\/|Avda\.?|Avenida|Plaza|Pza\.?|Paseo|Camino)\s+[^\n\r\.]{3,120}/gi;
    while ((match = direccionRegex.exec(text)) !== null) {
        addEntity({
            type: 'UBICACION',
            subtype: 'direccion',
            text: match[0],
            original: match[0],
            position: { start: match.index, end: match.index + match[0].length },
            confidence: 0.97
        });
    }

    // Direcciones con etiqueta
    const dirLabelRegex = /(?:Direcci[oó]n|Domicilio)\s*:\s*([^\n\r\.]{5,140})/gmi;
    while ((match = dirLabelRegex.exec(text)) !== null) {
        const dir = match[1].trim();
        if (dir.length > 5) {
            const startPos = match.index + match[0].indexOf(dir);
            addEntity({
                type: 'UBICACION',
                subtype: 'direccion',
                text: dir,
                original: dir,
                position: { start: startPos, end: startPos + dir.length },
                confidence: 0.98
            });
        }
    }

    // Códigos Postales
    const cpRegex = /\b(?:C\.?P\.?\s*:?\s*)?(\d{5})\b/g;
    while ((match = cpRegex.exec(text)) !== null) {
        const cp = match[1] || match[0];
        const cpNum = parseInt(cp.replace(/\D/g, ''));
        if (cpNum >= 1000 && cpNum <= 52999) {
            addEntity({
                type: 'IDENTIFICADOR',
                subtype: 'codigo_postal',
                text: match[0],
                original: match[0],
                position: { start: match.index, end: match.index + match[0].length },
                confidence: 0.80
            });
        }
    }

    // Códigos administrativos/visados (VD2024-SEV-00234, REF-2024-12345, etc.)
    const codigoAdminRegex = /\b[A-Z]{2,4}[0-9]{2,4}[\-_][A-Z]{2,4}[\-_][0-9]{4,6}\b/g;
    while ((match = codigoAdminRegex.exec(text)) !== null) {
        addEntity({
            type: 'IDENTIFICADOR',
            subtype: 'codigo_admin',
            text: match[0],
            original: match[0],
            position: { start: match.index, end: match.index + match[0].length },
            confidence: 0.90
        });
    }

    // Códigos con etiqueta (Código visado:, Referencia:, etc.)
    const codigoLabelRegex = /(?:C[oó]digo\s*(?:visado|expediente|referencia)?|Visado|Referencia|Ref\.?|Expediente)\s*:\s*([A-Z0-9][\w\-\/]+)/gi;
    while ((match = codigoLabelRegex.exec(text)) !== null) {
        const codigo = match[1].trim();
        if (codigo.length >= 5) {
            const startPos = match.index + match[0].indexOf(codigo);
            addEntity({
                type: 'IDENTIFICADOR',
                subtype: 'codigo_admin',
                text: codigo,
                original: codigo,
                position: { start: startPos, end: startPos + codigo.length },
                confidence: 0.92
            });
        }
    }

    // Número de colegiado: "Colegiado: 28/123456"
    const colegiadoRegex = /\b(?:Colegiado|Col\.?|N[º°]?\s*Coleg\.?)\s*:?\s*(\d{2}\/\d{5,6}|\d{6,8})/gi;
    while ((match = colegiadoRegex.exec(text)) !== null) {
        addEntity({
            type: 'IDENTIFICADOR',
            subtype: 'colegiado',
            text: match[0],
            original: match[0],
            position: { start: match.index, end: match.index + match[0].length },
            confidence: 0.95
        });
    }

    return entities;
}

export default { detectIdentificadores };
