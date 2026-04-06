// Diccionario ampliado de ubicaciones españolas
// Fuentes: INE, Wikipedia - Municipios de España
// Total: ~500 ciudades y pueblos + hospitales conocidos

export const CIUDADES = [
    // Capitales de provincia (52)
    'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Las Palmas', 'Bilbao',
    'Alicante', 'Córdoba', 'Valladolid', 'Vigo', 'Gijón', 'Vitoria', 'A Coruña', 'Granada', 'Elche', 'Oviedo',
    'Santa Cruz de Tenerife', 'Pamplona', 'Almería', 'San Sebastián', 'Donostia', 'Burgos', 'Albacete', 'Santander',
    'Castellón', 'Logroño', 'Badajoz', 'Salamanca', 'Huelva', 'Lleida', 'Tarragona', 'León', 'Cádiz', 'Jaén',
    'Ourense', 'Girona', 'Lugo', 'Cáceres', 'Guadalajara', 'Toledo', 'Pontevedra', 'Palencia', 'Ciudad Real',
    'Zamora', 'Ávila', 'Cuenca', 'Huesca', 'Segovia', 'Soria', 'Teruel', 'Ceuta', 'Melilla',

    // Ciudades > 100.000 habitantes
    'Hospitalet de Llobregat', "L'Hospitalet", 'Móstoles', 'Fuenlabrada', 'Leganés', 'Getafe', 'Alcalá de Henares',
    'Terrassa', 'Badalona', 'Sabadell', 'Jerez de la Frontera', 'Cartagena', 'Talavera de la Reina', 'Marbella',
    'Alcorcón', 'Torrejón de Ardoz', 'Parla', 'Algeciras', 'Mataró', 'Dos Hermanas', 'Santa Coloma de Gramenet',
    'Alcobendas', 'Reus', 'Telde', 'Barakaldo', 'San Fernando', 'Torrevieja', 'Coslada', 'Arona',
    'San Cristóbal de La Laguna', 'Chiclana de la Frontera', 'Manresa', 'Rubí', 'El Puerto de Santa María',
    'Pozuelo de Alarcón', 'San Sebastián de los Reyes', 'Cornellà de Llobregat', 'Majadahonda', 'Roquetas de Mar',

    // Ciudades 50.000-100.000 habitantes
    'El Ejido', 'Torrent', 'Paterna', 'Sagunto', 'Gandía', 'Benidorm', 'Orihuela', 'Elda', 'Alcoy', 'Villena',
    'San Vicente del Raspeig', 'Dénia', 'Petrer', 'Novelda', 'Ibi', 'Xàtiva', 'Alzira', 'Sueca', 'Cullera', 'Ontinyent',
    'Lorca', 'Molina de Segura', 'Alcantarilla', 'Cieza', 'Totana', 'Mazarrón', 'Caravaca de la Cruz', 'Yecla', 'Jumilla',
    'Puerto Lumbreras', 'Torre-Pacheco', 'San Javier', 'Los Alcázares', 'La Unión', 'Águilas', 'Archena', 'Cehegín',
    'Écija', 'Utrera', 'Alcalá de Guadaíra', 'Mairena del Aljarafe', 'Tomares', 'Coria del Río', 'San Juan de Aznalfarache',
    'La Rinconada', 'Bormujos', 'Carmona', 'Osuna', 'Lebrija', 'Arahal', 'Marchena', 'Las Cabezas de San Juan',
    'Morón de la Frontera', 'La Algaba', 'Sanlúcar la Mayor', 'Olivares', 'Pilas', 'Brenes', 'Cantillana',
    'Antequera', 'Vélez-Málaga', 'Ronda', 'Estepona', 'Benalmádena', 'Fuengirola', 'Mijas', 'Torremolinos', 'Nerja',
    'Alhaurín de la Torre', 'Alhaurín el Grande', 'Coín', 'Cártama', 'Pizarra', 'Álora', 'Campillos', 'Archidona',
    'Motril', 'Almuñécar', 'Loja', 'Baza', 'Guadix', 'Huéscar', 'Armilla', 'Maracena', 'Albolote', 'Atarfe',
    'Las Gabias', 'Peligros', 'Santa Fe', 'Ogíjares', 'Churriana de la Vega', 'Cúllar Vega', 'La Zubia', 'Monachil',

    // Ciudades 20.000-50.000 habitantes (selección)
    'Pozoblanco', 'Lucena', 'Puente Genil', 'Montilla', 'Priego de Córdoba', 'Cabra', 'Baena', 'Palma del Río',
    'Linares', 'Andújar', 'Úbeda', 'Baeza', 'Martos', 'Alcalá la Real', 'Bailén', 'Jódar', 'Torredonjimeno',
    'La Carolina', 'Villanueva del Arzobispo', 'Villacarrillo', 'Mancha Real', 'Torre del Campo', 'Porcuna',
    'El Puerto de Santa María', 'Sanlúcar de Barrameda', 'Chiclana', 'Rota', 'Puerto Real', 'La Línea de la Concepción',
    'San Roque', 'Los Barrios', 'Tarifa', 'Conil de la Frontera', 'Vejer de la Frontera', 'Barbate', 'Medina Sidonia',
    'Arcos de la Frontera', 'Villamartín', 'Ubrique', 'Olvera', 'Setenil de las Bodegas', 'Grazalema', 'Zahara de la Sierra',

    // País Vasco
    'Barakaldo', 'Getxo', 'Portugalete', 'Santurtzi', 'Basauri', 'Leioa', 'Erandio', 'Galdakao', 'Durango', 'Ermua',
    'Eibar', 'Zarautz', 'Irún', 'Hondarribia', 'Errenteria', 'Pasaia', 'Lasarte-Oria', 'Hernani', 'Tolosa', 'Azpeitia',
    'Azkoitia', 'Beasain', 'Mondragón', 'Arrasate', 'Bergara', 'Oñati', 'Gasteiz',

    // Cataluña
    'Granollers', 'Mollet del Vallès', 'Cerdanyola del Vallès', 'Sant Cugat del Vallès', 'Viladecans', 'El Prat de Llobregat',
    'Sant Boi de Llobregat', 'Esplugues de Llobregat', 'Sant Joan Despí', 'Sant Feliu de Llobregat', 'Gavà', 'Castelldefels',
    'Sitges', 'Vilanova i la Geltrú', 'El Vendrell', 'Calafell', 'Cambrils', 'Salou', 'Valls', 'Tortosa', 'Amposta',
    'Figueres', 'Blanes', 'Lloret de Mar', 'Olot', 'Banyoles', 'Palafrugell', 'Sant Feliu de Guíxols', 'Palamós',
    'Vic', 'Manlleu', 'Berga', 'Igualada', 'Vilafranca del Penedès', 'Sant Sadurní d\'Anoia', 'Martorell', 'Abrera',
    'Esparreguera', 'Olesa de Montserrat', 'Sant Andreu de la Barca',

    // Galicia
    'Ferrol', 'Santiago de Compostela', 'Narón', 'Oleiros', 'Arteixo', 'Carballo', 'Culleredo', 'Cambre', 'Betanzos',
    'Ribeira', 'Boiro', 'Vilagarcía de Arousa', 'Marín', 'Redondela', 'Cangas', 'Moaña', 'Nigrán', 'Gondomar',
    'Lalín', 'Monforte de Lemos', 'Sarria', 'Viveiro', 'Foz', 'Burela', 'Vilalba',

    // Aragón
    'Calatayud', 'Ejea de los Caballeros', 'Utebo', 'Cuarte de Huerva', 'Caspe', 'Tarazona', 'Barbastro', 'Monzón',
    'Fraga', 'Binéfar', 'Jaca', 'Sabiñánigo', 'Alcañiz', 'Andorra', 'Calamocha', 'Teruel',

    // Castilla y León
    'Ponferrada', 'San Andrés del Rabanedo', 'Villaquilambre', 'Aranda de Duero', 'Miranda de Ebro', 'Medina del Campo',
    'Laguna de Duero', 'Béjar', 'Ciudad Rodrigo', 'Segovia', 'El Espinar', 'Soria', 'Almazán',

    // Castilla-La Mancha
    'Puertollano', 'Tomelloso', 'Alcázar de San Juan', 'Valdepeñas', 'Manzanares', 'Daimiel', 'Miguelturra', 'Almansa',
    'Hellín', 'Villarrobledo', 'La Roda', 'Illescas', 'Seseña', 'Tarancón', 'Azuqueca de Henares', 'Alovera', 'Sigüenza',

    // Extremadura
    'Mérida', 'Don Benito', 'Villanueva de la Serena', 'Almendralejo', 'Zafra', 'Plasencia', 'Coria', 'Navalmoral de la Mata',

    // Navarra
    'Tudela', 'Barañáin', 'Burlada', 'Estella', 'Tafalla', 'Zizur Mayor', 'Ansoáin', 'Berriozar',

    // La Rioja
    'Calahorra', 'Arnedo', 'Haro', 'Alfaro', 'Nájera', 'Santo Domingo de la Calzada',

    // Cantabria
    'Torrelavega', 'Castro-Urdiales', 'Camargo', 'Piélagos', 'El Astillero', 'Santoña', 'Laredo', 'Reinosa', 'Los Corrales de Buelna',

    // Asturias
    'Avilés', 'Siero', 'Langreo', 'Mieres', 'San Martín del Rey Aurelio', 'Laviana', 'Aller', 'Lena', 'Cangas del Narcea',
    'Villaviciosa', 'Navia', 'Pravia', 'Tineo',

    // Islas Baleares
    'Calvià', 'Manacor', 'Marratxí', 'Llucmajor', 'Inca', 'Alcúdia', 'Pollença', 'Sóller', 'Felanitx', 'Santanyí',
    'Ibiza', 'Sant Antoni de Portmany', 'Santa Eulària des Riu', 'Sant Josep de sa Talaia', 'Mahón', 'Ciutadella',

    // Islas Canarias
    'Arrecife', 'Puerto del Rosario', 'San Bartolomé', 'Teguise', 'Yaiza', 'La Oliva', 'Antigua', 'Pájara', 'Tuineje',
    'Santa Lucía de Tirajana', 'San Bartolomé de Tirajana', 'Arucas', 'Agüimes', 'Ingenio', 'Mogán', 'La Laguna',
    'Santa Cruz', 'Arona', 'Adeje', 'Granadilla de Abona', 'Los Realejos', 'La Orotava', 'Puerto de la Cruz', 'Icod de los Vinos',
    'Güímar', 'Candelaria', 'Tacoronte', 'El Rosario', 'Tegueste', 'Los Llanos de Aridane', 'El Paso', 'Breña Alta',
    'San Sebastián de la Gomera', 'Valverde', 'Frontera',

    // Pueblos y municipios menores frecuentes en documentos clínicos
    'Aracena', 'Almonte', 'Ayamonte', 'Bollullos Par del Condado', 'Moguer', 'Palos de la Frontera', 'Punta Umbría',
    'Rociana del Condado', 'Valverde del Camino', 'Minas de Riotinto', 'Nerva', 'Zalamea la Real', 'Aljaraque',
    'Cartaya', 'Isla Cristina', 'Lepe', 'San Juan del Puerto', 'Trigueros', 'Villablanca', 'Gibraleón'
];

// Provincias españolas (incluye variantes habituales de escritura)
export const PROVINCIAS = [
    'Álava', 'Alava', 'Albacete', 'Alicante', 'Almería', 'Almeria', 'Asturias', 'Ávila', 'Avila',
    'Badajoz', 'Barcelona', 'Burgos', 'Cáceres', 'Caceres', 'Cádiz', 'Cadiz', 'Cantabria', 'Castellón',
    'Castellon', 'Ciudad Real', 'Córdoba', 'Cordoba', 'A Coruña', 'Coruña', 'Cuenca', 'Girona', 'Granada',
    'Guadalajara', 'Guipúzcoa', 'Guipuzcoa', 'Gipuzkoa', 'Huelva', 'Huesca', 'Illes Balears', 'Islas Baleares',
    'Jaén', 'Jaen', 'León', 'Leon', 'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Malaga', 'Murcia', 'Navarra',
    'Ourense', 'Orense', 'Palencia', 'Las Palmas', 'Pontevedra', 'La Rioja', 'Salamanca', 'Santa Cruz de Tenerife',
    'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid', 'Vizcaya',
    'Bizkaia', 'Zamora', 'Zaragoza', 'Ceuta', 'Melilla'
];

// Comunidades y ciudades autónomas (para generalización geográfica)
export const CCAA = [
    'Andalucía', 'Andalucia',
    'Aragón', 'Aragon',
    'Principado de Asturias', 'Asturias',
    'Illes Balears', 'Islas Baleares',
    'Canarias',
    'Cantabria',
    'Castilla-La Mancha',
    'Castilla y León', 'Castilla y Leon',
    'Cataluña', 'Cataluna',
    'Comunitat Valenciana', 'Comunidad Valenciana',
    'Extremadura',
    'Galicia',
    'Comunidad de Madrid', 'Madrid',
    'Región de Murcia', 'Region de Murcia',
    'Comunidad Foral de Navarra', 'Navarra',
    'País Vasco', 'Pais Vasco', 'Euskadi',
    'La Rioja',
    'Ceuta',
    'Melilla'
];

// Nombres de hospitales conocidos (para mejorar detección)
export const HOSPITALES = [
    // Hospitales de Andalucía
    'Virgen del Rocío', 'Virgen Macarena', 'Virgen de Valme', 'Virgen de las Nieves', 'San Cecilio',
    'Carlos Haya', 'Regional de Málaga', 'Clínico de Málaga', 'Costa del Sol', 'Reina Sofía',
    'Puerta del Mar', 'Puerto Real', 'Jerez', 'Juan Ramón Jiménez', 'Infanta Elena', 'Torrecárdenas',
    'Poniente', 'La Inmaculada', 'Jaén', 'Alto Guadalquivir', 'San Juan de la Cruz', 'San Agustín',

    // Hospitales de Madrid
    'La Paz', 'Gregorio Marañón', '12 de Octubre', 'Doce de Octubre', 'Ramón y Cajal', 'Clínico San Carlos',
    'Puerta de Hierro', 'Fundación Jiménez Díaz', 'La Princesa', 'Niño Jesús', 'Infantil Niño Jesús',
    'Infanta Leonor', 'Infanta Sofía', 'Infanta Cristina', 'Severo Ochoa', 'Príncipe de Asturias',
    'Getafe', 'Fuenlabrada', 'Móstoles', 'Alcorcón', 'Rey Juan Carlos', 'El Escorial', 'Henares',

    // Hospitales de Cataluña
    'Clínic', 'Sant Pau', 'Vall d\'Hebron', 'Bellvitge', 'Germans Trias i Pujol', 'Can Ruti', 'Mar',
    'Del Mar', 'Parc Taulí', 'Mútua Terrassa', 'General de Catalunya', 'Sagrat Cor', 'Sant Joan de Déu',
    'Arnau de Vilanova', 'Joan XXIII', 'Verge de la Cinta', 'Trueta', 'Santa Caterina',

    // Hospitales de Valencia
    'La Fe', 'Clínico Universitario', 'Doctor Peset', 'General de Valencia', 'Arnau de Vilanova',
    'La Ribera', 'Lluís Alcanyís', 'Francesc de Borja', 'General de Alicante', 'San Juan', 'Vinalopó',
    'Marina Baixa', 'Vega Baja', 'General de Elche', 'General de Castellón', 'La Plana',

    // Hospitales del País Vasco
    'Cruces', 'Basurto', 'Galdakao', 'San Eloy', 'Donostia', 'Bidasoa', 'Mendaro', 'Zumárraga',
    'Txagorritxu', 'Santiago Apóstol', 'Álava',

    // Hospitales de Galicia
    'Clínico Universitario de Santiago', 'A Coruña', 'Juan Canalejo', 'Arquitecto Marcide', 'Naval',
    'Meixoeiro', 'Xeral de Vigo', 'Álvaro Cunqueiro', 'Montecelo', 'Provincial de Pontevedra', 'Lucus Augusti',
    'Xeral de Lugo',

    // Hospitales de otras comunidades
    'Miguel Servet', 'Clínico de Zaragoza', 'Royo Villanova', 'Lozano Blesa', 'Obispo Polanco',
    'Virgen de la Salud', 'Nuestra Señora del Prado', 'General de Ciudad Real', 'Mancha Centro',
    'Santa Bárbara', 'General de Albacete', 'Perpetuo Socorro', 'General de Segovia', 'Río Hortega',
    'Clínico de Valladolid', 'Universitario de Burgos', 'Complejo Hospitalario de León', 'Bierzo',
    'Virgen de la Vega', 'Clínico de Salamanca', 'Nuestra Señora de Sonsoles', 'General de Soria',
    'General de Palencia', 'Río Carrión', 'Virgen de la Concha', 'Virgen del Puerto',
    'San Pedro de Alcántara', 'Infanta Cristina de Badajoz', 'Perpetuo Socorro de Badajoz',
    'Marqués de Valdecilla', 'Sierrallana', 'Comarcal de Laredo', 'Universitario Central de Asturias',
    'HUCA', 'San Agustín de Avilés', 'Valle del Nalón', 'Carmen y Severo Ochoa', 'Álvarez-Buylla',
    'Jove', 'Cabueñes', 'Son Espases', 'Son Llàtzer', 'Can Misses', 'Mateu Orfila', 'Manacor',
    'Dr. Negrín', 'Insular', 'Materno Infantil', 'Universitario de Canarias', 'La Candelaria',
    'Nuestra Señora de la Candelaria', 'General de la Palma', 'Molina Orosa',

    // Hospitales privados frecuentes
    'Quirón', 'Quirónsalud', 'Vithas', 'HM', 'Ruber', 'Sanitas', 'Nisa', 'Viamed', 'Hospiten',
    'USP', 'Xanit', 'San Rafael', 'Santa Elena', 'Asepeyo', 'Fremap', 'Ibermutuamur', 'Mutua Universal',
    'MAZ', 'Fraternidad', 'MC Mutual', 'Solimat', 'Umivale', 'Activa Mutua', 'Mutua Balear'
];

// Centros de salud y ambulatorios genéricos
export const CENTROS_SALUD_PREFIJOS = [
    'Centro de Salud', 'Consultorio', 'Ambulatorio', 'Centro de Especialidades',
    'Centro Médico', 'Clínica', 'Policlínica', 'Centro de Atención Primaria', 'CAP',
    'Unidad de Salud Mental', 'USM', 'Hospital de Día', 'Centro de Diagnóstico'
];

// Barrios y distritos frecuentes (pueden aparecer en direcciones)
export const BARRIOS = [
    // Madrid
    'Salamanca', 'Chamberí', 'Argüelles', 'Moncloa', 'Tetuán', 'Chamartín', 'Hortaleza', 'Barajas',
    'Vallecas', 'Puente de Vallecas', 'Villa de Vallecas', 'Villaverde', 'Usera', 'Carabanchel',
    'Latina', 'Arganzuela', 'Centro', 'Retiro', 'Moratalaz', 'Ciudad Lineal', 'San Blas',
    'Vicálvaro', 'Fuencarral', 'El Pardo',

    // Barcelona
    'Gràcia', 'Sants', 'Les Corts', 'Sarrià', 'Sant Gervasi', 'Horta', 'Guinardó', 'Nou Barris',
    'Sant Andreu', 'Sant Martí', 'Ciutat Vella', 'Eixample', 'Poblenou', 'Barceloneta',

    // Sevilla
    'Triana', 'Macarena', 'Nervión', 'Los Remedios', 'Cerro-Amate', 'Este-Alcosa-Torreblanca',
    'Sur', 'Bellavista-La Palmera', 'San Pablo-Santa Justa',

    // Valencia
    'Russafa', 'Benimaclet', 'Patraix', 'Campanar', 'La Saïdia', 'Benicalap', 'Poblats Marítims',
    'Quatre Carreres', 'El Pla del Real', 'Extramurs', 'Ciutat Vella', 'L\'Eixample'
];
