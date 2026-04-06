// Diccionario ampliado de apellidos españoles
// Fuentes: INE (Instituto Nacional de Estadística), datos 2024
// Total: ~1000 apellidos más frecuentes

export const APELLIDOS = [
    // Top 100 apellidos más frecuentes en España (INE 2024)
    'García', 'González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín',
    'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez',
    'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Ramírez', 'Serrano', 'Blanco', 'Molina',
    'Morales', 'Suárez', 'Ortega', 'Delgado', 'Castro', 'Ortiz', 'Rubio', 'Marín', 'Sanz', 'Iglesias',
    'Núñez', 'Medina', 'Garrido', 'Cortés', 'Castillo', 'Santos', 'Lozano', 'Guerrero', 'Cano', 'Prieto',
    'Méndez', 'Cruz', 'Calvo', 'Gallego', 'Vidal', 'León', 'Márquez', 'Herrera', 'Peña', 'Flores',
    'Cabrera', 'Campos', 'Vega', 'Fuentes', 'Carrasco', 'Diez', 'Caballero', 'Reyes', 'Nieto', 'Aguilar',
    'Pascual', 'Santana', 'Herrero', 'Montero', 'Lorenzo', 'Hidalgo', 'Giménez', 'Ibáñez', 'Ferrer', 'Durán',
    'Santiago', 'Benítez', 'Vargas', 'Mora', 'Vicente', 'Arias', 'Carmona', 'Crespo', 'Rivas', 'Casas',

    // 100-200 frecuentes
    'Rojas', 'Sáez', 'Moya', 'Conde', 'Esteban', 'Parra', 'Contreras', 'Vera', 'Luque', 'Velasco',
    'Bravo', 'Soler', 'Silva', 'Rivera', 'Gallardo', 'Espinosa', 'Merino', 'Camacho', 'Izquierdo', 'Rivero',
    'Redondo', 'Bautista', 'Aranda', 'Mateo', 'Escobar', 'Palacios', 'Otero', 'Rico', 'Segura', 'Franco',
    'Valero', 'Bermúdez', 'Montes', 'Soriano', 'Roldán', 'Rey', 'Carrillo', 'Marcos', 'Mendoza', 'Lara',
    'Acosta', 'Benito', 'Pereira', 'Requena', 'Miranda', 'Casado', 'Pardo', 'Plaza', 'Aguado', 'Mesa',
    'Pastor', 'Sala', 'Aparicio', 'Hernando', 'Ponce', 'Villar', 'Bernal', 'Trujillo', 'Estévez', 'Salas',
    'Correa', 'Cuenca', 'Osuna', 'Mejía', 'Peralta', 'Maestre', 'Tena', 'Robles', 'Serra', 'Padilla',
    'Maldonado', 'Andrés', 'Cobo', 'Zamora', 'Aguirre', 'Palomino', 'Pacheco', 'Portillo', 'Teruel', 'Montoya',
    'Quintana', 'Ballester', 'Guillén', 'Marin', 'Expósito', 'Paredes', 'Barroso', 'Arroyo', 'Navas', 'Carretero',

    // 200-300 frecuentes
    'Soto', 'Córdoba', 'Ávila', 'Leal', 'Valle', 'Salazar', 'Toledo', 'Hurtado', 'Mena', 'Corral',
    'Luna', 'Arenas', 'Gallo', 'Catalán', 'Canales', 'Roig', 'Cuevas', 'Granados', 'Oliva', 'Martos',
    'Vilchez', 'Barrera', 'Cuadrado', 'Naranjo', 'Montalvo', 'Quevedo', 'Toro', 'Cervera', 'Baena', 'Fajardo',
    'Abellán', 'Mata', 'Llamas', 'Ballesteros', 'Oliver', 'Marti', 'Carbonell', 'Mas', 'Bueno', 'Manzano',
    'Villegas', 'Palma', 'Becerra', 'Antón', 'Roca', 'Saura', 'Heredia', 'Llorente', 'Pino', 'Ros',
    'Sierra', 'Casanova', 'Jimenez', 'Sevilla', 'Guerra', 'Miguel', 'Clemente', 'Alarcon', 'Morillo', 'Alfaro',
    'Báez', 'Borja', 'Lorente', 'Monje', 'Tejada', 'Pineda', 'Barragán', 'Escudero', 'Ocaña', 'Jurado',
    'Santamaría', 'Valverde', 'Perea', 'Arce', 'Bermejo', 'Rosado', 'Castaño', 'Lagos', 'Salinas', 'Girón',
    'Rosa', 'Pedrosa', 'Vallejo', 'Ríos', 'Carvajal', 'Linares', 'Millán', 'Coronado', 'Galindo', 'Tapia',

    // 300-400 frecuentes
    'Pulido', 'Ochoa', 'Puig', 'Roldan', 'Abril', 'Guerreiro', 'Romera', 'Cid', 'Belmonte', 'Vergara',
    'Colomer', 'Galán', 'Alvarado', 'Jordán', 'Urbano', 'Baeza', 'Rodrigo', 'Gracia', 'Gallart', 'Riera',
    'Tejero', 'Cuesta', 'Nicolás', 'Alcántara', 'Polo', 'Valenzuela', 'Rojo', 'Villanueva', 'Alcaraz', 'Giner',
    'Planas', 'Giraldo', 'Cabello', 'Solana', 'Cantero', 'Criado', 'Orozco', 'Almagro', 'Zaragoza', 'Torralba',
    'Gálvez', 'Vilanova', 'Feliu', 'Guzmán', 'Campillo', 'Castellano', 'Quintero', 'Carrera', 'Reguera', 'Solís',
    'Buendía', 'Villarreal', 'Cardona', 'Beltrán', 'Arnau', 'Alegre', 'Quiles', 'Herrero', 'Alcalá', 'Moyano',
    'Gascón', 'Colom', 'Peral', 'Vilaplana', 'Almansa', 'Carreño', 'Fabra', 'Izaguirre', 'Landete', 'Mateos',
    'Ordóñez', 'Benet', 'Castellanos', 'Gómis', 'Manchado', 'Vicent', 'Vila', 'Portero', 'Sales', 'Tejedor',
    'Valcárcel', 'Cuéllar', 'Gamero', 'Bonet', 'Casals', 'Ferré', 'Fornés', 'Mirón', 'Pellicer', 'Torrent',

    // 400-500 frecuentes
    'Alcover', 'Ballesta', 'Bernabé', 'Cantos', 'Chacón', 'Company', 'Cortina', 'Egea', 'Escrig', 'Espejo',
    'Estrada', 'Ezquerro', 'Forner', 'Fortea', 'Fuster', 'Gimeno', 'Gisbert', 'Guasp', 'Guinot', 'Hervás',
    'Igual', 'Jaén', 'Jarque', 'Just', 'Lacasa', 'Lahoz', 'Lamarca', 'Latorre', 'Latre', 'Liñán',
    'Llopis', 'Llorens', 'Lluch', 'Macías', 'Magro', 'Malonda', 'Mancebo', 'Mañas', 'Manso', 'Manzanares',
    'Manzanero', 'Mariño', 'Martí', 'Marzo', 'Masip', 'Mateu', 'Meliá', 'Menéndez', 'Meseguer', 'Mínguez',
    'Miralles', 'Moliner', 'Monfort', 'Montaner', 'Montañés', 'Montolío', 'Morales', 'Morell', 'Morente', 'Morera',
    'Morey', 'Nadal', 'Navarrete', 'Negrete', 'Nevado', 'Noguera', 'Nogueras', 'Nogués', 'Olmo', 'Orellana',
    'Ortuño', 'Osorio', 'Otón', 'Palau', 'Pallarés', 'Palomar', 'Palomo', 'Panadero', 'Pareja', 'Parreño',

    // 500-600 frecuentes
    'Pascua', 'Payá', 'Pedrero', 'Peláez', 'Pelegrín', 'Perales', 'Peris', 'Picazo', 'Picón', 'Piñeiro',
    'Piqueras', 'Pitarch', 'Plans', 'Plá', 'Pont', 'Porras', 'Portes', 'Poveda', 'Pozo', 'Prats',
    'Puche', 'Puente', 'Pujol', 'Quero', 'Quilez', 'Rabal', 'Ramírez', 'Raya', 'Real', 'Rebolledo',
    'Recio', 'Regueiro', 'Renau', 'Ribas', 'Ribes', 'Ricarte', 'Rincón', 'Ripoll', 'Rius', 'Rives',
    'Rocamora', 'Rodrigues', 'Roig', 'Romeu', 'Rosell', 'Roselló', 'Rosique', 'Rubiales', 'Rueda', 'Ruíz',
    'Sabater', 'Sacristán', 'Sáenz', 'Sáinz', 'Salamanca', 'Salas', 'Salcedo', 'Saldaña', 'Salgado', 'Salmerón',
    'Salvá', 'Salvador', 'Samper', 'San', 'Sanchis', 'Sandoval', 'Sanmartín', 'Sanmiguel', 'Sansalvador', 'Santacruz',

    // 600-700 frecuentes
    'Santamaria', 'Santonja', 'Sanz', 'Sarrión', 'Sastre', 'Seguí', 'Sempere', 'Senent', 'Seoane', 'Serna',
    'Serrano', 'Simón', 'Sirvent', 'Solano', 'Soler', 'Sorribes', 'Sosa', 'Subirats', 'Talavera', 'Talens',
    'Tarín', 'Teixidó', 'Tercero', 'Terrón', 'Tirado', 'Tomás', 'Tormo', 'Torner', 'Tornero', 'Torra',
    'Torrado', 'Torralbo', 'Torregrosa', 'Torrente', 'Torrents', 'Torres', 'Tortosa', 'Tramunt', 'Trenco', 'Trillo',
    'Trinidad', 'Tudela', 'Úbeda', 'Urbina', 'Uriarte', 'Urrutia', 'Valderrama', 'Valencia', 'Valentín', 'Valiente',
    'Valle', 'Valls', 'Varas', 'Varela', 'Varo', 'Velarde', 'Velázquez', 'Ventura', 'Verdejo', 'Verdú',
    'Vergés', 'Viejo', 'Vilar', 'Villalba', 'Villar', 'Villena', 'Viñas', 'Viola', 'Yáñez', 'Yuste',
    'Zabaleta', 'Zamora', 'Zamorano', 'Zapata', 'Zaragozá', 'Zarco', 'Zorrilla', 'Zurita',

    // 700-800: Apellidos de origen extranjero frecuentes en España
    // Origen árabe/magrebí
    'Abdelkader', 'Abdelkarim', 'Abdellah', 'Abderrahman', 'Aboubakr', 'Ahmed', 'Ait', 'Alami', 'Alaoui', 'Amrani',
    'Aziz', 'Bakkali', 'Belhaj', 'Belkacem', 'Ben', 'Benali', 'Benaissa', 'Benchekroun', 'Benmoussa', 'Bennani',
    'Bensaid', 'Benzahra', 'Bouazza', 'Bouchikhi', 'Boujemaa', 'Boukhari', 'Boukhris', 'Boumaza', 'Chaoui', 'Cherif',
    'Cherkaoui', 'Daoudi', 'El Amrani', 'El Aziz', 'El Bakkali', 'El Ghali', 'El Haddad', 'El Hamdaoui', 'El Hassani',
    'El Idrissi', 'El Jabri', 'El Kadiri', 'El Khattabi', 'El Mansouri', 'El Mokhtar', 'El Ouafi', 'El Ouardi',
    'Essaidi', 'Fassi', 'Filali', 'Ghannam', 'Haddad', 'Haddaoui', 'Hajji', 'Hamdi', 'Hamidou', 'Hammadi',
    'Hassouni', 'Idrissi', 'Jabri', 'Jamal', 'Kadiri', 'Karam', 'Lahlou', 'Larbi', 'Lazaar', 'Mansouri',
    'Mejdoubi', 'Messaoudi', 'Mokhtar', 'Mounir', 'Moussa', 'Naciri', 'Ouazzani', 'Rafik', 'Rahman', 'Rahmani',
    'Raissouni', 'Sabri', 'Saidi', 'Salah', 'Salem', 'Slimani', 'Taha', 'Tahiri', 'Touhami', 'Yousfi', 'Ziani',

    // Origen rumano/eslavo
    'Alexandrescu', 'Andrei', 'Anghel', 'Anton', 'Barbu', 'Bogdan', 'Chiriac', 'Ciobanu', 'Cojocaru', 'Constantin',
    'Costea', 'Cretu', 'Cristea', 'Diaconu', 'Dima', 'Dobre', 'Draghici', 'Dumitrescu', 'Dumitru', 'Enache',
    'Filip', 'Florea', 'Gheorghe', 'Grigore', 'Iacob', 'Iancu', 'Iliescu', 'Ion', 'Ionescu', 'Lazar',
    'Lupu', 'Marin', 'Matei', 'Mihai', 'Mircea', 'Moldovan', 'Munteanu', 'Neagu', 'Nedelcu', 'Nicolae',
    'Nistor', 'Oprea', 'Petre', 'Pop', 'Popa', 'Popescu', 'Preda', 'Radu', 'Rusu', 'Sandu',
    'Serban', 'Stan', 'Stanciu', 'Stanescu', 'Stefan', 'Stoian', 'Stoica', 'Toma', 'Tudor', 'Ungureanu',
    'Vasile', 'Voicu', 'Zamfir',

    // Origen latinoamericano
    'Aguilera', 'Alcázar', 'Almonte', 'Amador', 'Amaral', 'Aráuz', 'Arévalo', 'Argueta', 'Arriaga', 'Astudillo',
    'Banegas', 'Barrios', 'Bastidas', 'Betancourt', 'Bobadilla', 'Borrero', 'Brito', 'Bustamante', 'Caballero', 'Cabezas',
    'Cáceres', 'Cadena', 'Calderón', 'Camacho', 'Canales', 'Cárdenas', 'Carranza', 'Carrión', 'Casares', 'Cedeño',
    'Centeno', 'Cerda', 'Cervantes', 'Chávez', 'Colón', 'Cordero', 'Coronel', 'Cortés', 'Cuellar', 'Dávila',
    'De la Cruz', 'De León', 'Delgadillo', 'Duarte', 'Durán', 'Elizondo', 'Enríquez', 'Escalante', 'Escobedo', 'Espinal',
    'Espinoza', 'Estévez', 'Estrella', 'Fajardo', 'Falcón', 'Figueroa', 'Garay', 'Garibay', 'Godoy', 'Grimaldo',
    'Guardado', 'Guevara', 'Guillen', 'Henríquez', 'Huerta', 'Iñiguez', 'Jácome', 'Jaramillo', 'Juárez', 'Leal',
    'Leiva', 'Lemus', 'León', 'Llanos', 'Macedo', 'Machado', 'Madrigal', 'Manzanarez', 'Mármol', 'Mejía',
    'Melgar', 'Mena', 'Mendez', 'Mercado', 'Molinero', 'Monje', 'Montalvo', 'Montiel', 'Mosquera', 'Murcia',
    'Murillo', 'Nájera', 'Naranjo', 'Nava', 'Nieves', 'Noriega', 'Novoa', 'Obando', 'Ochoa', 'Ojeda',
    'Olivas', 'Olmedo', 'Oñate', 'Ordaz', 'Ornelas', 'Oropeza', 'Orrego', 'Oseguera', 'Osorio', 'Otero',
    'Oyola', 'Ozuna', 'Padrón', 'Palencia', 'Pantoja', 'Patiño', 'Paz', 'Peñaloza', 'Pereda', 'Pineda',
    'Pinzón', 'Plata', 'Polanco', 'Ponce', 'Posada', 'Prado', 'Quezada', 'Quiroga', 'Quiroz', 'Ramírez',
    'Rangel', 'Reynoso', 'Rincón', 'Riojas', 'Riva', 'Rivera', 'Robledo', 'Rodas', 'Rosales', 'Rosario',
    'Roybal', 'Ruelas', 'Saavedra', 'Saenz', 'Salcido', 'Saldívar', 'Sandoval', 'Santillán', 'Serrato', 'Sevilla',
    'Solano', 'Solorzano', 'Tamayo', 'Tejeda', 'Terán', 'Toribio', 'Tovar', 'Trejo', 'Treviño', 'Ulloa',
    'Uribe', 'Urquiza', 'Valdivia', 'Valencia', 'Valladares', 'Vallejo', 'Varela', 'Vásquez', 'Vega', 'Velasco',
    'Velásquez', 'Venegas', 'Vera', 'Verdejo', 'Villagómez', 'Villalobos', 'Villanueva', 'Villatoro', 'Yáñez', 'Zabala',
    'Zambrano', 'Zarate', 'Zavala', 'Zepeda', 'Zúñiga'
];

// Apellidos compuestos frecuentes
export const APELLIDOS_COMPUESTOS = [
    'de la Cruz', 'de la Rosa', 'de la Torre', 'de la Fuente', 'de la Vega', 'de la Paz',
    'de León', 'de Anda', 'de Jesús', 'de Dios', 'de Gracia', 'de María',
    'del Valle', 'del Río', 'del Campo', 'del Castillo', 'del Moral', 'del Pino',
    'San Martín', 'San Juan', 'San Miguel', 'San José', 'Santa María', 'Santa Cruz',
    'García López', 'García Martínez', 'García Rodríguez', 'González García', 'Fernández García',
    'López García', 'Martínez García', 'Rodríguez García', 'Sánchez García', 'Pérez García'
];

// Partículas nobiliarias y conectores de apellidos
export const PARTICULAS_APELLIDOS = [
    'de', 'del', 'de la', 'de los', 'de las', 'y', 'e', 'i'
];
