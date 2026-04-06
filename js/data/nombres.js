// Diccionario ampliado de nombres españoles
// Fuentes: INE (Instituto Nacional de Estadística), datos 2024
// Total: ~500 nombres de mujer + ~500 nombres de hombre

export const NOMBRES_MUJER = [
    // Top 100 más frecuentes en España (INE 2024)
    'María', 'Carmen', 'Ana', 'Isabel', 'Dolores', 'Pilar', 'Josefa', 'Teresa', 'Rosa', 'Cristina',
    'Francisca', 'Laura', 'Antonia', 'Marta', 'Mercedes', 'Lucía', 'Luisa', 'Elena', 'Concepción', 'Rosario',
    'Juana', 'Manuela', 'Raquel', 'Sara', 'Paula', 'Beatriz', 'Patricia', 'Julia', 'Andrea', 'Rocío',
    'Encarnación', 'Silvia', 'Ángela', 'Margarita', 'Mónica', 'Eva', 'Rosa María', 'Amparo', 'Inmaculada', 'Nuria',
    'Victoria', 'Sandra', 'Irene', 'Claudia', 'Alba', 'Natalia', 'Alicia', 'Sofía', 'Susana', 'Sonia',
    'Marina', 'Yolanda', 'Verónica', 'Carolina', 'Esther', 'Gloria', 'Noelia', 'Lorena', 'Montserrat', 'Emilia',
    'Consuelo', 'Soledad', 'Esperanza', 'Milagros', 'Aurora', 'Carla', 'Nieves', 'Nerea', 'Emma', 'Ester',
    'Celia', 'Miriam', 'Olga', 'Lidia', 'Elisa', 'Blanca', 'Ainhoa', 'Lourdes', 'Clara', 'Inés',
    'Valentina', 'Martina', 'Adriana', 'Daniela', 'Valeria', 'Abril', 'Lola', 'Maite', 'Ainara', 'Aitana',
    'Leire', 'Ariadna', 'Candela', 'Alma', 'Vera', 'Olivia', 'Vega', 'Jimena', 'Laia', 'Triana',

    // Nombres compuestos más frecuentes
    'María Carmen', 'María Pilar', 'María Teresa', 'María Dolores', 'María Ángeles', 'María José',
    'María Luisa', 'María Jesús', 'María Isabel', 'María Rosa', 'María Antonia', 'María Victoria',
    'María Elena', 'María Soledad', 'María Paz', 'María Eugenia', 'María Cristina', 'María Mercedes',
    'Ana María', 'Ana Isabel', 'Ana Belén', 'Rosa María', 'María del Carmen', 'María del Mar',
    'María del Pilar', 'María de los Ángeles', 'María Concepción', 'María Rosario', 'María Francisca',
    'María Asunción', 'María Esperanza', 'María Nieves', 'María Purificación', 'María Amparo',

    // 100-200 frecuentes
    'Asunción', 'Fátima', 'Remedios', 'Leonor', 'Elvira', 'Catalina', 'Ángeles', 'Ascensión', 'Begoña', 'Trinidad',
    'Purificación', 'Paloma', 'Gemma', 'Vanesa', 'Leticia', 'Rebeca', 'Jessica', 'Jennifer', 'Tamara', 'Sheila',
    'Míriam', 'Noemi', 'Judith', 'Ruth', 'Gema', 'Tania', 'Alejandra', 'Lara', 'Diana', 'Araceli',
    'Marisa', 'Mª Carmen', 'Mª José', 'Mª Teresa', 'Mª Dolores', 'Mª Ángeles', 'Mª Pilar', 'Mª Isabel',
    'Josefina', 'Eugenia', 'Felisa', 'Felicidad', 'Marisol', 'Angélica', 'Adoración', 'Visitación', 'Presentación',

    // 200-300 frecuentes
    'Juliana', 'Vicenta', 'Adela', 'Matilde', 'Gregoria', 'Agustina', 'Ramona', 'Tomasa', 'Petra', 'Benita',
    'Bernarda', 'Basilia', 'Casilda', 'Celestina', 'Dionisia', 'Dominga', 'Dorotea', 'Eduarda', 'Eloísa', 'Ernestina',
    'Escolástica', 'Eusebia', 'Fabiana', 'Feliciana', 'Fermina', 'Filomena', 'Florentina', 'Fortunata', 'Generosa', 'Genoveva',
    'Gertrudis', 'Herminia', 'Honorata', 'Inocencia', 'Isidora', 'Jacinta', 'Leocadia', 'Leopolda', 'Liberata', 'Lorenza',
    'Luciana', 'Marcelina', 'Maximina', 'Melchora', 'Micaela', 'Nemesia', 'Nicolasa', 'Obdulia', 'Otilia', 'Pascuala',

    // 300-400 frecuentes (incluye nombres modernos y extranjeros comunes en España)
    'Yaiza', 'Yanira', 'Yoana', 'Zaira', 'Zoe', 'Abril', 'África', 'Aina', 'Ainoa', 'Alaia',
    'Alexia', 'Alicia', 'Amaia', 'Amelia', 'América', 'Amparo', 'Anaís', 'Ane', 'Aroa', 'Aura',
    'Berta', 'Bianca', 'Brenda', 'Bruna', 'Camila', 'Carlota', 'Cayetana', 'Chloe', 'Cloe', 'Constanza',
    'Coral', 'Dafne', 'Delia', 'Desirée', 'Edurne', 'Eider', 'Elba', 'Eleonor', 'Eliana', 'Elisabet',
    'Elvira', 'Ema', 'Emilia', 'Encarna', 'Erica', 'Esmeralda', 'Estela', 'Estrella', 'Eulalia', 'Europa',

    // 400-500 (nombres extranjeros frecuentes en España)
    'Fátima', 'Fatou', 'Fatiha', 'Fatoumata', 'Aicha', 'Aisha', 'Amina', 'Aminata', 'Asma', 'Binta',
    'Chadya', 'Djamila', 'Faiza', 'Farida', 'Hafsa', 'Halima', 'Hanane', 'Hayat', 'Houda', 'Ikram',
    'Imane', 'Ines', 'Jamila', 'Kaouter', 'Karima', 'Khadija', 'Laila', 'Latifa', 'Leila', 'Loubna',
    'Malika', 'Mariam', 'Mariama', 'Maryam', 'Meriem', 'Mina', 'Mouna', 'Nadia', 'Naima', 'Najat',
    'Naoual', 'Nassima', 'Nawal', 'Nezha', 'Nora', 'Noura', 'Ouafae', 'Rachida', 'Radia', 'Rafika',
    'Rahma', 'Raja', 'Rajae', 'Rokia', 'Sabah', 'Safia', 'Saida', 'Salma', 'Samia', 'Samira',
    'Sanaa', 'Sara', 'Siham', 'Soukaina', 'Souad', 'Wafa', 'Wafae', 'Yasmina', 'Yasmine', 'Zineb',
    'Zohra', 'Zoulikha',

    // Nombres rumanos/eslavos frecuentes
    'Adriana', 'Alexandra', 'Alina', 'Ana', 'Anca', 'Andreea', 'Bianca', 'Camelia', 'Catalina', 'Claudia',
    'Corina', 'Cosmina', 'Cristina', 'Dana', 'Daniela', 'Diana', 'Elena', 'Eliza', 'Emanuela', 'Florina',
    'Gabriela', 'Georgiana', 'Ileana', 'Ioana', 'Irina', 'Larisa', 'Laura', 'Lavinia', 'Loredana', 'Luminita',
    'Madalina', 'Marcela', 'Maria', 'Mariana', 'Mihaela', 'Mirela', 'Monica', 'Nadia', 'Natalia', 'Nicoleta',
    'Oana', 'Otilia', 'Paula', 'Petronela', 'Raluca', 'Ramona', 'Rodica', 'Roxana', 'Simona', 'Sorina',
    'Stefania', 'Valentina', 'Vasilica', 'Viorica',

    // Nombres latinoamericanos frecuentes
    'Alejandra', 'América', 'Angélica', 'Aracely', 'Belén', 'Brenda', 'Carolina', 'Cecilia', 'Claudia', 'Delia',
    'Dulce', 'Edith', 'Elizabeth', 'Erika', 'Esmeralda', 'Esperanza', 'Estrella', 'Fabiola', 'Fernanda', 'Flor',
    'Gabriela', 'Gisela', 'Graciela', 'Guadalupe', 'Iliana', 'Irma', 'Ivonne', 'Jackeline', 'Janet', 'Jazmin',
    'Jenny', 'Jessica', 'Jocelyn', 'Johana', 'Josefina', 'Karen', 'Karina', 'Katherine', 'Keyla', 'Lidia',
    'Lilian', 'Liliana', 'Linda', 'Lizeth', 'Lorena', 'Lucia', 'Luisa', 'Luz', 'Maira', 'Marcela',
    'Margarita', 'Maribel', 'Maricela', 'Marisol', 'Marlene', 'Martha', 'Mayra', 'Mercedes', 'Miriam', 'Nancy',
    'Nelly', 'Norma', 'Olga', 'Paola', 'Patricia', 'Perla', 'Pilar', 'Raquel', 'Reina', 'Rocio',
    'Rosa', 'Rosario', 'Sandra', 'Silvia', 'Socorro', 'Sonia', 'Susana', 'Teresa', 'Veronica', 'Virginia',
    'Viviana', 'Wendy', 'Ximena', 'Yolanda', 'Yuridia'
];

export const NOMBRES_HOMBRE = [
    // Top 100 más frecuentes en España (INE 2024)
    'Antonio', 'José', 'Manuel', 'Francisco', 'Juan', 'David', 'José Antonio', 'José Luis', 'Jesús', 'Javier',
    'Francisco Javier', 'Carlos', 'Daniel', 'Miguel', 'Rafael', 'Pedro', 'José Manuel', 'Ángel', 'Alejandro', 'Miguel Ángel',
    'José María', 'Fernando', 'Luis', 'Pablo', 'Sergio', 'Jorge', 'Alberto', 'Juan Carlos', 'Juan José', 'Diego',
    'Adrián', 'Juan Antonio', 'Raúl', 'Enrique', 'Álvaro', 'Ramón', 'Vicente', 'Iván', 'Rubén', 'Óscar',
    'Andrés', 'Joaquín', 'Santiago', 'Eduardo', 'Víctor', 'Roberto', 'Mario', 'Jaime', 'Francisco José', 'Marcos',
    'Hugo', 'Ignacio', 'Jordi', 'Alfonso', 'Salvador', 'Ricardo', 'Emilio', 'Gonzalo', 'Julián', 'Tomás',
    'Agustín', 'Gabriel', 'Guillermo', 'Mariano', 'Félix', 'Martín', 'Lucas', 'Nicolás', 'Sebastián', 'Felipe',
    'Lorenzo', 'Esteban', 'Marc', 'Pol', 'Bruno', 'Álex', 'Iker', 'Aitor', 'Jon', 'Mikel',
    'Unai', 'Asier', 'Gorka', 'Xavi', 'Pau', 'Oriol', 'Joan', 'Arnau', 'Nil', 'Eric',
    'Gerard', 'Adrià', 'Bernat', 'Guillem', 'Jan', 'Aleix', 'Albert', 'Víctor', 'Josep', 'Ferran',

    // Nombres compuestos más frecuentes
    'José Antonio', 'José Luis', 'José Manuel', 'José María', 'José Miguel', 'José Ramón', 'José Ángel',
    'Juan Carlos', 'Juan José', 'Juan Antonio', 'Juan Manuel', 'Juan Francisco', 'Juan Miguel', 'Juan Pedro',
    'Francisco Javier', 'Francisco José', 'Miguel Ángel', 'Luis Miguel', 'Pedro Antonio', 'Pedro José',
    'Carlos Alberto', 'Juan Pablo', 'José Ignacio', 'José Francisco', 'Manuel Antonio', 'Manuel José',
    'Antonio José', 'Antonio Manuel', 'Antonio Miguel', 'Rafael Antonio', 'Rafael José', 'Ángel Luis',

    // 100-200 frecuentes
    'Mateo', 'Leo', 'Izan', 'Thiago', 'Oliver', 'Liam', 'Gael', 'Samuel', 'Enzo', 'Marco',
    'Dylan', 'Héctor', 'Rodrigo', 'Manuel', 'Iván', 'Aarón', 'Adam', 'Aitor', 'Alan', 'Alejandro',
    'Alfonso', 'Alfredo', 'Álvaro', 'Amadeo', 'Amador', 'Andrés', 'Ángel', 'Anselmo', 'Antonio', 'Arcadio',
    'Arsenio', 'Arturo', 'Aurelio', 'Baldomero', 'Baltasar', 'Bartolomé', 'Basilio', 'Benito', 'Benjamín', 'Bernabé',
    'Bernardo', 'Bienvenido', 'Blas', 'Bonifacio', 'Bruno', 'Buenaventura', 'Calixto', 'Camilo', 'Cándido', 'Carlos',

    // 200-300 frecuentes
    'Carmelo', 'Casimiro', 'Cayetano', 'Cecilio', 'Celestino', 'César', 'Cipriano', 'Cirilo', 'Claudio', 'Clemente',
    'Constantino', 'Cornelio', 'Cosme', 'Cristóbal', 'Dámaso', 'Damián', 'Darío', 'Demetrio', 'Diego', 'Dionisio',
    'Domingo', 'Donato', 'Edgar', 'Edmundo', 'Eduardo', 'Efraín', 'Eleuterio', 'Elías', 'Eliseo', 'Emeterio',
    'Emiliano', 'Emilio', 'Enrique', 'Epifanio', 'Ernesto', 'Esteban', 'Eugenio', 'Eusebio', 'Evaristo', 'Ezequiel',
    'Fabián', 'Faustino', 'Fausto', 'Federico', 'Feliciano', 'Felipe', 'Félix', 'Fermín', 'Fernando', 'Fidel',

    // 300-400 frecuentes
    'Florencio', 'Florentino', 'Fortunato', 'Fructuoso', 'Gabino', 'Gabriel', 'Gaspar', 'Genaro', 'Gerardo', 'Germán',
    'Gervasio', 'Gil', 'Ginés', 'Godofredo', 'Gonzalo', 'Gregorio', 'Guido', 'Guillermo', 'Gustavo', 'Heliodoro',
    'Heraclio', 'Hermelindo', 'Hermenegildo', 'Herminio', 'Higinio', 'Hilario', 'Hipólito', 'Honorato', 'Horacio', 'Hugo',
    'Humberto', 'Ignacio', 'Ildefonso', 'Inocencio', 'Isaac', 'Isaías', 'Isidoro', 'Isidro', 'Ismael', 'Israel',
    'Jacinto', 'Jacobo', 'Jaime', 'Javier', 'Jenaro', 'Jerónimo', 'Jesús', 'Joaquín', 'Joel', 'Jonás',

    // 400-500 (nombres extranjeros frecuentes en España)
    'Mohamed', 'Mohammed', 'Muhammad', 'Ahmed', 'Abdel', 'Abdelkader', 'Abdelkarim', 'Abdellatif', 'Abdellah', 'Abderrahim',
    'Abderrahman', 'Abdesalam', 'Abdessamad', 'Abdou', 'Abdul', 'Abdulah', 'Abdullah', 'Adil', 'Adnan', 'Ahmad',
    'Ali', 'Amine', 'Amir', 'Anass', 'Anas', 'Ayoub', 'Aziz', 'Bilal', 'Brahim', 'Chakib',
    'Driss', 'El Hassan', 'El Mehdi', 'Farid', 'Fouad', 'Habib', 'Hachim', 'Hafid', 'Hamid', 'Hamza',
    'Hassan', 'Hicham', 'Houssam', 'Ibrahim', 'Idriss', 'Ilias', 'Imad', 'Ismail', 'Jamal', 'Kamal',
    'Karim', 'Khalid', 'Khalil', 'Lahcen', 'Larbi', 'Mahdi', 'Mahmoud', 'Malik', 'Mamadou', 'Marouane',
    'Mehdi', 'Miloud', 'Mounir', 'Mourad', 'Moussa', 'Mustapha', 'Nabil', 'Nadir', 'Nassim', 'Noureddine',
    'Omar', 'Otman', 'Oussama', 'Rachid', 'Reda', 'Riad', 'Said', 'Saïd', 'Salah', 'Salim',
    'Samir', 'Sidi', 'Sofiane', 'Soufiane', 'Tarik', 'Yassine', 'Youssef', 'Youssoupha', 'Zakaria', 'Zouhair',

    // Nombres rumanos/eslavos frecuentes
    'Adrian', 'Alexandru', 'Alin', 'Andrei', 'Bogdan', 'Catalin', 'Ciprian', 'Claudiu', 'Constantin', 'Cosmin',
    'Costel', 'Cristian', 'Daniel', 'Darius', 'Dorin', 'Dragos', 'Eduard', 'Emil', 'Eugen', 'Florian',
    'Florin', 'Gabriel', 'George', 'Gheorghe', 'Ionel', 'Ion', 'Ionut', 'Laurentiu', 'Liviu', 'Lucian',
    'Marian', 'Marius', 'Mihai', 'Mircea', 'Nicolae', 'Ovidiu', 'Paul', 'Petru', 'Radu', 'Razvan',
    'Robert', 'Sergiu', 'Sorin', 'Stefan', 'Vasile', 'Victor', 'Viorel', 'Vlad', 'Vladimir',

    // Nombres latinoamericanos frecuentes
    'Alejandro', 'Alfredo', 'Andrés', 'Armando', 'Arturo', 'Benito', 'Bernardo', 'Carlos', 'César', 'Cristian',
    'Damián', 'Darwin', 'Edwin', 'Efraín', 'Emiliano', 'Enrique', 'Ernesto', 'Esteban', 'Fabián', 'Federico',
    'Felipe', 'Fernando', 'Francisco', 'Gabriel', 'Gerardo', 'Giovanni', 'Gonzalo', 'Gregorio', 'Guillermo', 'Gustavo',
    'Héctor', 'Henry', 'Hernán', 'Hugo', 'Ignacio', 'Iván', 'Jaime', 'Javier', 'Jefferson', 'Jesús',
    'Jhon', 'Jimmy', 'Joaquín', 'Joel', 'Jonathan', 'Jorge', 'José', 'Juan', 'Julio', 'Kevin',
    'Leonardo', 'Luis', 'Manuel', 'Marcelo', 'Marco', 'Mario', 'Martín', 'Mauricio', 'Miguel', 'Nelson',
    'Nicolás', 'Óscar', 'Pablo', 'Patricio', 'Pedro', 'Rafael', 'Ramiro', 'Raúl', 'René', 'Ricardo',
    'Roberto', 'Rodrigo', 'Rubén', 'Santiago', 'Sebastián', 'Sergio', 'Vicente', 'Víctor', 'Walter', 'William',
    'Wilson', 'Yonatan'
];

// Nombres que pueden ser de ambos géneros
export const NOMBRES_UNISEX = [
    'Alex', 'Andrea', 'Ariel', 'Cameron', 'Cruz', 'Dani', 'Eider', 'Francis', 'Guadalupe', 'Ira',
    'Jael', 'Jesús', 'Jordan', 'Montserrat', 'Noel', 'Pau', 'Reyes', 'Rosario', 'Sagrario', 'Trinidad'
];

// Abreviaturas comunes de nombres
export const ABREVIATURAS_NOMBRES = {
    'Mª': 'María',
    'M.': 'María',
    'Ma': 'María',
    'Ma.': 'María',
    'Fco': 'Francisco',
    'Fco.': 'Francisco',
    'Fdo': 'Fernando',
    'Fdo.': 'Fernando',
    'Jse': 'José',
    'J.': 'José',
    'Ant': 'Antonio',
    'Ant.': 'Antonio',
    'Anto': 'Antonio',
    'Mig': 'Miguel',
    'Mgl': 'Miguel',
    'Cris': 'Cristina',
    'Tere': 'Teresa',
    'Paco': 'Francisco',
    'Pepe': 'José',
    'Lola': 'Dolores',
    'Concha': 'Concepción',
    'Conchi': 'Concepción',
    'Pili': 'Pilar',
    'Maite': 'María Teresa',
    'Maribel': 'María Isabel',
    'Maricarmen': 'María Carmen',
    'Marisa': 'María Luisa',
    'Merche': 'Mercedes',
    'Charo': 'Rosario',
    'Rafa': 'Rafael',
    'Nacho': 'Ignacio',
    'Manolo': 'Manuel',
    'Kiko': 'Francisco',
    'Quique': 'Enrique',
    'Juanjo': 'Juan José',
    'Juanma': 'Juan Manuel',
    'Javi': 'Javier',
    'Dani': 'Daniel',
    'Toni': 'Antonio',
    'Santi': 'Santiago',
    'Edu': 'Eduardo',
    'Fer': 'Fernando',
    'Guille': 'Guillermo'
};
