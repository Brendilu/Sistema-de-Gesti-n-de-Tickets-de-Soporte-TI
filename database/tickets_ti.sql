CREATE DATABASE IF NOT EXISTS tickets_ti CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tickets_ti;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS notificaciones, ticket_historial, ticket_adjuntos, tickets,
                     usuarios, empleados, areas, estados, prioridades, roles, empresas;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- MULTIEMPRESA: una sola base de datos, todas las empresas separadas por empresa_id.
-- Catálogos globales (iguales para todas): roles, prioridades, estados.
-- Datos propios de cada empresa: areas, empleados, usuarios, tickets
--   (adjuntos, historial y notificaciones cuelgan de un ticket/usuario, así que heredan la empresa).
-- ============================================================================
CREATE TABLE empresas (
  id SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  codigo VARCHAR(30) NOT NULL UNIQUE,           -- código corto para registrarse (ej. grupoflores)
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
  id TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(30) NOT NULL UNIQUE            
);

CREATE TABLE prioridades (
  id TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(20) NOT NULL UNIQUE,           
  sla_horas SMALLINT UNSIGNED NOT NULL          
);

CREATE TABLE estados (
  id TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(20) NOT NULL UNIQUE,           
  orden TINYINT UNSIGNED NOT NULL,
  es_final BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE areas (
  id SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  empresa_id SMALLINT UNSIGNED NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  UNIQUE KEY uq_area_empresa (empresa_id, nombre),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

CREATE TABLE empleados (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  empresa_id SMALLINT UNSIGNED NOT NULL,
  nombre_completo VARCHAR(120) NOT NULL,
  cargo VARCHAR(80),
  area_id SMALLINT UNSIGNED,
  celular VARCHAR(15),
  correo VARCHAR(120),
  UNIQUE KEY uq_empleado_correo (empresa_id, correo),
  INDEX idx_empleado_empresa (empresa_id),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (area_id) REFERENCES areas(id)
);

CREATE TABLE usuarios (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  empresa_id SMALLINT UNSIGNED NOT NULL,
  empleado_id INT UNSIGNED NULL,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,           -- único en todo el sistema: con él se entra y se sabe la empresa
  password_hash VARCHAR(255) NOT NULL,          
  rol_id TINYINT UNSIGNED NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_usuario_empresa (empresa_id),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE SET NULL,
  FOREIGN KEY (rol_id) REFERENCES roles(id)
);

CREATE TABLE tickets (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  empresa_id SMALLINT UNSIGNED NOT NULL,
  codigo VARCHAR(12) NOT NULL,           
  titulo VARCHAR(150) NOT NULL,
  descripcion TEXT NOT NULL,
  prioridad_id TINYINT UNSIGNED NOT NULL,
  estado_id TINYINT UNSIGNED NOT NULL,
  solicitante_id INT UNSIGNED NULL,        
  tecnico_id INT UNSIGNED NULL,                
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cerrado_en DATETIME NULL,
  UNIQUE KEY uq_ticket_codigo (empresa_id, codigo),      -- cada empresa lleva su propia numeración TCK-0001...
  INDEX idx_empresa_estado (empresa_id, estado_id),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (prioridad_id) REFERENCES prioridades(id),
  FOREIGN KEY (estado_id) REFERENCES estados(id),
  FOREIGN KEY (solicitante_id) REFERENCES empleados(id) ON DELETE SET NULL,
  FOREIGN KEY (tecnico_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_estado (estado_id), INDEX idx_tecnico (tecnico_id), INDEX idx_creado (creado_en)
);

CREATE TABLE ticket_adjuntos (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ticket_id INT UNSIGNED NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  ruta VARCHAR(500) NOT NULL,
  mime VARCHAR(30) NOT NULL,
  tamano_bytes INT UNSIGNED,
  subido_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

CREATE TABLE ticket_historial (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ticket_id INT UNSIGNED NOT NULL,
  estado_anterior_id TINYINT UNSIGNED NULL,     
  estado_nuevo_id TINYINT UNSIGNED NOT NULL,
  usuario_id INT UNSIGNED NULL,                
  comentario VARCHAR(500) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_comentario CHECK (CHAR_LENGTH(TRIM(comentario)) > 0),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (estado_anterior_id) REFERENCES estados(id),
  FOREIGN KEY (estado_nuevo_id) REFERENCES estados(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE notificaciones (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  ticket_id INT UNSIGNED NULL,
  tipo ENUM('creado','asignado','estado','sla') NOT NULL,
  titulo VARCHAR(80) NOT NULL,
  mensaje VARCHAR(255) NOT NULL,
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  INDEX idx_usuario_leida (usuario_id, leida)
);


INSERT INTO empresas (id, nombre, codigo) VALUES
 (1,'Grupo Flores','grupoflores'),
 (2,'Clínica Santa Aurora','santaaurora'),
 (3,'Constructora Andes Norte','andesnorte');

INSERT INTO roles (id, nombre) VALUES (1,'Administrador'),(2,'Técnico'),(3,'Usuario');

INSERT INTO prioridades (id, nombre, sla_horas) VALUES (1,'Alta',4),(2,'Media',24),(3,'Baja',72);

INSERT INTO estados (id, nombre, orden, es_final) VALUES
 (1,'Nuevo',1,FALSE),(2,'Abierto',2,FALSE),(3,'En proceso',3,FALSE),(4,'Resuelto',4,FALSE),(5,'Cerrado',5,TRUE);

INSERT INTO areas (id, empresa_id, nombre) VALUES
 (1,1,'ADMINISTRACIÓN'),
 (2,1,'ASESORÍA LEGAL'),
 (3,1,'CAMPOS PROPIOS'),
 (4,1,'CONTABILIDAD'),
 (5,1,'COSECHA'),
 (6,1,'CRÉDITOS Y COBRANZAS'),
 (7,1,'DIRECCION'),
 (8,1,'GERENCIA GENERAL'),
 (9,1,'HABILITACIONES Y ACOPIO'),
 (10,1,'LABORATORIO'),
 (11,1,'LIQUIDACIONES'),
 (12,1,'LOGÍSTICA'),
 (13,1,'MAQUINARIA AGRÍCOLA Y VEHÍCULOS LIVIANOS'),
 (14,1,'PROVEEDORES'),
 (15,1,'RECURSOS HUMANOS'),
 (16,1,'SISTEMAS'),
 (17,1,'TESORERÍA');

INSERT INTO empleados (id, empresa_id, nombre_completo, cargo, area_id, celular, correo) VALUES
 (1,1,'ALAN DANNY DE LA CRUZ ARANCIBIA','JEFE DE CAMPOS PROPIOS',3,'934939843','supervisorcampo2020@gmail.com'),
 (2,1,'MARTIR LOPEZ','INGENIERO ENCARGADO DE CAMPO',3,'939533593','jefeareasembradoresgf@gmail.com'),
 (3,1,'BENAVIDES TIMANA ERIC JOFFRE','JEFE DE RECURSOS HUMANOS',15,'961605620','recursos919@gmail.com'),
 (4,1,'BRAID COLLANTES VILLALOBOS','ASISTENTE',3,'988181339','asist.efv@gmail.com'),
 (5,1,'CABRERA HERNANDEZ OLENKA FIORELLA','ANALISTA',11,'964172304','o_len_k@hotmail.com'),
 (6,1,'CARHUACTOCTO TORO ROXANA MARIBEL','ASISTENTE',12,'946319119','asistenteoperacionesgf@gmail.com'),
 (7,1,'CAROLINA BELEN VÁSQUEZ SANCHEZ','TESORERA',17,'956866233','campocaja1@gmail.com'),
 (8,1,'CASTILLO PULACHE JUAN EDGAR','CAJERO',17,'943406634','jecastillopulache@gmail.com'),
 (9,1,'CEPEDA DAVILA WILSON YOHOVANI','JEFE DE COSECHA',5,'932733532','camposupervisor01@gmail.com'),
 (10,1,'CHERO PINEDA WALTER WANNER','ACOPIADOR',9,'972578691','wcheropineda@gmail.com'),
 (11,1,'CRUZ CHANDUVÍ VICTOR ENRIQUE','JEFE DE HABILITACIONES Y ACOPIO',9,'932638537','jefeacopiogf@grupoflores.pe'),
 (12,1,'DANIEL BANCES CRUZ','CAPORAL',3,'929971401',NULL),
 (13,1,'ENRIQUE IZAGUIRRE ALVARADO','DIRECTOR EJECUTIVO',7,'940554362','directorejecutivo@grupoflores.pe'),
 (14,1,'EULER ZUÑE MONTALVO','GERENTE GENERAL',8,'905441358','gerenciageneral@alimentaperu.pe'),
 (15,1,'FLORES ENEQUE MARIBEL','JEFE DE ADMINISTRACION',1,'949690686','direccion@alimentaperu.pe'),
 (16,1,'FLORES VILCHEZ PORFIRIO','ASISTENTE',1,'949809292','porfirio.flores@usil.pe'),
 (17,1,'FLORES VILCHEZ SANTOS','ASISTENTE',3,'988100002','informes2080@gmail.com'),
 (18,1,'GONZALES AGUILAR NOELIA','AUXILIAR DE LIMPIEZA',1,'948716628','noeliagonzalesaguilar95@gmail.com'),
 (19,1,'GORDILLO AYASTA MAURA JACOBA','SUPERVISOR',14,'933774183','asistentecampo2020@gmail.com'),
 (20,1,'HUME LACHOS JUAN CARLOS','GERENTE GENERAL',8,'954831140','juanhumelachos@gmail.com'),
 (21,1,'INCIO DELGADO OSCAR ALONSO','ACOPIADOR',9,'956746285','oskalon7@gmail.com'),
 (22,1,'JOSE GILMER RODRIGUEZ LLATAS','COORDINADOR',12,'934602142','logistica.ventas.gf@gmail.com'),
 (23,1,'JOSELYNE ALEJANDRA BUSTAMANTE FAILOC','TESORERA',17,'949559385','tesoreria@alimentaperu.pe'),
 (24,1,'JUAN YAMPIERS CHANAME ALVARADO','ASISTENTE',4,'966385764','acontableap@gmail.com'),
 (25,1,'LLUNCOR BURGOS MILTON RAUL','SEGURIDAD',8,'972120329','miltonlluncorb@gmail.com'),
 (26,1,'LUIS VERGARA PALACIOS','CONTADOR',4,'978052550','contadorcorporativo@alimentaperu.pe'),
 (27,1,'LUZ ELENA FLORES VASQUEZ','SUB GERENTE',8,'990323176','gestiondeareas3@gmail.com'),
 (28,1,'NEISER RUIZ REGALADO','GERENTE GENERAL',8,'995800093','gerentecorporativo@grupoflores.pe'),
 (29,1,'NUÑEZ GUEVARA FLOR ZORAIDA','ASISTENTE',10,'979546568','flor16584999@gmail.com'),
 (30,1,'PISCO ZAVALETA GUSTAVO ANTONIO','ASISTENTE',1,'968979420','gerencia.morus@gmail.com'),
 (31,1,'PISCO ZAVALETA JOSE ALBERTO','CONTROLADOR DE CARGUIO',5,'929439353','josealbertopiscozavaleta@gmail.com'),
 (32,1,'RAFAEL SANCHEZ OFREDY','OPERADOR DE MAQUINARIA',13,'921354005','sanchezofredy18@gmail.com'),
 (33,1,'RIMARACHIN HUAMAN ROBER YOEYNER','ASESOR LEGAL',2,'951798185','solucioneslegalescorporativa@gmail.com'),
 (34,1,'ROJAS CAMPOS JOSE LUIS','CONTROLADOR DE CARGUIO',5,'934602137','jlojasc22@gmail.com'),
 (35,1,'SALAZAR BALLENA KEILY MADELLY','ASISTENTE',15,'968262114','recursoshh.asistente@gmail.com'),
 (36,1,'SARMIENTO SARMIENTO JOSE MANUEL','JEFE DE SISTEMAS',16,'949251905','sistemas@grupoflores.pe'),
 (37,1,'SILVA ACUÑA JESUS GONZALO','OPERADOR DE MAQUINARIA',13,'957609262','jesussilva8833@gmail.com'),
 (38,1,'TAPIA DELGADO KARIN','ANALISTA',6,'985399673','admcampo2020@gmail.com'),
 (39,1,'TARRILLO RODRIGUEZ ALEX','CONTROLADOR DE CARGUIO',5,'943404459','trans.chirinosllontop@gmail.com'),
 (40,1,'TELLO LLATAS JOHN PAUL','SUB JEFE DE MAQUINARIA AGRÍCOLA',13,'979872140','j.tello2203@gmail.com'),
 (41,1,'TIRADO VARGAS GABINO MARCELO','ACOPIADOR',9,'979410567','acopiadorcampogf@gmail.com'),
 (42,1,'VASQUEZ SILVA PERSI','ASISTENTE',3,'954693044','producciongrupoflores@gmail.com'),
 (43,1,'VELAZCO DELGADO VICTOR ROBERTO','ASISTENTE',2,'958279523','vvelazco1@hotmail.com'),
 (44,1,'VIDARTE VILLALOBOS ENRIQUE','ALMACENERO',12,'952592897','vidartevillalobosenrique@gmail.com'),
 (45,1,'WILDER INOQUIO CANARIO','CONTADOR GENERAL',4,'943400377','contadorgeneral@alimentaperu.pe'),
 (46,1,'CHANAME SILVA JOSE SEGUNDO','APUNTADOR',3,'946380487',NULL),
 (47,1,'RANULFO ALEJANDRO FERNANDEZ VILCHEZ','JEFE DE CAMPO',3,'946935649','ranulfof.campo@gmail.com'),
 (48,1,'VICTOR RODRIGUEZ MONTEZA','ABOGADO',2,NULL,'vrrodriguezmonteza1@gmail.com'),
 (49,1,'ANA PAULA KCAM','ABOGADA',2,'997673603','abogadoskcam@gmail.com'),
 (50,1,'KELLY BRENDA CHAFLOQUE ESTOFANERO','ASISTENTE',3,'935355266','apoyocampo2025@gmail.com'),
 (51,1,'JOEL ZELADA','PRACTICANTE - EST. SISTEMAS',16,'937121250','pantera566cixt@gmail.com'),
 (52,1,'ROCIO FLORES','ASISTENTE',2,'963007612','legalasistente2025@gmail.com'),
 (53,1,'JOHN JOEL AYAY CORREA','INGENIERO',3,'976982962','trichogrammalaboratorio@gmail.com');

INSERT INTO usuarios (id, empresa_id, empleado_id, nombre, email, password_hash, rol_id, activo) VALUES
 (1,1,36,'José Sarmiento','sistemas@grupoflores.pe','pbkdf2:sha256:1000000$BFuEevERS64vMFRN$6830924196a978b71f38fadd8eb469feacca93b300c0f65da793613bab25fb7f',1,TRUE),
 (2,1,NULL,'Laura Medina','laura.medina@empresa.com','pbkdf2:sha256:1000000$kaHEQf3EcSQKTdWe$f14635ecc0d50013d6911ab304c23c8293de25837b4846d86855d2959026e5f9',1,TRUE),
 (3,1,NULL,'Ana Ruiz','ana.ruiz@empresa.com','pbkdf2:sha256:1000000$8ic7YVT5uQZVjd3H$5760de56c8396166c0f86809aff1c958a21bacf7bf8461371e862e098dcafa05',2,TRUE),
 (4,1,NULL,'Carlos Vega','carlos.vega@empresa.com','pbkdf2:sha256:1000000$6fIjgkkH8zyhJmIx$0f2570ee44cb50d4e461a46715261adf3316270aa2ada92e69998e285f916a9d',2,TRUE),
 (5,1,NULL,'Luis Paz','luis.paz@empresa.com','pbkdf2:sha256:1000000$4L4Y2xAavGzXE7Q3$28b6a1ecc56496b1e05e1383f19e8cc68cea196115ab72eceb8595f3e03f34fe',3,FALSE);

INSERT INTO tickets (id, empresa_id, codigo, titulo, descripcion, prioridad_id, estado_id, solicitante_id, tecnico_id, creado_en) VALUES
 (1,1,'TCK-0042','Caída de red en sede Lima','Sin conectividad en el piso 3.',1,3,14,3,NOW() - INTERVAL 310 MINUTE),
 (2,1,'TCK-0045','Impresora de contabilidad','La impresora no responde.',2,2,26,NULL,NOW() - INTERVAL 20 HOUR),
 (3,1,'TCK-0047','Instalación de software','Se requiere instalar software en el equipo.',3,2,35,4,NOW() - INTERVAL 6 HOUR);

INSERT INTO ticket_historial (ticket_id, estado_anterior_id, estado_nuevo_id, usuario_id, comentario, fecha) VALUES
 (1,NULL,1,NULL,'Ticket registrado.',NOW() - INTERVAL 310 MINUTE),
 (1,1,2,NULL,'Ticket registrado.',NOW() - INTERVAL 300 MINUTE),
 (1,2,3,3,'Se revisó el switch del piso 3.',NOW() - INTERVAL 250 MINUTE),
 (2,NULL,2,NULL,'Ticket registrado.',NOW() - INTERVAL 20 HOUR),
 (3,NULL,2,NULL,'Ticket registrado.',NOW() - INTERVAL 6 HOUR);

INSERT INTO notificaciones (usuario_id, ticket_id, tipo, titulo, mensaje, leida) VALUES
 (3,1,'asignado','Ticket asignado','El ticket TCK-0042 fue asignado a Ana Ruiz.',FALSE),
 (3,1,'sla','SLA por vencer','El ticket TCK-0042 superó su límite de 4 h.',FALSE),
 (3,1,'estado','Cambio de estado','El ticket TCK-0042 pasó a "En proceso".',TRUE);


-- ============================================================================
-- EMPRESAS DEMO 2 y 3  (contraseña de todas las cuentas demo: Demo2026!)
-- ============================================================================
INSERT INTO areas (id, empresa_id, nombre) VALUES
 (18,2,'ADMINISTRACIÓN'),(19,2,'ENFERMERÍA'),(20,2,'FARMACIA'),(21,2,'SISTEMAS'),(22,2,'ADMISIÓN'),
 (23,3,'OBRAS'),(24,3,'LOGÍSTICA'),(25,3,'ADMINISTRACIÓN'),(26,3,'SISTEMAS'),(27,3,'SEGURIDAD Y SALUD');

INSERT INTO empleados (id, empresa_id, nombre_completo, cargo, area_id, celular, correo) VALUES
 (54,2,'MARISOL QUISPE RAMOS','JEFA DE SISTEMAS',21,'987000001','admin@santaaurora.demo'),
 (55,2,'DIEGO PAREDES LUNA','TÉCNICO DE SOPORTE',21,'987000002','soporte@santaaurora.demo'),
 (56,2,'CAMILA ROJAS VEGA','JEFA DE ENFERMERÍA',19,'987000003','usuario@santaaurora.demo'),
 (57,2,'HUGO MENDOZA TORRES','QUÍMICO FARMACÉUTICO',20,'987000004','hugo@santaaurora.demo'),
 (58,2,'PAOLA SALAS DÍAZ','RECEPCIONISTA',22,'987000005',NULL),
 (59,3,'RICARDO LEÓN CASTRO','JEFE DE TI',26,'986000001','admin@andesnorte.demo'),
 (60,3,'SOFÍA BLANCO ARIAS','ANALISTA DE SOPORTE',26,'986000002','soporte@andesnorte.demo'),
 (61,3,'JORGE NAVARRO PEÑA','INGENIERO RESIDENTE',23,'986000003','usuario@andesnorte.demo'),
 (62,3,'LUCÍA FARFÁN GIL','ASISTENTE ADMINISTRATIVA',25,'986000004',NULL),
 (63,3,'MARIO CHÁVEZ ORTIZ','ALMACENERO',24,'986000005',NULL);

INSERT INTO usuarios (id, empresa_id, empleado_id, nombre, email, password_hash, rol_id, activo) VALUES
 (6,2,54,'Marisol Quispe','admin@santaaurora.demo','pbkdf2:sha256:1000000$FuXZS52R6rP0QWO0$599f65fc05fa2aa49ce4bf335911c4161831e8a0b25dba1bfe997e68ce44f8bb',1,TRUE),
 (7,2,55,'Diego Paredes','soporte@santaaurora.demo','pbkdf2:sha256:1000000$FuXZS52R6rP0QWO0$599f65fc05fa2aa49ce4bf335911c4161831e8a0b25dba1bfe997e68ce44f8bb',2,TRUE),
 (8,2,56,'Camila Rojas','usuario@santaaurora.demo','pbkdf2:sha256:1000000$FuXZS52R6rP0QWO0$599f65fc05fa2aa49ce4bf335911c4161831e8a0b25dba1bfe997e68ce44f8bb',3,TRUE),
 (9,3,59,'Ricardo León','admin@andesnorte.demo','pbkdf2:sha256:1000000$FuXZS52R6rP0QWO0$599f65fc05fa2aa49ce4bf335911c4161831e8a0b25dba1bfe997e68ce44f8bb',1,TRUE),
 (10,3,60,'Sofía Blanco','soporte@andesnorte.demo','pbkdf2:sha256:1000000$FuXZS52R6rP0QWO0$599f65fc05fa2aa49ce4bf335911c4161831e8a0b25dba1bfe997e68ce44f8bb',2,TRUE),
 (11,3,61,'Jorge Navarro','usuario@andesnorte.demo','pbkdf2:sha256:1000000$FuXZS52R6rP0QWO0$599f65fc05fa2aa49ce4bf335911c4161831e8a0b25dba1bfe997e68ce44f8bb',3,TRUE);

INSERT INTO tickets (id, empresa_id, codigo, titulo, descripcion, prioridad_id, estado_id, solicitante_id, tecnico_id, creado_en) VALUES
 (4,2,'TCK-0001','Sistema de historias clínicas lento','El sistema tarda más de un minuto en abrir una historia.',1,3,56,7,NOW() - INTERVAL 200 MINUTE),
 (5,2,'TCK-0002','Lector de código de barras de farmacia','El lector no reconoce los códigos.',2,2,57,NULL,NOW() - INTERVAL 10 HOUR),
 (6,3,'TCK-0001','Sin internet en la obra Lote 7','El enlace satelital de la obra no tiene señal.',1,2,61,10,NOW() - INTERVAL 90 MINUTE),
 (7,3,'TCK-0002','Solicitud de licencia de AutoCAD','Se necesita una licencia adicional para el residente.',3,1,61,NULL,NOW() - INTERVAL 2 HOUR);

INSERT INTO ticket_historial (ticket_id, estado_anterior_id, estado_nuevo_id, usuario_id, comentario, fecha) VALUES
 (4,NULL,1,NULL,'Ticket registrado.',NOW() - INTERVAL 200 MINUTE),
 (4,1,3,7,'Se revisa el servidor de base de datos.',NOW() - INTERVAL 150 MINUTE),
 (5,NULL,2,NULL,'Ticket registrado.',NOW() - INTERVAL 10 HOUR),
 (6,NULL,2,NULL,'Ticket registrado.',NOW() - INTERVAL 90 MINUTE),
 (7,NULL,1,NULL,'Ticket registrado.',NOW() - INTERVAL 2 HOUR);

INSERT INTO notificaciones (usuario_id, ticket_id, tipo, titulo, mensaje, leida) VALUES
 (7,4,'asignado','Ticket asignado','El ticket TCK-0001 fue asignado a ti.',FALSE),
 (10,6,'asignado','Ticket asignado','El ticket TCK-0001 fue asignado a ti.',FALSE);
